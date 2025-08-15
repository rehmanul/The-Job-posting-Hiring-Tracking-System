import puppeteer from 'puppeteer';
import type { InsertNewHire } from '@shared/schema';

export class RealHireDetector {
  private browser: any = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async detectRealHires(companyName: string, linkedinUrl?: string): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    
    // Method 1: Company Press Releases (Most Reliable)
    const pressHires = await this.scrapeCompanyPressReleases(companyName);
    hires.push(...pressHires);
    
    // Method 2: LinkedIn People Tab (High Accuracy)
    if (linkedinUrl) {
      const linkedinHires = await this.scrapeLinkedInPeopleTab(linkedinUrl, companyName);
      hires.push(...linkedinHires);
    }
    
    // Method 3: Company Social Media
    const socialHires = await this.scrapeSocialMedia(companyName);
    hires.push(...socialHires);
    
    return this.validateAndDeduplicate(hires);
  }

  private async scrapeCompanyPressReleases(companyName: string): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    const page = await this.browser.newPage();
    
    try {
      // Try company newsroom first
      const newsroomUrl = `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com/news`;
      
      try {
        await page.goto(newsroomUrl, { waitUntil: 'networkidle2', timeout: 10000 });
        
        const pressReleases = await page.evaluate(() => {
          const articles = document.querySelectorAll('article, .news-item, .press-release');
          return Array.from(articles).slice(0, 10).map(article => ({
            title: article.querySelector('h1, h2, h3, .title')?.textContent || '',
            content: article.textContent || '',
            date: article.querySelector('time, .date')?.textContent || ''
          }));
        });
        
        for (const release of pressReleases) {
          const hire = this.extractHireFromText(release.content, companyName, 'Press Release');
          if (hire) hires.push(hire);
        }
        
      } catch (error) {
        console.log(`⚠️ Could not access ${companyName} newsroom`);
      }
      
    } finally {
      await page.close();
    }
    
    return hires;
  }

  private async scrapeLinkedInPeopleTab(linkedinUrl: string, companyName: string): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    const page = await this.browser.newPage();
    
    try {
      const peopleUrl = `${linkedinUrl}/people/`;
      await page.goto(peopleUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Look for "Recently joined" indicators
      const recentHires = await page.evaluate(() => {
        const profiles = document.querySelectorAll('[data-test-id*="people"], .org-people-profile-card');
        const recent = [];
        
        for (const profile of profiles) {
          const nameEl = profile.querySelector('.org-people-profile-card__profile-title, .profile-title');
          const titleEl = profile.querySelector('.org-people-profile-card__profile-info, .profile-info');
          const recentEl = profile.querySelector('[data-test-id*="recently"], .recently-joined');
          
          if (nameEl && titleEl && recentEl) {
            recent.push({
              name: nameEl.textContent?.trim() || '',
              title: titleEl.textContent?.trim() || '',
              isRecent: true
            });
          }
        }
        
        return recent;
      });
      
      for (const hire of recentHires) {
        if (this.isValidHire(hire.name, hire.title)) {
          hires.push({
            personName: hire.name,
            company: companyName,
            position: hire.title,
            startDate: new Date(),
            source: 'LinkedIn People',
            confidenceScore: '90'
          });
        }
      }
      
    } catch (error) {
      console.log(`⚠️ Could not scrape LinkedIn people for ${companyName}`);
    } finally {
      await page.close();
    }
    
    return hires;
  }

  private async scrapeSocialMedia(companyName: string): Promise<InsertNewHire[]> {
    // For now, return empty - would need Twitter/Instagram API access
    return [];
  }

  private extractHireFromText(text: string, companyName: string, source: string): InsertNewHire | null {
    // Look for COMPLETED hires, not job postings
    const hirePatterns = [
      /(?:welcome|welcoming)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:to\s+)?(?:our\s+)?(?:team\s+)?as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:has\s+)?joined\s+(?:us\s+)?(?:as\s+)?(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+)/i,
      /(?:excited\s+to\s+announce\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+)\s+as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:has\s+been\s+)?appointed\s+(?:as\s+)?(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+)/i
    ];
    
    // Exclude job posting patterns
    const jobPostingPatterns = [
      /hiring\s+for/i,
      /seeking\s+a/i,
      /looking\s+for/i,
      /apply\s+now/i,
      /job\s+opening/i,
      /position\s+available/i
    ];
    
    // Skip if it's a job posting
    if (jobPostingPatterns.some(pattern => pattern.test(text))) {
      return null;
    }
    
    for (const pattern of hirePatterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1]?.trim();
        const position = match[2]?.trim();
        
        if (this.isValidHire(name, position)) {
          return {
            personName: name,
            company: companyName,
            position: this.cleanPosition(position),
            startDate: new Date(),
            source,
            confidenceScore: '85'
          };
        }
      }
    }
    
    return null;
  }

  private isValidHire(name: string, position: string): boolean {
    if (!name || !position) return false;
    
    // Valid name: 2-3 words, properly capitalized
    const nameWords = name.split(' ');
    if (nameWords.length < 2 || nameWords.length > 3) return false;
    if (!nameWords.every(word => /^[A-Z][a-z]{2,}$/.test(word))) return false;
    
    // Valid position: contains executive/leadership keywords
    const executiveKeywords = ['ceo', 'cto', 'cfo', 'director', 'manager', 'head', 'vice president', 'senior', 'lead'];
    return executiveKeywords.some(keyword => position.toLowerCase().includes(keyword));
  }

  private cleanPosition(position: string): string {
    return position.replace(/^(our|the|a)\s+/i, '').replace(/\s+(team|department).*$/i, '').trim();
  }

  private validateAndDeduplicate(hires: InsertNewHire[]): InsertNewHire[] {
    const seen = new Set();
    return hires.filter(hire => {
      const key = `${hire.personName}-${hire.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}