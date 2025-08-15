import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import type { InsertNewHire } from '@shared/schema';
import fs from 'fs';
import path from 'path';

export class AggressiveHireTracker {
  private browser: Browser | null = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ],
    });
    console.log('🚀 Aggressive Hire Tracker initialized with Puppeteer');
  }

  private async getPageContent(url: string): Promise<string> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    const page: Page = await this.browser.newPage();
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const content = await page.content();
      return content;
    } finally {
      await page.close();
    }
  }

  async trackCompanyHires(companyName: string, linkedinUrl?: string): Promise<InsertNewHire[]> {
    const logMessage = `🎯 AGGRESSIVE tracking for ${companyName} using Puppeteer`;
    console.log(logMessage);
    await this.logToDatabase('info', 'aggressive_tracker', logMessage);
    
    const allHires: InsertNewHire[] = [];

    const sources = [
      { type: 'Website', method: this.scrapeCompanyWebsite.bind(this) },
      { type: 'LinkedIn', method: this.scrapeLinkedInDirect.bind(this) },
      { type: 'Press', method: this.scrapePressReleases.bind(this) },
      { type: 'News', method: this.scrapeIndustryNews.bind(this) },
    ];

    for (const source of sources) {
      try {
        const hires = await source.method(companyName, linkedinUrl);
        if (hires.length === 0) {
          console.warn(`⚠️ No hires found from ${source.type} for ${companyName}`);
        }
        allHires.push(...hires);
        console.log(`✅ ${source.type} scraping found ${hires.length} potential hires.`);
      } catch (error) {
        console.error(`❌ Error scraping ${source.type} for ${companyName}:`, error);
      }
    }

    if (allHires.length === 0) {
      console.warn(`⚠️ No hires found for ${companyName} from any source.`);
    }

    const uniqueHires = this.deduplicateHires(allHires);
    // Log raw candidates and optionally dump for debugging
    try {
      console.log(`🧾 Raw candidate hires for ${companyName}:`);
      console.log(JSON.stringify(allHires, null, 2).substring(0, 2000));
      if (process.env.DEBUG_HIRES === 'true') {
        const dumpDir = path.resolve(process.cwd(), 'debug_hires');
        if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
        const filePath = path.join(dumpDir, `${companyName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`);
        fs.writeFileSync(filePath, JSON.stringify({ company: companyName, timestamp: new Date().toISOString(), raw: allHires }, null, 2));
        console.log(`📁 Wrote raw hires debug file: ${filePath}`);
      }
    } catch (e) {
      console.error('❌ Failed to log raw hires:', e);
    }
    if (uniqueHires.length < allHires.length) {
      console.info(`ℹ️ Deduplicated ${allHires.length - uniqueHires.length} duplicate hires for ${companyName}`);
    }
  const finalMessage = `✅ Total unique hires found for ${companyName}: ${uniqueHires.length}`;
  console.log(finalMessage);
  await this.logToDatabase('info', 'aggressive_tracker', finalMessage);
  
  // Informational runtime summary about guarantees/limits
  console.info(`ℹ️ Scan summary for ${companyName}: extracted ${allHires.length} candidates, ${uniqueHires.length} unique after deduplication. Note: the tracker attempts to find hires across multiple public sources using pattern matching; it cannot guarantee it will find every hire mentioned in external sources due to content variations, paywalls, or rate limits.`);
    return uniqueHires;
  }
  
  private async logToDatabase(level: string, service: string, message: string): Promise<void> {
    try {
      const { storage } = await import('../storage');
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

  private async scrapeCompanyWebsite(companyName: string): Promise<InsertNewHire[]> {
    const query = `"${companyName}" "new hire" OR "welcomes" OR "joins the team" OR "appointed"`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const content = await this.getPageContent(url);
    return this.extractHiresFromContent(content, companyName, 'Company Website');
  }

  private async scrapeLinkedInDirect(companyName: string, linkedinUrl?: string): Promise<InsertNewHire[]> {
    if (!linkedinUrl) return [];
    
    // Use LinkedIn API if available
    if (process.env.LINKEDIN_ACCESS_TOKEN) {
      return await this.getLinkedInAPIHires(companyName, linkedinUrl);
    }
    
    const content = await this.getPageContent(linkedinUrl + '/posts/');
    return this.extractHiresFromContent(content, companyName, 'LinkedIn');
  }
  
  private async getLinkedInAPIHires(companyName: string, linkedinUrl: string): Promise<InsertNewHire[]> {
    try {
      const apiLogMessage = `🔗 Attempting LinkedIn API for ${companyName}`;
      console.log(apiLogMessage);
      await this.logToDatabase('info', 'linkedin_api', apiLogMessage);
      
      console.log(`🔗 LinkedIn URL: ${linkedinUrl}`);
      console.log(`🔗 Access Token: ${process.env.LINKEDIN_ACCESS_TOKEN ? 'Present' : 'Missing'}`);
      
      // Try multiple API endpoints
      const endpoints = [
        `https://api.linkedin.com/rest/posts?q=author&author=${encodeURIComponent(linkedinUrl)}&count=50`,
        `https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&projection=(elements*(organizationalTarget~(localizedName,vanityName)))&count=50`
      ];
      
      for (const endpoint of endpoints) {
        console.log(`🔗 Trying endpoint: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`🔗 Response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`🔗 Response data:`, JSON.stringify(data, null, 2).substring(0, 500));
          
          const hires = this.extractHiresFromAPIResponse(data, companyName);
          if (hires.length > 0) {
            const successMessage = `✅ LinkedIn API found ${hires.length} hires for ${companyName}`;
            console.log(successMessage);
            await this.logToDatabase('info', 'linkedin_api', successMessage);
            return hires;
          }
        } else {
          const errorText = await response.text();
          console.warn(`LinkedIn API error ${response.status}: ${errorText}`);
        }
      }
      
      return [];
      
    } catch (error) {
      console.error('LinkedIn API error:', error);
      return [];
    }
  }
  
  private extractHiresFromAPIResponse(data: any, companyName: string): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    
    try {
      // Handle different API response formats
      const elements = data.elements || data.posts || [];
      
      for (const item of elements) {
        const text = item.commentary?.text || item.text?.text || item.content || '';
        if (text) {
          const hire = this.extractHireFromText(text, companyName);
          if (hire) hires.push(hire);
        }
      }
    } catch (error) {
      console.error('Error extracting hires from API response:', error);
    }
    
    return hires;
  }
  
  private extractHireFromText(text: string, companyName: string): InsertNewHire | null {
    try {
      const patterns = [
        /welcome\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+)/gi,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:has\s+)?joined\s+(?:us\s+)?as\s+([A-Z][a-zA-Z\s&-]+)/gi,
        /excited\s+to\s+announce\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+)/gi
      ];
      
      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match && this.isValidHire(match[1], match[2])) {
          return {
            personName: match[1].trim(),
            company: companyName,
            position: match[2].trim(),
            startDate: new Date(),
            linkedinProfile: null,
            previousCompany: null,
            source: 'LinkedIn API',
            confidenceScore: '95',
            foundDate: new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async scrapePressReleases(companyName: string): Promise<InsertNewHire[]> {
    const query = `"${companyName}" "new hire" OR "appointment"`;
    const url = `https://www.prnewswire.com/search/news/?keyword=${encodeURIComponent(query)}`;
    const content = await this.getPageContent(url);
    return this.extractHiresFromContent(content, companyName, 'Press Release');
  }

  private async scrapeIndustryNews(companyName: string): Promise<InsertNewHire[]> {
    const query = `"${companyName}" "new hire" OR "joins"`;
    const url = `https://news.google.com/search?q=${encodeURIComponent(query)}`;
    const content = await this.getPageContent(url);
    return this.extractHiresFromContent(content, companyName, 'Industry News');
  }

  private extractHiresFromContent(content: string, companyName: string, source: string): InsertNewHire[] {
    console.log(`\n--- Analyzing content from ${source} for ${companyName} ---\n`);
    // Show a snippet of the content for debugging
    console.log(content.substring(0, 2000));
    console.log(`\n------------------------------------------------------\n`);

    const hires: InsertNewHire[] = [];

    // Expanded, more robust patterns for hire detection
    const hirePatterns = [
      // "John Doe joins Company as CTO"
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+(has\s+)?(joined|joins|joining)\s+([\w\s]+)?(as|to|as the)?\s*(our|the)?\s*(new)?\s*([\w\s-]{2,100})/gi,
      // "Congratulations to John Doe, appointed CTO"
      /(congratulations|welcome|welcoming|announcing|introducing)\s+(to\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+(?: [A-Z][a-z]+)?)(,|\s+)?(who\s+)?(has\s+been)?\s*(appointed|named)?\s*(as|to)?\s*(our|the)?\s*(new)?\s*([\w\s-]{2,100})/gi,
      // "Jane Smith is appointed as CEO"
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+(is|has been)\s+(appointed|named|promoted)\s*(as|to)?\s*(our|the)?\s*(new)?\s*([\w\s-]{2,100})/gi,
      // "John Doe will lead as CTO"
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+will\s+lead\s+as\s+([\w\s-]{2,100})/gi,
      // "John Doe, CTO at Company"
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?: [A-Z][a-z]+)?),?\s+(the|our|new)?\s*([\w\s-]{2,100})\s+at\s+([A-Z][a-zA-Z\s]+)/gi
    ];

    const jobPostingPatterns = [
      /hiring/i, /seeking/i, /looking for/i, /apply now/i, /job opening/i, /we are hiring/i, /join our team/i, /career opportunity/i
    ];

    if (jobPostingPatterns.some(pattern => pattern.test(content))) {
      console.log('Skipping content because it looks like a job posting.');
      return [];
    }

    for (const pattern of hirePatterns) {
      // Use exec loop for compatibility with older TS targets
      const re = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        let name = '';
        let position = '';

        // Pattern-specific extraction logic
        if (pattern.source.includes('joined')) {
          name = match[1];
          position = match[8] || match[7] || '';
        } else if (pattern.source.includes('congratulations')) {
          name = match[3];
          position = match[11] || '';
        } else if (pattern.source.includes('appointed')) {
          name = match[1];
          position = match[7] || match[6] || '';
        } else if (pattern.source.includes('will lead')) {
          name = match[1];
          position = match[2] || '';
        } else if (pattern.source.includes('at Company')) {
          name = match[1];
          position = match[3] || '';
        }

        name = name?.trim();
        position = position?.trim();

        if (this.isValidHire(name, position)) {
          console.log(`✅ Potential Hire Found: ${name} - ${position}`);
          hires.push({
            personName: name,
            company: companyName,
            position: this.cleanPosition(position),
            startDate: null,
            source,
            confidenceScore: '90',
          });
        } else {
          if (name || position) {
            console.warn(`⚠️ Skipping invalid hire candidate: name='${name}', position='${position}'`);
          }
        }
      }
    }

    if (hires.length === 0) {
      console.warn(`⚠️ No valid hires extracted from ${source} for ${companyName}`);
    }

    return hires;
  }

  private isValidHire(name: string, position: string): boolean {
    if (!name || !position) return false;
    
    // Must have proper first and last name
    const nameParts = name.split(' ');
    if (nameParts.length < 2 || nameParts.length > 3) return false;
    
    // Reject sports players and garbage
    const invalidNames = [
      'wrexham', 'star', 'basketball', 'football', 'tennis', 'soccer',
      'striker', 'midfielder', 'defender', 'goalkeeper', 'player',
      'eagles', 'content', 'market', 'prop', 'tel', 'go'
    ];
    
    const lowerName = name.toLowerCase();
    if (invalidNames.some(invalid => lowerName.includes(invalid))) {
      return false;
    }
    
    // Must be proper business position
    const businessKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'director', 'manager', 'head',
      'vice president', 'vp', 'president', 'senior', 'lead', 'officer',
      'executive', 'principal', 'analyst', 'specialist', 'coordinator'
    ];
    
    const posLower = position.toLowerCase();
    return businessKeywords.some(keyword => posLower.includes(keyword)) &&
           position.length > 2 && position.length < 100;
  }

  private cleanPosition(position: string): string {
    return position.replace(/^(our|the|a|as)\s+/i, '').trim();
  }

  private deduplicateHires(hires: InsertNewHire[]): InsertNewHire[] {
    const strict = process.env.DEDUP_STRICT !== 'false';
    // Strict dedup: exact match on name+company+position
    if (strict) {
      const seen = new Set();
      return hires.filter(hire => {
        const key = `${hire.personName?.toLowerCase()}-${hire.company?.toLowerCase()}-${hire.position?.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Lenient dedup: allow small name variations but treat very similar records as duplicates
    const results: InsertNewHire[] = [];
    for (const h of hires) {
      const duplicate = results.find(r => {
        const nameDist = this.levenshteinDistance((r.personName || '').toLowerCase(), (h.personName || '').toLowerCase());
        const posSame = (r.position || '').toLowerCase() === (h.position || '').toLowerCase();
        const nameLen = Math.max((r.personName || '').length, (h.personName || '').length, 1);
        const nameSim = nameDist / nameLen; // normalized distance
        return nameSim <= 0.25 && posSame && (r.company || '').toLowerCase() === (h.company || '').toLowerCase();
      });
      if (!duplicate) results.push(h);
    }
    return results;
  }

  // Small Levenshtein distance implementation for fuzzy matching
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}