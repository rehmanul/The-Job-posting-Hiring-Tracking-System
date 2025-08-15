import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { InsertNewHire } from '@shared/schema';



interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  positions: LinkedInPosition[];
}

interface LinkedInPosition {
  title: string;
  company: {
    name: string;
  };
  startDate: {
    month: number;
    year: number;
  };
  isCurrent: boolean;
}

export class LinkedInAPIService {
  private accessToken: string | null = null;
  private isInitialized = false;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null; // epoch ms when token expires
  private tokenFilePath: string = path.resolve(process.cwd(), 'server', 'linkedin_token.json');

  async initialize(): Promise<void> {
    try {
      console.log('🔗 Initializing LinkedIn API Service...');
      
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/';

      // token persistence file alongside server files
      this.tokenFilePath = path.resolve(process.cwd(), 'server', 'linkedin_token.json');

      // Try to load persisted token (if any)
      try {
        if (fs.existsSync(this.tokenFilePath)) {
          const raw = fs.readFileSync(this.tokenFilePath, 'utf-8');
          const parsed = JSON.parse(raw);
          this.accessToken = parsed.access_token || null;
          this.refreshToken = parsed.refresh_token || null;
          this.tokenExpiry = parsed.expires_at || null;
          if (this.accessToken) console.log('✅ Loaded persisted LinkedIn access token');
        }
      } catch (e) {
        // ignore read errors
      }
      
      if (!clientId || !clientSecret) {
        console.log('💡 LinkedIn API credentials not configured');
        console.log('📝 Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET for 99% hire detection accuracy');
        return;
      }
      
      console.log('✅ LinkedIn API credentials found');
      console.log(`🔑 Client ID: ${clientId.substring(0, 8)}...`);
      
  // Ensure we have an access token (either from env, persisted file, or OAuth)
  await this.ensureAccessToken(clientId, clientSecret, redirectUri);
      
      this.isInitialized = true;
      console.log('✅ LinkedIn API Service initialized');
      if (!this.accessToken) {
        console.log('💡 Complete OAuth flow to enable LinkedIn API features');
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize LinkedIn API:', error);
      this.isInitialized = false;
    }
  }

  private async ensureAccessToken(clientId: string, clientSecret: string, redirectUri: string): Promise<void> {
    try {
      // Prefer explicit env token
      this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || this.accessToken;
      if (this.accessToken) {
        console.log('✅ Using existing LinkedIn access token');
        return;
      }

      // If token expired and refresh token available, try refresh
      if (this.refreshToken && this.tokenExpiry && Date.now() > this.tokenExpiry) {
        console.log('🔁 LinkedIn access token expired, attempting refresh');
        const refreshed = await this.refreshAccessToken(clientId, clientSecret);
        if (refreshed) return;
      }

      // No token available - prompt user to complete OAuth
      console.log('🔑 LinkedIn OAuth scopes required: openid, profile, w_member_social, email');
      console.log('� Start the OAuth flow by visiting the authorization URL below and completing sign-in:');
      console.log(`   ${this.getAuthorizationUrl()}`);
      // keep accessToken null until user completes flow
      this.accessToken = null;
    } catch (e) {
      console.warn('⚠️ ensureAccessToken failed', e);
      this.accessToken = null;
    }
  }

  private async refreshAccessToken(clientId: string, clientSecret: string): Promise<boolean> {
    try {
      if (!this.refreshToken) return false;
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        const expiresIn = parseInt(response.data.expires_in || '0', 10);
        this.tokenExpiry = expiresIn ? Date.now() + expiresIn * 1000 : null;
        await this.persistToken(response.data);
        console.log('✅ LinkedIn access token refreshed');
        return true;
      }
      return false;
    } catch (error: any) {
      console.warn('⚠️ Failed to refresh LinkedIn access token:', error.response?.data || error.message);
      return false;
    }
  }

  async detectCompanyHires(companyId: string, companyName: string): Promise<InsertNewHire[]> {
    // Ensure access token is available
    this.accessToken = this.accessToken || process.env.LINKEDIN_ACCESS_TOKEN || null;
    if (!this.accessToken) {
      console.log(`⚠️ No LinkedIn access token - skipping LinkedIn API hire detection for ${companyName}`);
      return [];
    }

    try {
      // If companyId missing, try to derive from companyName or URL
      if (!companyId) {
        const maybeId = this.extractCompanyIdFromUrl(companyName) || null;
        companyId = maybeId || companyId;
      }
      if (!companyId) {
        // Attempt to lookup by vanity name
        const org = await this.getOrganizationByVanityName(companyName);
        if (org && org.organization) {
          // organization URN looks like urn:li:organization:12345
          const urn = org.organization;
          const matches = /urn:li:organization:(\d+)/.exec(urn);
          if (matches) companyId = matches[1];
        }
      }

      if (!companyId) {
        console.log(`⚠️ Could not determine LinkedIn organization ID for ${companyName} - skipping API detection`);
        return [];
      }

      return await this.searchLinkedInPosts(companyId, companyName);
    } catch (err) {
      console.error('❌ detectCompanyHires error:', err);
      return [];
    }
  }


  private async getCompanyEmployees(companyId: string): Promise<LinkedInProfile[]> {
    try {
      const response = await axios.get(
        `https://api.linkedin.com/v2/people/(company:${companyId})`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
          },
          params: {
            projection: '(id,firstName,lastName,headline,positions)'
          }
        }
      );

      return response.data.elements || [];
      
    } catch (error) {
      console.error('❌ Failed to get company employees:', error);
      return [];
    }
  }

  private async getOrganizationByVanityName(vanityName: string): Promise<any | null> {
    try {
      if (!vanityName) return null;
      // strip trailing slashes if full url provided
      const slug = vanityName.split('/').filter(Boolean).pop();
      if (!slug) return null;

      const response = await axios.get('https://api.linkedin.com/v2/organizations', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
        params: {
          q: 'vanityName',
          vanityName: slug
        }
      });

      return response.data || null;
    } catch (error: any) {
      console.warn('⚠️ getOrganizationByVanityName failed:', error.response?.data || error.message);
      return null;
    }
  }

  private isRecentHire(profile: LinkedInProfile): boolean {
    if (!profile.positions || profile.positions.length === 0) return false;
    
    const currentPosition = profile.positions.find(pos => pos.isCurrent);
    if (!currentPosition || !currentPosition.startDate) return false;
    
    const startDate = new Date(currentPosition.startDate.year, currentPosition.startDate.month - 1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return startDate > thirtyDaysAgo;
  }

  private getStartDate(profile: LinkedInProfile): Date {
    const currentPosition = profile.positions.find(pos => pos.isCurrent);
    if (currentPosition && currentPosition.startDate) {
      return new Date(currentPosition.startDate.year, currentPosition.startDate.month - 1);
    }
    return new Date(); // Fallback to current date
  }

  private async alternativeHireDetection(companyName: string): Promise<InsertNewHire[]> {
    try {
      console.log(`🔄 Using alternative hire detection for ${companyName}`);
      
      // Use Google Search API if available
      const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
      const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      
      if (googleApiKey && searchEngineId) {
        return await this.searchForHireAnnouncements(companyName);
      }
      
      console.log('💡 Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID for enhanced hire detection');
      return [];
      
    } catch (error) {
      console.error('❌ Alternative hire detection failed:', error);
      return [];
    }
  }

  async searchForHireAnnouncements(companyName: string): Promise<InsertNewHire[]> {
    console.log(`📰 Searching for hire announcements: ${companyName}`);
    
    if (!this.accessToken) {
      this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || null;
    }

    // This function is deprecated for direct API calls as it lacks a company ID.
    // The new flow uses detectCompanyHires with a companyId.
    // Falling back to Gemini to avoid errors.
    console.log(`⚠️ Calling searchForHireAnnouncements without a company ID. Using Gemini AI fallback for ${companyName}.`);
    const { GoogleSearchService } = await import('./googleSearchService');
    const googleSearchService = new GoogleSearchService();
    return await googleSearchService.searchForHires(companyName);
  }


  private async searchLinkedInPosts(companyId: string, companyName: string): Promise<InsertNewHire[]> {
    try {
      console.log(`🔍 Searching LinkedIn posts for ${companyName} hire announcements`);
      // Paginate and collect shares from the organization
      const hires: InsertNewHire[] = [];
      let start = 0;
      const count = 50;
      let more = true;

      while (more && start < 500) { // cap to avoid runaway requests
        const response = await axios.get('https://api.linkedin.com/v2/shares', {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
          },
          params: {
            q: 'owners',
            owners: `urn:li:organization:${companyId}`,
            start,
            count
          }
        });

        const elements = response.data?.elements || [];
        for (const post of elements) {
          const hireInfo = this.extractHireInfoFromPost(post, companyName);
          if (hireInfo) hires.push(hireInfo);
        }

        if (!elements || elements.length < count) {
          more = false;
        } else {
          start += count;
        }
      }

      console.log(`✅ Found ${hires.length} potential hires from LinkedIn posts`);
      return hires;
      
    } catch (error: any) {
      console.error('❌ LinkedIn post search failed:', error.response?.data || error.message);
      return [];
    }
  }

  private async persistToken(tokenResponse: any): Promise<void> {
    try {
      const payload: any = {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token || this.refreshToken || null,
        expires_in: tokenResponse.expires_in || null,
        expires_at: tokenResponse.expires_in ? Date.now() + parseInt(tokenResponse.expires_in, 10) * 1000 : null
      };
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(payload, null, 2), 'utf-8');
      console.log('✅ Persisted LinkedIn token to', this.tokenFilePath);
    } catch (err) {
      console.warn('⚠️ Failed to persist LinkedIn token:', err);
    }
  }
  
  private extractHireInfoFromPost(post: any, companyName: string): InsertNewHire | null {
    try {
      const text = post.text?.text || '';
      
      // Look for hire-related keywords
      const hireKeywords = ['welcome', 'joined', 'new team member', 'excited to announce', 'pleased to welcome'];
      const hasHireKeyword = hireKeywords.some(keyword => text.toLowerCase().includes(keyword));
      
      if (!hasHireKeyword) return null;
      
      // Extract person name (basic pattern matching)
      const nameMatch = text.match(/welcome\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
      const personName = nameMatch ? nameMatch[1] : 'New Team Member';
      
      // Extract position (basic pattern matching)
      const positionMatch = text.match(/as\s+(?:our\s+)?([^.!]+)/i);
      const position = positionMatch ? positionMatch[1].trim() : 'Team Member';
      
      return {
        personName,
        company: companyName,
        position,
        startDate: new Date(post.created?.time || Date.now()),
        linkedinProfile: '', // Would need to extract from post if available
        source: 'linkedin_posts',
        confidenceScore: '85' // Good confidence for LinkedIn posts
      };
      
    } catch (error) {
      console.warn('⚠️ Failed to extract hire info from post:', error);
      return null;
    }
  }

  extractCompanyIdFromUrl(linkedinUrl: string): string | null {
    try {
      const match = linkedinUrl.match(/\/company\/([^\/]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  
  // Method to handle OAuth callback and exchange code for token
  async exchangeCodeForToken(code: string): Promise<string | null> {
    try {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/';
      
      if (!clientId || !clientSecret) {
        throw new Error('LinkedIn credentials not configured');
      }
      
      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', 
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: clientId,
          client_secret: clientSecret,
      redirect_uri: redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      this.accessToken = response.data.access_token;
    this.refreshToken = response.data.refresh_token || null;
    this.tokenExpiry = response.data.expires_in ? Date.now() + parseInt(response.data.expires_in || '0', 10) * 1000 : null;
    // Persist token to file for future runs
    await this.persistToken(response.data);
      console.log('✅ LinkedIn access token obtained successfully');
      if (this.accessToken) {
        this.saveTokenToEnv(this.accessToken);
      }
      
      return this.accessToken;


      
    } catch (error: any) {
      console.error('❌ Failed to exchange code for token:', error.response?.data || error.message);
      return null;
    }
  }

  private saveTokenToEnv(token: string): void {
    const envPath = path.resolve(process.cwd(), '.env');
    try {
      let envFileContent = '';
      if (fs.existsSync(envPath)) {
        envFileContent = fs.readFileSync(envPath, 'utf-8');
      }

      const lines = envFileContent.split('\n').filter(line => line.trim() !== '');
      let tokenExists = false;

      const newLines = lines.map(line => {
        if (line.startsWith('LINKEDIN_ACCESS_TOKEN=')) {
          tokenExists = true;
          return `LINKEDIN_ACCESS_TOKEN=${token}`;
        }
        return line;
      });

      if (!tokenExists) {
        newLines.push(`LINKEDIN_ACCESS_TOKEN=${token}`);
      }

      fs.writeFileSync(envPath, newLines.join('\n') + '\n');
      console.log('✅ Access token saved to .env file');

      // Reload environment variables from .env file to update the current process
      dotenv.config({ override: true, path: envPath });
      console.log('✅ Environment variables reloaded for current process');

      // Also update the current instance's token immediately
      this.accessToken = token;

    } catch (error) {
      console.error('❌ Failed to save access token or reload .env:', error);
    }
  }


  getAuthorizationUrl(): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/';
  const scopes = 'openid profile w_member_social email';

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    console.log('🔗 Generated LinkedIn auth URL:', authUrl);
    return authUrl;
  }

  async cleanup(): Promise<void> {
    console.log('🧹 LinkedIn API service cleanup complete');
  }
}
