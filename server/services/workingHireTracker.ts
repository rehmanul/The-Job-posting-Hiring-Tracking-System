import type { Company, InsertNewHire } from '@shared/schema';
import { storage } from '../storage';

export class WorkingHireTracker {
  private customSearchKey: string;
  private customSearchEngineId: string;
  private geminiApiKey: string;

  constructor() {
    this.customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.customSearchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
  }

  async trackCompanyHires(company: Company): Promise<InsertNewHire[]> {
    const logMessage = `🎯 WORKING hire tracker for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'working_hire_tracker', logMessage);

    if (!this.customSearchKey || !this.customSearchEngineId) {
      console.warn(`⚠️ Google Custom Search not configured`);
      return [];
    }

    const hires: InsertNewHire[] = [];

    try {
      // Professional hire search queries
      const searchQueries = [
        `"${company.name}" "pleased to announce" "joined" site:linkedin.com`,
        `"${company.name}" "excited to welcome" "new" site:linkedin.com`,
        `"${company.name}" "has joined our team" site:linkedin.com`,
        `"${company.name}" "appointed" "CEO" OR "CTO" OR "CFO" OR "Director" site:linkedin.com`,
        `"${company.name}" "thrilled to announce" "hire" site:linkedin.com`
      ];

      for (const query of searchQueries) {
        try {
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=5&dateRestrict=m1`;
          
          const response = await fetch(searchUrl);
          if (!response.ok) continue;
          
          const data = await response.json();
          
          if (data.items) {
            for (const item of data.items) {
              const hire = await this.extractHireFromSearchResult(item, company);
              if (hire) hires.push(hire);
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn(`Search query failed for ${company.name}:`, error);
        }
      }

      const validHires = this.validateAndDeduplicateHires(hires);
      const resultMessage = `✅ Working tracker found ${validHires.length} REAL NAMES for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'working_hire_tracker', resultMessage);

      return validHires;

    } catch (error) {
      const errorMessage = `❌ Working hire tracker error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'working_hire_tracker', errorMessage);
      return [];
    }
  }

  private async extractHireFromSearchResult(item: any, company: Company): Promise<InsertNewHire | null> {
    const fullText = `${item.title} ${item.snippet}`;
    
    // Use Gemini AI to extract structured hire data
    if (this.geminiApiKey) {
      try {
        const aiExtracted = await this.extractWithGemini(fullText, company);
        if (aiExtracted) return aiExtracted;
      } catch (error) {
        console.warn('Gemini extraction failed, using regex fallback');
      }
    }
    
    // Fallback to regex patterns
    return this.extractWithRegex(fullText, company);
  }

  private async extractWithGemini(text: string, company: Company): Promise<InsertNewHire | null> {
    try {
      const prompt = `Extract hire information from this text. Return ONLY a JSON object with personName, position, and startDate fields. If no clear hire announcement, return null.

Text: "${text}"

Requirements:
- personName must be a real person's full name (First Last)
- position must be a job title
- Ignore sports players, content creators, or non-business hires
- Only extract if it's clearly a new hire announcement

Example: {"personName": "John Smith", "position": "Software Engineer", "startDate": "2024-01-15"}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiResponse) return null;

      // Try to parse JSON from AI response
      const jsonMatch = aiResponse.match(/\{[^}]+\}/);
      if (!jsonMatch) return null;

      const extracted = JSON.parse(jsonMatch[0]);
      
      if (extracted.personName && extracted.position && this.validatePersonName(extracted.personName)) {
        return {
          personName: extracted.personName,
          company: company.name,
          position: extracted.position,
          startDate: extracted.startDate ? new Date(extracted.startDate) : new Date(),
          source: 'Gemini AI + Custom Search',
          confidenceScore: '95',
          foundDate: new Date(),
          verified: true
        };
      }

    } catch (error) {
      console.warn('Gemini AI extraction failed:', error);
    }

    return null;
  }

  private extractWithRegex(text: string, company: Company): InsertNewHire | null {
    // Professional hire extraction patterns
    const patterns = [
      // Executive appointments
      /(?:pleased|excited|thrilled)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:as|who|to)\s+(?:our\s+new\s+)?(CEO|CTO|CFO|COO|VP|Vice President|President|Director|Head\s+of\s+[\w\s]+)/i,
      
      // Team joins
      /(?:welcome|introducing)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:to\s+(?:our\s+)?team|who\s+(?:has\s+)?joined\s+us)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i,
      
      // New hire announcements
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has\s+)?joined\s+(?:us|our\s+team|the\s+company)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i,
      
      // Appointment announcements
      /(?:thrilled|delighted|happy)\s+to\s+announce\s+(?:that\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has\s+been\s+)?(?:appointed|named)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = this.cleanPersonName(match[1]);
        const position = this.cleanPosition(match[2] || 'Professional');
        
        if (this.validatePersonName(personName) && this.validatePosition(position)) {
          return {
            personName,
            company: company.name,
            position,
            startDate: new Date(),
            source: 'Regex + Custom Search',
            confidenceScore: '85',
            foundDate: new Date(),
            verified: true
          };
        }
      }
    }

    return null;
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
      .replace(/^(our|the|a|as|new)\s+/i, '')
      .trim();
  }

  private validatePersonName(name: string): boolean {
    if (!name || name.length < 3) return false;
    
    const parts = name.split(' ');
    if (parts.length < 2 || parts.length > 4) return false;
    
    // Each part should be a proper name
    for (const part of parts) {
      if (part.length < 2 || part.length > 20) return false;
      if (!/^[A-Z][a-z]+$/.test(part)) return false;
    }
    
    // Reject garbage terms
    const invalidTerms = [
      'Team', 'Company', 'Position', 'New', 'Announce', 'Welcome', 'Excited',
      'Basketball', 'Football', 'Sports', 'Star', 'Player', 'Content', 'Market',
      'Working', 'Reviews', 'Pros', 'Cons', 'Recently', 'Started', 'Very'
    ];
    
    const lowerName = name.toLowerCase();
    if (invalidTerms.some(term => lowerName.includes(term.toLowerCase()))) {
      return false;
    }
    
    return true;
  }

  private validatePosition(position: string): boolean {
    if (!position || position.length < 3) return false;
    
    // Must contain business keywords
    const businessKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'director', 'manager', 'head', 'vice president', 'vp', 
      'president', 'senior', 'lead', 'officer', 'executive', 'principal', 'analyst', 
      'specialist', 'coordinator', 'engineer', 'developer', 'designer', 'consultant'
    ];
    
    const posLower = position.toLowerCase();
    return businessKeywords.some(keyword => posLower.includes(keyword));
  }

  private validateAndDeduplicateHires(hires: InsertNewHire[]): InsertNewHire[] {
    // Filter valid hires
    const validHires = hires.filter(hire => 
      hire.personName && 
      hire.position && 
      this.validatePersonName(hire.personName) &&
      this.validatePosition(hire.position)
    );
    
    // Deduplicate by name + company
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