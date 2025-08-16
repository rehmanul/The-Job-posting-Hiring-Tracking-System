import type { Company, InsertNewHire } from '@shared/schema';
import { storage } from '../storage';

export class ProfessionalHireTracker {
  private customSearchKey: string;
  private customSearchEngineId: string;

  constructor() {
    this.customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.customSearchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';
  }

  async trackCompanyHires(company: Company): Promise<InsertNewHire[]> {
    const logMessage = `👥 Professional hire tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'hire_tracker', logMessage);

    if (!this.customSearchKey || !this.customSearchEngineId) {
      console.warn('⚠️ Google Custom Search not configured');
      return [];
    }

    const hires: InsertNewHire[] = [];

    try {
      // Search LinkedIn for hire announcements
      const linkedinHires = await this.searchLinkedInHires(company);
      hires.push(...linkedinHires);

      // Search Twitter for hire announcements  
      const twitterHires = await this.searchTwitterHires(company);
      hires.push(...twitterHires);

      // Search company press releases
      const pressHires = await this.searchPressReleases(company);
      hires.push(...pressHires);

      const uniqueHires = this.deduplicateHires(hires);
      
      const resultMessage = `✅ Found ${uniqueHires.length} professional hires for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'hire_tracker', resultMessage);

      return uniqueHires;

    } catch (error) {
      const errorMessage = `❌ Hire tracking error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'hire_tracker', errorMessage);
      return [];
    }
  }

  private async searchLinkedInHires(company: Company): Promise<InsertNewHire[]> {
    const queries = [
      `"${company.name}" "pleased to announce" OR "excited to welcome" OR "thrilled to welcome" site:linkedin.com`,
      `"${company.name}" "joined our team" OR "new team member" OR "welcome to the team" site:linkedin.com`,
      `"${company.name}" "has joined" OR "appointed as" OR "named as" site:linkedin.com`
    ];

    const hires: InsertNewHire[] = [];

    for (const query of queries) {
      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=10&dateRestrict=w1`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.items) {
          for (const item of data.items) {
            const hire = this.extractLinkedInHire(item, company);
            if (hire) hires.push(hire);
          }
        }

        // Rate limiting
        await this.delay(1000);
      } catch (error) {
        console.warn(`LinkedIn search failed for ${company.name}:`, error);
      }
    }

    return hires;
  }

  private async searchTwitterHires(company: Company): Promise<InsertNewHire[]> {
    const query = `"${company.name}" ("joined" OR "hired" OR "welcome") -RT site:twitter.com`;
    
    try {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=5&dateRestrict=w1`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      const hires: InsertNewHire[] = [];

      if (data.items) {
        for (const item of data.items) {
          const hire = this.extractTwitterHire(item, company);
          if (hire) hires.push(hire);
        }
      }

      return hires;
    } catch (error) {
      console.warn(`Twitter search failed for ${company.name}:`, error);
      return [];
    }
  }

  private async searchPressReleases(company: Company): Promise<InsertNewHire[]> {
    const query = `"${company.name}" ("appoints" OR "names" OR "hires" OR "joins") ("CEO" OR "CTO" OR "CFO" OR "VP" OR "Director")`;
    
    try {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=5&dateRestrict=w1`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      const hires: InsertNewHire[] = [];

      if (data.items) {
        for (const item of data.items) {
          const hire = this.extractPressReleaseHire(item, company);
          if (hire) hires.push(hire);
        }
      }

      return hires;
    } catch (error) {
      console.warn(`Press release search failed for ${company.name}:`, error);
      return [];
    }
  }

  private extractLinkedInHire(item: any, company: Company): InsertNewHire | null {
    const text = `${item.title} ${item.snippet}`;
    
    // Advanced LinkedIn hire patterns
    const patterns = [
      // Executive announcements
      /(?:pleased|excited|thrilled|proud)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z][a-z]+)\s+(?:as\s+(?:our\s+new\s+)?(CEO|CTO|CFO|COO|VP|Vice\s+President|President|Director|Head\s+of\s+[\w\s]+|Chief\s+[\w\s]+Officer))/i,
      
      // Team joins
      /(?:welcome|introducing)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z][a-z]+)\s+(?:to\s+(?:our\s+)?team|who\s+(?:has\s+)?joined\s+us)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i,
      
      // Professional joins
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z][a-z]+)\s+(?:has\s+)?joined\s+(?:us|our\s+team|the\s+company)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i,
      
      // Appointments
      /(?:delighted|happy)\s+to\s+announce\s+(?:that\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z][a-z]+)\s+(?:has\s+been\s+)?(?:appointed|named)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = this.cleanPersonName(match[1]);
        const position = this.cleanPosition(match[2] || 'New Employee');
        
        if (this.validateProfessionalHire(personName, position, text)) {
          return {
            personName,
            company: company.name,
            position,
            source: 'linkedin_search',
            confidenceScore: this.calculateConfidenceScore(text, personName, position),
            foundDate: new Date(),
            linkedinProfile: item.link,
            verified: false
          };
        }
      }
    }

    return null;
  }

  private extractTwitterHire(item: any, company: Company): InsertNewHire | null {
    const text = `${item.title} ${item.snippet}`;
    
    const patterns = [
      /(?:welcome|excited\s+to\s+welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:to|who\s+joined)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:has\s+)?joined\s+(?:us|our\s+team)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = this.cleanPersonName(match[1]);
        
        if (this.validateProfessionalHire(personName, 'New Employee', text)) {
          return {
            personName,
            company: company.name,
            position: this.extractPosition(text) || 'New Employee',
            source: 'twitter_search',
            confidenceScore: '75',
            foundDate: new Date(),
            verified: false
          };
        }
      }
    }

    return null;
  }

  private extractPressReleaseHire(item: any, company: Company): InsertNewHire | null {
    const text = `${item.title} ${item.snippet}`;
    
    const patterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z][a-z]+)\s+(?:has\s+been\s+)?(?:appointed|named)\s+as\s+(CEO|CTO|CFO|COO|VP|Vice\s+President|President|Director|Chief\s+[\w\s]+Officer)/i,
      /(CEO|CTO|CFO|COO|VP|Vice\s+President|President|Director|Chief\s+[\w\s]+Officer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z][a-z]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = this.cleanPersonName(match[1]);
        const position = this.cleanPosition(match[2]);
        
        if (this.validateProfessionalHire(personName, position, text)) {
          return {
            personName,
            company: company.name,
            position,
            source: 'press_release',
            confidenceScore: '95',
            foundDate: new Date(),
            verified: true
          };
        }
      }
    }

    return null;
  }

  private validateProfessionalHire(name: string, position: string, text: string): boolean {
    if (!name || !position) return false;
    if (name.split(' ').length < 2) return false;
    
    // Reject sports/entertainment terms
    const invalidTerms = [
      'basketball', 'football', 'sports', 'star', 'player', 'striker',
      'midfielder', 'defender', 'goalkeeper', 'tennis', 'soccer',
      'wrexham', 'evolution', 'tennessee', 'eagles', 'content', 'market',
      'game', 'match', 'season', 'league', 'championship', 'tournament'
    ];
    
    const lowerText = text.toLowerCase();
    if (invalidTerms.some(term => lowerText.includes(term))) {
      return false;
    }

    // Must be business position
    const businessKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'director', 'manager', 'head',
      'vice president', 'vp', 'president', 'senior', 'lead', 'officer',
      'executive', 'principal', 'analyst', 'specialist', 'coordinator',
      'engineer', 'developer', 'architect', 'consultant', 'advisor'
    ];
    
    const posLower = position.toLowerCase();
    return businessKeywords.some(keyword => posLower.includes(keyword));
  }

  private calculateConfidenceScore(text: string, personName: string, position: string): string {
    let score = 70;

    // Executive positions
    if (/CEO|CTO|CFO|COO|VP|President|Director|Head\s+of/i.test(position)) {
      score += 20;
    }

    // Professional language
    if (/pleased|excited|thrilled|proud|delighted/i.test(text)) {
      score += 10;
    }

    // LinkedIn source
    if (text.includes('linkedin.com')) {
      score += 5;
    }

    return Math.min(score, 98).toString();
  }

  private cleanPersonName(name: string): string {
    return name
      .replace(/[^a-zA-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private cleanPosition(position: string): string {
    return position
      .replace(/[^a-zA-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^(our|the|a|as)\s+/i, '')
      .trim();
  }

  private extractPosition(text: string): string | null {
    const positionMatch = text.match(/as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,|$)/i);
    return positionMatch ? positionMatch[1].trim() : null;
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

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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