import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { InsertNewHire } from '@shared/schema';

export class GoogleSearchService {
  private apiKey: string;
  private searchEngineId: string;
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    this.apiKey = process.env.GOOGLE_SEARCH_API_KEY || '';
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
    
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      console.log('🤖 AI-powered hire extraction enabled');
    }
  }

  async searchForHires(companyName: string): Promise<InsertNewHire[]> {
    if (!this.apiKey || !this.searchEngineId) {
      console.warn('⚠️ Google Search not configured, using basic pattern matching');
      return [];
    }

    try {
      console.log(`🔍 Searching for ${companyName} hire announcements...`);
      
      // Expanded queries for broader coverage
      const queries = [
        `"${companyName}" "welcome" "joined our team" site:linkedin.com`,
        `"${companyName}" "joined" "new team member" site:linkedin.com`,
        `"${companyName}" "hired as" site:linkedin.com`,
        `"${companyName}" "excited to welcome" site:linkedin.com`,
        `"${companyName}" "pleased to announce" site:linkedin.com`,
        `"${companyName}" "new hire" site:linkedin.com`,
        `"${companyName}" hiring announcement press release`,
        `"${companyName}" "joined as"`,
        `"${companyName}" "starting as"`,
        `"${companyName}" "new employee"`,
        `"${companyName}" "recently joined"`,
        `"${companyName}" "welcome to the team"`
      ];

      const hires: InsertNewHire[] = [];
      let processedItems = 0;
  const maxItems = 20; // Slightly increase for broader coverage

      for (const query of queries) {
        if (processedItems >= maxItems) break;
        
        try {
          const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
              key: this.apiKey,
              cx: this.searchEngineId,
              q: query,
              num: Math.min(5, maxItems - processedItems),
              dateRestrict: 'm1'
            },
            timeout: 10000
          });

          console.log(`🔍 Found ${response.data.items?.length || 0} results for: "${query.substring(0, 50)}..."`);
          
          for (const item of response.data.items || []) {
            if (processedItems >= maxItems) break;
            
            console.log(`🔍 Processing item: ${item.title?.substring(0, 50)}...`);
            const hire = await this.extractHireWithAI(item, companyName);
            if (hire) {
              hires.push(hire);
              console.log(`✅ Extracted hire: ${hire.personName} as ${hire.position} at ${hire.company}`);
            } else {
              console.log(`❌ No hire extracted from: ${item.title?.substring(0, 50)}...`);
            }
            processedItems++;
          }
          
          await this.delay(2000); // Longer delay between queries
          
        } catch (error: any) {
          if (error.response?.status === 429) {
            console.warn('⚠️ Google Search API rate limit reached');
            break;
          }
          console.warn(`⚠️ Search query failed: ${error.message}`);
        }
      }

      console.log(`✅ Found ${hires.length} potential hires from Google Search`);
      return hires;
      
    } catch (error) {
      console.error('❌ Google search failed:', error);
      return [];
    }
  }

  private async extractHireWithAI(item: any, companyName: string): Promise<InsertNewHire | null> {
    try {
      const title = item.title || '';
      const snippet = item.snippet || '';
      const text = `${title} ${snippet}`;
      const url = item.link || '';

      console.log(`🔍 Analyzing text: "${text.substring(0, 100)}..."`);

      // Quick filter for hire-related content
      const hireKeywords = [
        'welcome', 'joined', 'hire', 'hired', 'hiring', 'announce', 'announcement', 'team', 'new', 'employee',
        'starting as', 'joined as', 'recently joined', 'excited to welcome', 'pleased to announce', 'new team member', 'welcome to the team'
      ];
      const hasHireKeyword = hireKeywords.some(keyword => text.toLowerCase().includes(keyword));
      if (!hasHireKeyword) {
        console.log(`❌ No hire keywords found in: ${text.substring(0, 50)}...`);
        return null;
      }

      console.log(`✅ Hire keywords found, using DIRECT pattern matching (skipping AI)...`);

      // Skip AI completely - use pattern matching directly
      return this.extractWithAdvancedPatterns(text, companyName, url);
      
    } catch (error) {
      console.warn('⚠️ Hire extraction failed:', error);
      return null;
    }
  }

  private async extractWithGeminiAI(text: string, companyName: string, url: string): Promise<InsertNewHire | null> {
    try {
      // Rate limiting: wait if needed
      await this.rateLimitDelay();
      
  const prompt = `Extract hiring information from the following text. Only respond if it is about a REAL PERSON (with a full name) joining ${companyName} as a new employee, team member, or in a new position. Ignore generic company news, product launches, or non-hiring events.

Text: "${text}"

Respond with JSON only:
{"isHire": true, "personName": "John Smith", "position": "Software Engineer", "confidence": 95}

Or: {"isHire": false}`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();
      
      // Clean response more aggressively
      let cleanResponse = response.replace(/```json|```|```/g, '').trim();
      if (cleanResponse.startsWith('Based on') || cleanResponse.startsWith('Looking at')) {
        // Extract JSON from response
        const jsonMatch = cleanResponse.match(/\{[^}]+\}/);
        if (jsonMatch) {
          cleanResponse = jsonMatch[0];
        } else {
          throw new Error('No JSON found in response');
        }
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      if (parsed.isHire && this.isValidPersonName(parsed.personName) && this.isValidPosition(parsed.position)) {
        return {
          personName: parsed.personName,
          company: companyName,
          position: parsed.position,
          startDate: new Date(),
          linkedinProfile: url.includes('linkedin.com') ? url : null,
          source: url.includes('linkedin.com') ? 'LinkedIn' : 'Google Search',
          confidenceScore: parsed.confidence?.toString() || '75'
        };
      }
      
      return null;
      
    } catch (error: any) {
      if (error.status === 429) {
        console.warn(`⚠️ Rate limit hit, waiting ${error.errorDetails?.[2]?.retryDelay || '60s'}`);
        await this.delay(60000); // Wait 1 minute
        return null; // Skip this extraction
      }
      console.warn('⚠️ AI extraction failed, using fallback:', error.message);
      return this.extractWithAdvancedPatterns(text, companyName, url);
    }
  }

  private lastApiCall = 0;
  private async rateLimitDelay(): Promise<void> {
    const minInterval = 6000; // 6 seconds between calls (10 per minute max)
    const timeSinceLastCall = Date.now() - this.lastApiCall;
    if (timeSinceLastCall < minInterval) {
      await this.delay(minInterval - timeSinceLastCall);
    }
    this.lastApiCall = Date.now();
  }

  private extractWithAdvancedPatterns(text: string, companyName: string, url: string): InsertNewHire | null {
    console.log(`🔍 Pattern matching on: "${text.substring(0, 150)}..."`);
    
    // Precise patterns for real hiring announcements only
    const hirePatterns = [
      // "John Smith joined as CEO" - must have proper name and position
      /\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+(?:joined|joins)\s+(?:as|our team as)\s+((?:Chief|Senior|Vice President|Director|Manager|Head of|Lead)[A-Za-z\s]{3,25})\b/i,
      
      // "Welcome John Smith as CEO" - must be welcoming a specific person
      /\b(?:welcome|pleased to welcome)\s+([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+(?:as|to)\s+(?:our\s+new\s+)?((?:Chief|Senior|Vice President|Director|Manager|Head of|Lead|CEO|CTO|CFO|COO)[A-Za-z\s]{2,25})\b/i,
      
      // "John Smith, CEO at Company" - must have company context
      /\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?),\s+((?:Chief|Senior|Vice President|Director|Manager|Head of|Lead|CEO|CTO|CFO|COO)[A-Za-z\s]{2,25})\s+at\s+\w/i,
      
      // "Excited to announce John Smith as CEO" - must be announcement
      /\b(?:excited to announce|happy to share|pleased to announce)\s+(?:that\s+)?([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+(?:has\s+)?(?:joined|joins)\s+(?:as|our team as)\s+((?:Chief|Senior|Vice President|Director|Manager|Head of|Lead|CEO|CTO|CFO|COO)[A-Za-z\s]{2,25})\b/i,
      
      // "John Smith has been appointed as CEO"
      /\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+has\s+been\s+(?:appointed|named)\s+(?:as\s+)?(?:the\s+new\s+)?((?:Chief|Senior|Vice President|Director|Manager|Head of|Lead|CEO|CTO|CFO|COO)[A-Za-z\s]{2,25})\b/i
    ];

    for (let i = 0; i < hirePatterns.length; i++) {
      const pattern = hirePatterns[i];
      const match = text.match(pattern);
      if (match) {
        console.log(`✅ Pattern ${i+1} matched: ${match[0]}`);
        
        const personName = match[1]?.trim();
        const position = match[2]?.trim();
        
        console.log(`👤 Extracted: Name="${personName}", Position="${position}"`);
        
        if (this.isValidPersonName(personName) && this.isValidPosition(position)) {
          console.log(`✅ Valid hire found: ${personName} as ${position}`);
          return {
            personName,
            company: companyName,
            position: this.cleanPosition(position),
            startDate: new Date(),
            linkedinProfile: url.includes('linkedin.com') ? url : null,
            source: url.includes('linkedin.com') ? 'LinkedIn' : 'Google Search',
            confidenceScore: url.includes('linkedin.com') ? '90' : '80'
          };
        } else {
          console.log(`❌ Invalid: Name valid=${this.isValidPersonName(personName)}, Position valid=${this.isValidPosition(position)}`);
        }
      }
    }
    
    console.log(`❌ No patterns matched for: ${text.substring(0, 100)}...`);
    return null;
  }

  private isValidPersonName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    const words = name.trim().split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    
    // Block obvious non-names
    const invalidNames = [
      'alert we', 'trooper alert', 'new trooper', 'our team', 'to the', 'from now', 
      'who knows', 'integration with', 'the launch', 'hires and', 'value proposition',
      'orientation materials', 'news linkedin', 'latest news', 'press releases',
      'media gallery', 'outside box', 'blockquote betsson', 'global tech'
    ];
    if (invalidNames.some(invalid => name.toLowerCase().includes(invalid))) return false;
    
    // Must be proper capitalized names only
    return words.every(word => /^[A-Z][a-z]{2,}$/.test(word) && word.length >= 3);
  }

  private isValidPosition(position: string): boolean {
    if (!position || typeof position !== 'string') return false;
    const pos = position.toLowerCase().trim();
    
    // Block invalid positions
    const invalidPositions = [
      'team member', 'ir', 'further', 'an independent cro', 'trooper', 'alert',
      'employee', 'materials', 'proposition', 'news', 'linkedin', 'gallery',
      'box', 'blockquote', 'tech footprint', 'hub', 'certifications'
    ];
    if (invalidPositions.some(invalid => pos.includes(invalid))) return false;
    
    // Must contain executive/leadership keywords
    const validPositionKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'chief', 'director', 'manager', 'head of', 
      'vice president', 'president', 'senior', 'lead', 'officer', 'executive'
    ];
    
    return pos.length >= 3 && validPositionKeywords.some(keyword => pos.includes(keyword));
  }

  private cleanPosition(position: string): string {
    return position
      .replace(/^(our|the|a)\s+/i, '')
      .replace(/\s+(team|department|at).*$/i, '')
      .trim() || 'Team Member';
  }
  
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}