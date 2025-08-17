import type { Company, InsertNewHire } from '@shared/schema';
import { storage } from '../storage';

export class FixedHireTracker {
  private customSearchKey: string;
  private customSearchEngineId: string;
  private geminiApiKey: string;

  constructor() {
    this.customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.customSearchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
  }

  async trackCompanyHires(company: Company): Promise<InsertNewHire[]> {
    const logMessage = `🎯 FIXED hire tracker for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'fixed_hire_tracker', logMessage);

    if (!this.customSearchKey || !this.customSearchEngineId) {
      console.warn(`⚠️ Google Custom Search not configured`);
      return [];
    }

    const hires: InsertNewHire[] = [];

    try {
      // Professional hire search queries - BROADER DATE RANGE
      const searchQueries = [
        `"${company.name}" "excited to announce" "joining" site:linkedin.com`,
        `"${company.name}" "pleased to announce" "joined" site:linkedin.com`,
        `"${company.name}" "thrilled to announce" "new" site:linkedin.com`,
        `"${company.name}" "has joined our team" site:linkedin.com`,
        `"${company.name}" "welcome" "team" site:linkedin.com`
      ];

      for (const query of searchQueries) {
        try {
          // FIXED: Use y1 (1 year) instead of m1 (1 month) for broader results
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=5&dateRestrict=y1`;
          
          const response = await fetch(searchUrl);
          if (!response.ok) continue;
          
          const data = await response.json();
          
          if (data.items) {
            for (const item of data.items) {
              const hire = await this.extractHireFromSearchResult(item, company);
              if (hire) {
                console.log(`✅ FOUND HIRE: ${hire.personName} as ${hire.position}`);
                hires.push(hire);
              }
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn(`Search query failed for ${company.name}:`, error);
        }
      }

      const validHires = this.validateAndDeduplicateHires(hires);
      const resultMessage = `✅ FIXED tracker found ${validHires.length} REAL NAMES for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'fixed_hire_tracker', resultMessage);

      return validHires;

    } catch (error) {
      const errorMessage = `❌ Fixed hire tracker error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'fixed_hire_tracker', errorMessage);
      return [];
    }
  }

  private async extractHireFromSearchResult(item: any, company: Company): Promise<InsertNewHire | null> {
    const fullText = `${item.title} ${item.snippet}`;
    console.log(`🔍 Analyzing: ${fullText.substring(0, 200)}...`);
    
    // FIXED: Extract name from LinkedIn URL pattern first
    let extractedName = '';
    let extractedPosition = '';
    
    // Extract name from LinkedIn URL: /posts/andrew-hernandez-039096154_
    const urlMatch = item.link.match(/\/posts\/([a-z]+-[a-z]+-[0-9]+)/i);
    if (urlMatch) {
      const urlParts = urlMatch[1].split('-');
      if (urlParts.length >= 2) {
        extractedName = `${this.capitalize(urlParts[0])} ${this.capitalize(urlParts[1])}`;
        console.log(`📝 Extracted name from URL: ${extractedName}`);
      }
    }
    
    // FIXED: Better position extraction patterns for actual search results
    const positionPatterns = [
      // "VIP Customer Account Advisor" from "...position ... VIP Customer Account Adviso..."
      /position.*?([A-Z][A-Za-z\s]+(?:Advisor|Manager|Executive|Director|Lead|Specialist|Analyst|Officer|Engineer|Developer))/i,
      // "as [position]" pattern
      /as\s+(?:a\s+)?([A-Z][A-Za-z\s]+?)(?:\.|,|$|\s+The)/i,
      // "joining as [position]"
      /joining.*as\s+(?:a\s+)?([A-Z][A-Za-z\s]+)/i,
      // "appointed as [position]"
      /appointed\s+as\s+(?:a\s+)?([A-Z][A-Za-z\s]+)/i,
      // Extract from title like "Alexandra Fletcher - VIP Customer Account Advisor"
      /-\s+([A-Z][A-Za-z\s]+(?:Advisor|Manager|Executive|Director|Lead|Specialist|Analyst|Officer|Engineer|Developer))/i,
      // "accepted a position ... [TITLE]" pattern
      /accepted\s+a\s+position.*?([A-Z][A-Za-z\s]+(?:Advisor|Manager|Executive|Director|Lead|Specialist|Analyst|Officer|Engineer|Developer))/i
    ];
    
    for (const pattern of positionPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extractedPosition = match[1].trim();
        console.log(`💼 Extracted position: ${extractedPosition}`);
        break;
      }
    }
    
    // If we found both name and position, validate and return
    if (extractedName && extractedPosition) {
      const cleanName = this.cleanPersonName(extractedName);
      const cleanPos = this.cleanPosition(extractedPosition);
      
      console.log(`🔍 VALIDATION: Name="${cleanName}" Position="${cleanPos}"`);
      console.log(`🔍 Name valid: ${this.validatePersonName(cleanName)}, Position valid: ${this.validatePosition(cleanPos)}`);
      
      if (this.validatePersonName(cleanName) && this.validatePosition(cleanPos)) {
        console.log(`✅ VALID HIRE: ${cleanName} as ${cleanPos}`);
        return {
          personName: cleanName,
          company: company.name,
          position: cleanPos,
          startDate: new Date(),
          source: 'Fixed Extraction + Custom Search',
          confidenceScore: '95',
          foundDate: new Date(),
          verified: true
        };
      } else {
        console.log(`❌ REJECTED: ${cleanName} as ${cleanPos}`);
      }
    }
    
    // Fallback: Use Gemini AI if available
    if (this.geminiApiKey && !extractedName) {
      try {
        const aiExtracted = await this.extractWithGemini(fullText, company);
        if (aiExtracted) return aiExtracted;
      } catch (error) {
        console.warn('Gemini extraction failed, continuing...');
      }
    }

    return null;
  }

  private async extractWithGemini(text: string, company: Company): Promise<InsertNewHire | null> {
    try {
      const prompt = `Extract hire information from this LinkedIn post. Return ONLY a JSON object.

Text: "${text}"

Extract:
- personName: Full name of the person (First Last)
- position: Job title they're joining as
- Only if it's clearly a new hire announcement

Example: {"personName": "Andrew Hernandez", "position": "Senior Marketing Executive"}`;

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

      const jsonMatch = aiResponse.match(/\{[^}]+\}/);
      if (!jsonMatch) return null;

      const extracted = JSON.parse(jsonMatch[0]);
      
      if (extracted.personName && extracted.position && this.validatePersonName(extracted.personName)) {
        console.log(`🤖 Gemini extracted: ${extracted.personName} as ${extracted.position}`);
        return {
          personName: extracted.personName,
          company: company.name,
          position: extracted.position,
          startDate: new Date(),
          source: 'Gemini AI + Custom Search',
          confidenceScore: '98',
          foundDate: new Date(),
          verified: true
        };
      }

    } catch (error) {
      console.warn('Gemini AI extraction failed:', error);
    }

    return null;
  }

  private capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  private cleanPersonName(name: string): string {
    return name
      .replace(/[^a-zA-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => this.capitalize(word))
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
    
    // FIXED: More comprehensive business keywords including the ones we're seeing
    const businessKeywords = [
      'advisor', 'manager', 'director', 'officer', 'lead', 'senior', 'principal', 
      'analyst', 'specialist', 'coordinator', 'engineer', 'developer', 'designer', 
      'consultant', 'associate', 'assistant', 'executive', 'supervisor', 'head',
      'account', 'customer', 'vip', 'team', 'business', 'product', 'marketing', 
      'sales', 'operations', 'finance', 'hr', 'human resources', 'strategy',
      'research', 'development', 'technical', 'support', 'service', 'quality',
      'compliance', 'risk', 'audit', 'legal', 'procurement', 'sourcing'
    ];
    
    const posLower = position.toLowerCase();
    const hasKeyword = businessKeywords.some(keyword => posLower.includes(keyword));
    
    // FIXED: Also accept positions that look professional (Title Case)
    const looksLikeTitle = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(position.trim());
    
    return hasKeyword || looksLikeTitle;
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