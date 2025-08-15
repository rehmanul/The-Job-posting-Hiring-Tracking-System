import type { Company, InsertNewHire } from '@shared/schema';
import { storage } from '../storage';

interface LinkedInAPIConfig {
  baseUrl: string;
  accessToken: string;
  version: string;
}

interface LinkedInProfile {
  id: string;
  firstName: { localized: { [key: string]: string } };
  lastName: { localized: { [key: string]: string } };
  headline: { localized: { [key: string]: string } };
  positions?: {
    elements: Array<{
      companyName: string;
      title: string;
      startDate: { month: number; year: number };
      endDate?: { month: number; year: number };
    }>;
  };
}

export class AdvancedLinkedInAPI {
  private config: LinkedInAPIConfig;
  private rateLimits = {
    organizationsLookup: { limit: 50000, used: 0, resetTime: 0 },
    ugcPosts: { limit: 20000, used: 0, resetTime: 0 },
    organizationalEntityNotifications: { limit: 500, used: 0, resetTime: 0 },
    people: { limit: 10000, used: 0, resetTime: 0 }
  };

  constructor() {
    this.config = {
      baseUrl: 'https://api.linkedin.com/rest',
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN || '',
      version: '2.0.0'
    };
  }

  async trackNewHiresProfessionally(): Promise<InsertNewHire[]> {
    console.log('🎯 Advanced LinkedIn API: Professional hire tracking initiated');
    
    const companies = await storage.getCompanies();
    const activeCompanies = companies.filter(c => c.isActive);
    const newHires: InsertNewHire[] = [];

    for (const company of activeCompanies) {
      try {
        // Priority 1: Organization notifications (highest accuracy)
        const notifications = await this.getOrganizationNotifications(company);
        const notificationHires = await this.extractHiresFromNotifications(notifications, company);
        
        // Priority 2: UGC posts analysis
        const posts = await this.getOrganizationPosts(company);
        const postHires = await this.extractHiresFromPosts(posts, company);
        
        // Priority 3: People API for profile changes
        const profileHires = await this.trackProfileChanges(company);
        
        // Professional consolidation
        const allHires = [...notificationHires, ...postHires, ...profileHires];
        const professionalHires = this.filterProfessionalHires(allHires);
        
        newHires.push(...professionalHires);
        
        console.log(`✅ Advanced API found ${professionalHires.length} professional hires for ${company.name}`);
        
        // Respect rate limits professionally
        await this.professionalDelay();
        
      } catch (error) {
        console.error(`❌ Advanced API error for ${company.name}:`, error);
      }
    }

    return this.deduplicateProfessionally(newHires);
  }

  private async getOrganizationNotifications(company: Company): Promise<any[]> {
    if (!company.linkedinUrl || !this.checkRateLimit('organizationalEntityNotifications')) {
      return [];
    }
    
    try {
      const orgId = this.extractOrgIdFromUrl(company.linkedinUrl);
      if (!orgId) return [];

      const url = `${this.config.baseUrl}/organizationalEntityNotifications`;
      const params = new URLSearchParams({
        q: 'criteria',
        organizationalEntity: `urn:li:organization:${orgId}`,
        actions: 'List(SHARE,ADMIN_COMMENT)',
        'timeRange.start': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime().toString(), // Last 7 days
        'timeRange.end': new Date().getTime().toString(),
        count: '50'
      });

      const response = await this.makeAuthenticatedRequest(`${url}?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        this.updateRateLimit('organizationalEntityNotifications');
        return data.elements || [];
      }

      return [];

    } catch (error) {
      console.error('Advanced notification fetch error:', error);
      return [];
    }
  }

  private async getOrganizationPosts(company: Company): Promise<any[]> {
    if (!company.linkedinUrl || !this.checkRateLimit('ugcPosts')) {
      return [];
    }
    
    try {
      const orgId = this.extractOrgIdFromUrl(company.linkedinUrl);
      if (!orgId) return [];

      const url = `${this.config.baseUrl}/ugcPosts`;
      const params = new URLSearchParams({
        q: 'authors',
        authors: `List(urn:li:organization:${orgId})`,
        sortBy: 'LAST_MODIFIED',
        count: '25'
      });

      const response = await this.makeAuthenticatedRequest(`${url}?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        this.updateRateLimit('ugcPosts');
        return data.elements || [];
      }

      return [];

    } catch (error) {
      console.error('Advanced posts fetch error:', error);
      return [];
    }
  }

  private async trackProfileChanges(company: Company): Promise<InsertNewHire[]> {
    // Advanced profile change tracking would require additional LinkedIn permissions
    // This is a placeholder for future implementation
    return [];
  }

  private async extractHiresFromNotifications(notifications: any[], company: Company): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    
    for (const notification of notifications) {
      try {
        const notificationDate = new Date(notification.lastModifiedAt);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (notificationDate < sevenDaysAgo) continue;

        const hire = await this.extractProfessionalHireFromNotification(notification, company);
        if (hire) {
          hires.push(hire);
        }

      } catch (error) {
        console.error('Advanced notification extraction error:', error);
      }
    }

    return hires;
  }

  private async extractHiresFromPosts(posts: any[], company: Company): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    
    for (const post of posts) {
      try {
        const postDate = new Date(post.lastModifiedAt || post.createdAt);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (postDate < sevenDaysAgo) continue;

        let text = '';
        if (post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text) {
          text = post.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text;
        }

        if (!text) continue;

        const hire = await this.extractProfessionalHireFromText(text, company, postDate);
        if (hire) {
          hires.push(hire);
        }

      } catch (error) {
        console.error('Advanced post extraction error:', error);
      }
    }

    return hires;
  }

  private async extractProfessionalHireFromNotification(notification: any, company: Company): Promise<InsertNewHire | null> {
    // Professional extraction logic for notifications
    return null; // Placeholder - implement based on actual API response structure
  }

  private async extractProfessionalHireFromText(text: string, company: Company, foundDate: Date): Promise<InsertNewHire | null> {
    // Advanced hire extraction patterns
    const professionalPatterns = [
      // Executive appointments
      /(?:pleased|excited|proud)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+as\s+(?:our\s+new\s+)?(CEO|CTO|CFO|COO|VP|President|Director|Head\s+of|Chief\s+[\w\s]+Officer)/i,
      
      // Senior hires
      /(?:welcome|introducing)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:,\s+who\s+)?(?:has\s+)?joined\s+(?:us|our\s+team)\s+as\s+(?:our\s+new\s+)?(Senior\s+[\w\s]+|Lead\s+[\w\s]+|Principal\s+[\w\s]+|Manager\s+[\w\s]+)/i,
      
      // Department heads
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:has\s+been\s+)?(?:appointed|named)\s+as\s+(?:our\s+new\s+)?Head\s+of\s+([\w\s]+)/i
    ];

    for (const pattern of professionalPatterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = this.cleanPersonName(match[1]);
        const position = this.cleanPosition(match[2]);
        
        // Professional validation
        if (this.validateProfessionalHire(personName, position)) {
          return {
            personName,
            company: company.name,
            position,
            source: 'linkedin_api',
            confidenceScore: this.calculateAPIConfidenceScore(text, personName, position),
            foundDate,
            verified: false
          };
        }
      }
    }

    return null;
  }

  private validateProfessionalHire(personName: string, position: string): boolean {
    // Professional validation rules
    if (!personName || personName.length < 3) return false;
    if (!position || position.length < 3) return false;
    
    // Must have at least first and last name
    if (personName.split(' ').length < 2) return false;
    
    // Reject obvious non-names
    const invalidNames = [
      'team', 'company', 'organization', 'group', 'department',
      'basketball', 'football', 'sports', 'star', 'player', 'striker'
    ];
    
    const lowerName = personName.toLowerCase();
    if (invalidNames.some(invalid => lowerName.includes(invalid))) {
      return false;
    }

    return true;
  }

  private calculateAPIConfidenceScore(text: string, personName: string, position: string): number {
    let score = 60; // Base score for API source

    // Executive positions get higher confidence
    if (/CEO|CTO|CFO|COO|VP|President|Director|Head\s+of|Chief/i.test(position)) {
      score += 15;
    }

    // Senior positions
    if (/Senior|Lead|Principal|Manager/i.test(position)) {
      score += 10;
    }

    // Professional language
    if (/pleased|excited|thrilled|proud|delighted/i.test(text)) {
      score += 5;
    }

    // Full name provided
    if (personName.split(' ').length >= 2) {
      score += 5;
    }

    return Math.min(score, 95); // Cap at 95% for API source
  }

  private filterProfessionalHires(hires: InsertNewHire[]): InsertNewHire[] {
    return hires.filter(hire => {
      // Only high-confidence hires
      if (hire.confidenceScore < 75) return false;
      
      // Professional validation
      return this.validateProfessionalHire(hire.personName, hire.position);
    });
  }

  private deduplicateProfessionally(hires: InsertNewHire[]): InsertNewHire[] {
    const seen = new Map<string, InsertNewHire>();
    
    for (const hire of hires) {
      const key = `${hire.personName.toLowerCase()}-${hire.company.toLowerCase()}`;
      
      if (!seen.has(key) || (seen.get(key)!.confidenceScore < hire.confidenceScore)) {
        seen.set(key, hire);
      }
    }
    
    return Array.from(seen.values());
  }

  private cleanPersonName(name: string): string {
    return name
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private cleanPosition(position: string): string {
    return position
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractOrgIdFromUrl(linkedinUrl: string): string | null {
    const match = linkedinUrl.match(/\/company\/(\d+)/);
    return match ? match[1] : null;
  }

  private checkRateLimit(endpoint: keyof typeof this.rateLimits): boolean {
    const limit = this.rateLimits[endpoint];
    const now = Date.now();
    
    // Reset daily limits
    if (now > limit.resetTime) {
      limit.used = 0;
      limit.resetTime = now + (24 * 60 * 60 * 1000); // 24 hours
    }
    
    return limit.used < limit.limit;
  }

  private updateRateLimit(endpoint: keyof typeof this.rateLimits): void {
    this.rateLimits[endpoint].used++;
  }

  private async makeAuthenticatedRequest(url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'X-Restli-Protocol-Version': this.config.version,
        'Content-Type': 'application/json'
      }
    });
  }

  private async professionalDelay(): Promise<void> {
    // Professional rate limiting - 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  getRateLimitStatus() {
    return Object.entries(this.rateLimits).reduce((acc, [key, limit]) => {
      acc[key] = `${limit.used}/${limit.limit}`;
      return acc;
    }, {} as Record<string, string>);
  }
}