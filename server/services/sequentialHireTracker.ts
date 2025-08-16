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
    const logMessage = `🎯 PROFESSIONAL hire tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'sequential_hire_tracker', logMessage);

    let hires: InsertNewHire[] = [];

    // STEP 1: Enhanced Custom Search (Most Reliable)
    try {
      console.log(`🔍 Professional Custom Search for ${company.name}`);
      const searchHires = await this.getProfessionalSearchHires(company);
      hires.push(...searchHires);
      console.log(`✅ Professional Search found ${searchHires.length} quality hires`);
    } catch (error) {
      console.warn(`⚠️ Professional Search failed for ${company.name}:`, error);
    }

    // STEP 2: LinkedIn API (if token works)
    if (this.linkedinAccessToken) {
      try {
        console.log(`🔗 LinkedIn API backup for ${company.name}`);
        const linkedinHires = await this.getLinkedInAPIHires(company);
        hires.push(...linkedinHires);
        console.log(`✅ LinkedIn API found ${linkedinHires.length} additional hires`);
      } catch (error) {
        console.warn(`⚠️ LinkedIn API failed for ${company.name}:`, error);
      }
    }

    const qualityHires = this.validateAndDeduplicateHires(hires);
    const resultMessage = `✅ Professional tracking found ${qualityHires.length} QUALITY hires for ${company.name}`;
    console.log(resultMessage);
    await this.logToDatabase('info', 'sequential_hire_tracker', resultMessage);

    return qualityHires;
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

  // PROFESSIONAL CUSTOM SEARCH
  private async getProfessionalSearchHires(company: Company): Promise<InsertNewHire[]> {
    if (!this.customSearchKey || !this.customSearchEngineId) return [];

    const hires: InsertNewHire[] = [];
    
    // Multiple professional search queries
    const searchQueries = [
      `"${company.name}" "pleased to announce" "joined" site:linkedin.com/posts`,
      `"${company.name}" "excited to welcome" "new" site:linkedin.com/posts`,
      `"${company.name}" "appointed" "CEO" OR "CTO" OR "CFO" OR "Director" site:linkedin.com`,
      `"${company.name}" "has joined" "team" site:linkedin.com/posts`,
      `"${company.name}" "thrilled to announce" "hire" site:linkedin.com`
    ];

    for (const query of searchQueries) {
      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=3&dateRestrict=m1`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.items) {
          for (const item of data.items) {
            const hire = this.extractProfessionalHireFromSearchResult(item, company);
            if (hire) hires.push(hire);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(`Search query failed for ${company.name}:`, error);
      }
    }

    return hires;
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

  private extractProfessionalHireFromSearchResult(item: any, company: Company): InsertNewHire | null {
    const text = `${item.title} ${item.snippet}`;
    
    // PROFESSIONAL HIRE EXTRACTION PATTERNS
    const professionalPatterns = [
      // Executive appointments
      /(?:pleased|excited|proud|thrilled)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+as\s+(?:our\s+new\s+)?(CEO|CTO|CFO|COO|VP|Vice President|President|Director|Head of [\w\s]+|Chief [\w\s]+ Officer)/i,
      
      // Senior hires
      /(?:welcome|introducing)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:,\s+who\s+)?(?:has\s+)?joined\s+(?:us|our team|the team)\s+as\s+(?:our\s+new\s+)?(Senior [\w\s]+|Lead [\w\s]+|Principal [\w\s]+|Manager [\w\s]+)/i,
      
      // General appointments
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has\s+been\s+)?(?:appointed|named)\s+as\s+(?:our\s+new\s+)?([A-Z][\w\s]+)/i,
      
      // Team joins
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+has\s+joined\s+(?:our\s+)?([\w\s]+)\s+team/i
    ];

    for (const pattern of professionalPatterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = this.cleanPersonName(match[1]);
        const position = this.cleanPosition(match[2] || 'Professional');
        
        if (this.validateProfessionalHire(personName, position)) {
          return {
            personName,
            company: company.name,
            position,
            startDate: new Date(),
            previousCompany: this.extractPreviousCompany(text, personName),
            linkedinProfile: this.extractLinkedInProfile(text),
            source: 'Professional Search',
            confidenceScore: this.calculateConfidenceScore(text, personName, position).toString(),
            foundDate: new Date(),
            verified: true
          };
        }
      }
    }
    return null;
  }
  
  private cleanPersonName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }
  
  private cleanPosition(position: string): string {
    return position.trim().replace(/\s+/g, ' ').replace(/^(our|new|the)\s+/i, '');
  }
  
  private validateProfessionalHire(personName: string, position: string): boolean {
    // Name validation
    if (!personName || personName.length < 3) return false;
    const nameParts = personName.split(' ');
    if (nameParts.length < 2 || nameParts.length > 4) return false;
    
    // Each name part should be capitalized and reasonable length
    for (const part of nameParts) {
      if (part.length < 2 || part.length > 20) return false;
      if (!/^[A-Z][a-z]+$/.test(part)) return false;
    }
    
    // Position validation
    if (!position || position.length < 3) return false;
    
    // Reject invalid names
    const invalidTerms = ['Team', 'Company', 'Organization', 'Basketball', 'Football', 'Sports', 'Star', 'Player'];
    const nameText = personName.toLowerCase();
    if (invalidTerms.some(term => nameText.includes(term.toLowerCase()))) return false;
    
    return true;
  }
  
  private calculateConfidenceScore(text: string, personName: string, position: string): number {
    let score = 70; // Base score
    
    // Executive positions get higher confidence
    if (/CEO|CTO|CFO|COO|VP|President|Director|Chief/i.test(position)) score += 20;
    
    // Senior positions
    if (/Senior|Lead|Principal|Manager|Head/i.test(position)) score += 15;
    
    // Professional language
    if (/pleased|excited|thrilled|proud|delighted/i.test(text)) score += 10;
    
    // Full name (3+ parts)
    if (personName.split(' ').length >= 3) score += 5;
    
    return Math.min(score, 98);
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

  private validateAndDeduplicateHires(hires: InsertNewHire[]): InsertNewHire[] {
    // First, validate all hires
    const validHires = hires.filter(hire => {
      return hire.personName && 
             hire.position && 
             this.validateProfessionalHire(hire.personName, hire.position);
    });
    
    // Then deduplicate, keeping highest confidence
    const seen = new Map<string, InsertNewHire>();
    
    for (const hire of validHires) {
      const key = `${hire.personName.toLowerCase()}-${hire.company.toLowerCase()}`;
      
      if (!seen.has(key) || 
          (parseInt(seen.get(key)!.confidenceScore) < parseInt(hire.confidenceScore))) {
        seen.set(key, hire);
      }
    }
    
    const uniqueHires = Array.from(seen.values());
    console.log(`🎯 Validated ${validHires.length} hires, deduplicated to ${uniqueHires.length} unique`);
    
    return uniqueHires;
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