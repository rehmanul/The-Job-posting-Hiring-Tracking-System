import type { Company, InsertNewHire } from '@shared/schema';
import { storage } from '../storage';

export class SequentialHireTracker {
  private linkedinAccessToken: string;
  private customSearchKey: string;
  private customSearchEngineId: string;

  constructor() {
    this.linkedinAccessToken = process.env.LINKEDIN_ACCESS_TOKEN || '';
    this.customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.customSearchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';
  }

  async trackCompanyHires(company: Company): Promise<InsertNewHire[]> {
    const logMessage = `👥 Sequential hire tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'sequential_hire_tracker', logMessage);

    let hires: InsertNewHire[] = [];

    // STEP 1: LinkedIn Official API
    try {
      console.log(`🔗 Step 1: LinkedIn Official API for ${company.name}`);
      const linkedinHires = await this.getLinkedInAPIHires(company);
      hires.push(...linkedinHires);
      console.log(`✅ LinkedIn API found ${linkedinHires.length} hires`);
    } catch (error) {
      console.warn(`⚠️ LinkedIn API failed for ${company.name}:`, error);
    }

    // STEP 2: Webhook Data (if available)
    try {
      console.log(`📡 Step 2: Webhook data for ${company.name}`);
      const webhookHires = await this.getWebhookHires(company);
      hires.push(...webhookHires);
      console.log(`✅ Webhook found ${webhookHires.length} hires`);
    } catch (error) {
      console.warn(`⚠️ Webhook failed for ${company.name}:`, error);
    }

    // STEP 3: Custom Search (fallback)
    if (hires.length === 0) {
      try {
        console.log(`🔍 Step 3: Custom Search fallback for ${company.name}`);
        const searchHires = await this.getCustomSearchHires(company);
        hires.push(...searchHires);
        console.log(`✅ Custom Search found ${searchHires.length} hires`);
      } catch (error) {
        console.warn(`⚠️ Custom Search failed for ${company.name}:`, error);
      }
    }

    const uniqueHires = this.deduplicateHires(hires);
    const resultMessage = `✅ Sequential tracking found ${uniqueHires.length} total hires for ${company.name}`;
    console.log(resultMessage);
    await this.logToDatabase('info', 'sequential_hire_tracker', resultMessage);

    return uniqueHires;
  }

  // STEP 1: LinkedIn Official API
  private async getLinkedInAPIHires(company: Company): Promise<InsertNewHire[]> {
    if (!this.linkedinAccessToken) return [];

    const orgId = this.extractOrgId(company.linkedinUrl);
    if (!orgId) return [];

    try {
      // UGC Posts API - Company announcements
      const postsUrl = `https://api.linkedin.com/rest/ugcPosts?q=authors&authors=List(urn:li:organization:${orgId})&sortBy=LAST_MODIFIED&count=50`;
      
      const response = await fetch(postsUrl, {
        headers: {
          'Authorization': `Bearer ${this.linkedinAccessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status}`);
      }

      const data = await response.json();
      const posts = data.elements || [];
      
      const hires: InsertNewHire[] = [];
      for (const post of posts) {
        const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
        const postDate = post.lastModified ? new Date(post.lastModified.time) : new Date();
        
        if (text && postDate >= new Date('2025-08-01')) {
          const hire = this.extractHireFromLinkedInPost(text, company);
          if (hire) hires.push(hire);
        }
      }

      return hires;
    } catch (error) {
      console.error(`LinkedIn API error for ${company.name}:`, error);
      return [];
    }
  }

  // STEP 2: Webhook Data
  private async getWebhookHires(company: Company): Promise<InsertNewHire[]> {
    try {
      // Check for recent webhook data in database
      const recentWebhookData = await storage.getWebhookData(company.name, 7); // Last 7 days
      const hires: InsertNewHire[] = [];

      for (const webhookEntry of recentWebhookData) {
        if (webhookEntry.type === 'hire_announcement') {
          const entryDate = webhookEntry.createdAt ? new Date(webhookEntry.createdAt) : new Date();
          if (entryDate >= new Date('2025-08-01')) {
            const hire = this.extractHireFromWebhook(webhookEntry, company);
            if (hire) hires.push(hire);
          }
        }
      }

      return hires;
    } catch (error) {
      console.error(`Webhook data error for ${company.name}:`, error);
      return [];
    }
  }

  // STEP 3: Custom Search (fallback)
  private async getCustomSearchHires(company: Company): Promise<InsertNewHire[]> {
    if (!this.customSearchKey || !this.customSearchEngineId) return [];

    try {
      const query = `"${company.name}" "pleased to announce" OR "excited to welcome" "joined" site:linkedin.com/posts after:2025-08-01`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=5`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      const hires: InsertNewHire[] = [];
      if (data.items) {
        for (const item of data.items) {
          const hire = this.extractHireFromSearchResult(item, company);
          if (hire) hires.push(hire);
        }
      }

      return hires;
    } catch (error) {
      console.error(`Custom Search error for ${company.name}:`, error);
      return [];
    }
  }

  private extractHireFromLinkedInPost(text: string, company: Company): InsertNewHire | null {
    const patterns = [
      /(?:pleased|excited|thrilled)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:as|who)/i,
      /(?:welcome|introducing)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+to\s+(?:our\s+)?team/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+has\s+joined\s+(?:us|our\s+team)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = match[1].trim();
        if (this.validateHireName(personName)) {
          const startDate = this.extractStartDate(text) || new Date();
          if (startDate >= new Date('2025-08-01')) {
            return {
              personName,
              company: company.name,
              position: this.extractPosition(text) || 'New Employee',
              startDate,
              previousCompany: this.extractPreviousCompany(text, personName),
              linkedinProfile: this.extractLinkedInProfile(text),
              source: 'LinkedIn Official API',
              confidenceScore: '95',
              foundDate: new Date(),
              verified: true
            };
          }
        }
      }
    }
    return null;
  }

  private extractHireFromWebhook(webhookEntry: any, company: Company): InsertNewHire | null {
    try {
      const startDate = webhookEntry.startDate ? new Date(webhookEntry.startDate) : new Date();
      if (startDate >= new Date('2025-08-01')) {
        return {
          personName: webhookEntry.personName,
          company: company.name,
          position: webhookEntry.position || 'New Employee',
          startDate,
          previousCompany: webhookEntry.previousCompany,
          linkedinProfile: webhookEntry.linkedinProfile,
          source: 'LinkedIn Webhook',
          confidenceScore: '98',
          foundDate: new Date(),
          verified: true
        };
      }
    } catch (error) {
      return null;
    }
  }

  private extractHireFromSearchResult(item: any, company: Company): InsertNewHire | null {
    const text = `${item.title} ${item.snippet}`;
    const patterns = [
      /(?:pleased|excited)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = match[1].trim();
        if (this.validateHireName(personName)) {
          const startDate = this.extractStartDate(text) || new Date();
          if (startDate >= new Date('2025-08-01')) {
            return {
              personName,
              company: company.name,
              position: this.extractPosition(text) || 'New Employee',
              startDate,
              previousCompany: null,
              linkedinProfile: null,
              source: 'Custom Search',
              confidenceScore: '75',
              foundDate: new Date(),
              verified: false
            };
          }
        }
      }
    }
    return null;
  }

  private extractOrgId(linkedinUrl?: string): string | null {
    if (!linkedinUrl) return null;
    const match = linkedinUrl.match(/company\/(\d+)/);
    return match ? match[1] : null;
  }

  private extractPosition(text: string): string | null {
    const positionMatch = text.match(/as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,|$)/i);
    return positionMatch ? positionMatch[1].trim() : null;
  }

  private extractStartDate(text: string): Date | null {
    const datePatterns = [
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
      /starting\s+(\w+\s+\d{4})/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          return new Date(match[0]);
        } catch {
          continue;
        }
      }
    }
    return new Date();
  }

  private extractPreviousCompany(text: string, personName: string): string | null {
    const patterns = [
      new RegExp(`${personName}.*?from\\s+([A-Z][\\w\\s&]+?)(?:\\s+as|\\.|,|$)`, 'i'),
      /previously\s+at\s+([A-Z][\w\s&]+?)(?:\s+as|\.|,|$)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        if (company.length > 2 && company.length < 50) {
          return company;
        }
      }
    }
    return null;
  }

  private extractLinkedInProfile(text: string): string | null {
    const profileMatch = text.match(/linkedin\.com\/in\/([\w-]+)/i);
    return profileMatch ? `https://linkedin.com/in/${profileMatch[1]}` : null;
  }

  private validateHireName(name: string): boolean {
    if (!name || name.split(' ').length !== 2) return false;
    
    const invalidTerms = ['basketball', 'football', 'sports', 'star', 'player'];
    return !invalidTerms.some(term => name.toLowerCase().includes(term));
  }

  private deduplicateHires(hires: InsertNewHire[]): InsertNewHire[] {
    const seen = new Map<string, InsertNewHire>();
    
    for (const hire of hires) {
      const key = `${hire.personName.toLowerCase()}-${hire.company.toLowerCase()}`;
      
      if (!seen.has(key) || (seen.get(key)!.confidenceScore < hire.confidenceScore)) {
        seen.set(key, hire);
      }
    }
    
    return Array.from(seen.values());
  }

  private async logToDatabase(level: string, service: string, message: string): Promise<void> {
    try {
      await storage.createSystemLog({
        level,
        service,
        message,
        metadata: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      // Ignore database logging errors
    }
  }
}