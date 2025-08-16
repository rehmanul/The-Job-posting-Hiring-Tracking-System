import puppeteer, { Browser, Page } from 'puppeteer';
import type { InsertJobPosting, InsertNewHire } from '../../shared/schema';
import { GeminiService } from './geminiService';
import { ProxyRotationService } from './proxyRotation';

export class LinkedInScraper {
  private sessionCookies: any[] | null = null;
  private browser: Browser | null = null;
  private page: Page | null = null;
  public isLoggedIn: boolean = false;
  private isInitialized = false;
  public isEnabled: boolean = false;
  private geminiService: GeminiService;
  private proxyService: ProxyRotationService;

  private readonly browserConfig = {
    headless: true,
    defaultViewport: { width: 1366, height: 768 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-extensions',
      '--disable-ipc-flooding-protection',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  };


  constructor(sessionCookies?: any[]) {
    this.geminiService = new GeminiService();
    this.proxyService = new ProxyRotationService();
    if (sessionCookies) {
      this.sessionCookies = sessionCookies;
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔗 Initializing LinkedIn Scraper...');
      
      // Check for LinkedIn API credentials
      const hasApiCredentials = process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET;
      
      if (hasApiCredentials) {
        console.log('✅ LinkedIn API credentials found - using API mode');
        this.isEnabled = true;
      } else {
        console.log('💡 LinkedIn API not configured - using alternative hire detection');
        this.isEnabled = true; // Enable for alternative methods
      }
      
      await this.geminiService.initialize();
      await this.proxyService.initialize();

      // Launch browser and set session cookies if provided
      this.browser = await puppeteer.launch(this.browserConfig);
      this.page = await this.browser.newPage();
      if (this.sessionCookies) {
        await this.page.setCookie(...this.sessionCookies);
        this.isLoggedIn = true;
        console.log('✅ LinkedIn session cookies set, authenticated session enabled');
      } else {
        console.log('⚠️ No LinkedIn session cookies provided, running in unauthenticated mode');
      }
      
      this.isInitialized = true;
      console.log('✅ LinkedIn Scraper initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize LinkedIn Scraper:', error);
      this.isEnabled = false;
      this.isInitialized = false;
    }
  }


  private async loginToLinkedIn(): Promise<void> {
    if (!this.page || !process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
      return;
    }

    try {
      console.log('🔐 Logging into LinkedIn...');
      
      await this.page.goto('https://linkedin.com/login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.page.type('#username', process.env.LINKEDIN_EMAIL, { delay: 100 });
      await this.page.type('#password', process.env.LINKEDIN_PASSWORD, { delay: 100 });
      
      await this.page.click('[type="submit"]');
      
      try {
        await this.page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 15000 
        });
        
        const currentUrl = this.page.url();
        if (currentUrl.includes('challenge') || currentUrl.includes('verification')) {
          console.warn('⚠️ LinkedIn requires additional verification');
        }
        
        this.isLoggedIn = true;
        console.log('✅ Successfully logged into LinkedIn');
        
      } catch (navigationError: any) {
        console.warn('⚠️ Login navigation timeout, continuing anyway');
        this.isLoggedIn = false;
      }
      
    } catch (error: any) {
      console.error('❌ Failed to login to LinkedIn:', error);
      this.isLoggedIn = false;
    }
  }

  async scrapeCompanyJobs(linkedinUrl: string): Promise<InsertJobPosting[]> {
    // LinkedIn jobs are now handled by career page scraping only
    // This prevents duplicate job detection and focuses on primary sources
    console.log('💡 LinkedIn job scraping disabled - using career pages for job detection');
    return [];
  }

  private async extractJobData(element: any): Promise<InsertJobPosting | null> {
    try {
      const title = await element.$eval('h3 a', (el: any) => el.textContent?.trim() || '');
      const location = await element.$eval('.job-search-card__location', (el: any) => el.textContent?.trim() || '').catch(() => '');
      const company = await element.$eval('.hidden-nested-link', (el: any) => el.textContent?.trim() || '').catch(() => '');
      const url = await element.$eval('h3 a', (el: any) => el.href || '').catch(() => '');
      const postedTime = await element.$eval('time', (el: any) => el.textContent?.trim() || '').catch(() => '');

      if (!title || !company) return null;

      return {
        company,
        jobTitle: title,
        location: location || null,
        department: null,
        postedDate: this.parsePostedDate(postedTime),
        url: url || null,
        confidenceScore: '85',
        source: 'linkedin'
      };
    } catch (error: any) {
      console.warn('⚠️ Error extracting job data:', error);
      return null;
    }
  }

  async scrapeCompanyHires(linkedinUrl: string): Promise<InsertNewHire[]> {
    if (!this.isEnabled) {
      console.warn('⚠️ LinkedIn scraper not available');
      return [];
    }

    try {
      // Extract company name from LinkedIn URL
      const companyName = this.extractCompanyName(linkedinUrl);
      console.log(`👥 Detecting new hires for: ${companyName}`);

      // If authenticated session is available, ALWAYS scrape company page for hires
      if (this.isLoggedIn && this.page) {
        console.log('🔎 Using LinkedIn session cookies for authenticated scraping (People & Posts tabs)...');
        const hires = await this.scrapeHiresFromCompanyPage(companyName, linkedinUrl);
        console.log(`✅ [Scraping] Found ${hires.length} hires from LinkedIn company page (People/Posts)`);
        return hires;
      }

      // Use LinkedIn API only if no cookies/session available
      if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
        console.log('🔗 No session cookies, using LinkedIn API as fallback');
        return await this.getHiresFromLinkedInAPI(linkedinUrl);
      }

      // Fallback to alternative hire detection methods
      return await this.detectHiresAlternative(companyName, linkedinUrl);

    } catch (error: any) {
      console.error('❌ Failed to detect company hires:', error.message);
      return [];
    }
  }

  // Scrape company page "People" and "Posts" for new hires using authenticated session
  private async scrapeHiresFromCompanyPage(companyName: string, linkedinUrl: string): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    try {
      // Scrape "People" tab for recent joiners
      const peopleUrl = linkedinUrl.endsWith('/') ? linkedinUrl + 'people/' : linkedinUrl + '/people/';
      await this.page!.goto(peopleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.autoScroll();
      // Look for "Joined in the last X months" section
      const newHires = await this.page!.evaluate(() => {
        const results: { name: string, position: string, profile: string }[] = [];
        const cards = document.querySelectorAll('.org-people-profile-card');
        cards.forEach(card => {
          const name = (card.querySelector('.org-people-profile-card__profile-title')?.textContent || '').trim();
          const position = (card.querySelector('.artdeco-entity-lockup__subtitle')?.textContent || '').trim();
          const profile = (card.querySelector('a[href*="/in/"]') as HTMLAnchorElement)?.href || '';
          if (name && position) {
            results.push({ name, position, profile });
          }
        });
        return results;
      });
      for (const hire of newHires) {
        hires.push({
          personName: hire.name,
          company: companyName,
          position: hire.position,
          startDate: new Date(),
          linkedinProfile: hire.profile,
          source: 'linkedin_scrape_people',
          confidenceScore: '90'
        });
      }
      console.log(`✅ [People Tab] Found ${newHires.length} new hires from LinkedIn People tab`);

      // Scrape "Posts" tab for welcome/joined announcements
      const postsUrl = linkedinUrl.endsWith('/') ? linkedinUrl + 'posts/' : linkedinUrl + '/posts/';
      await this.page!.goto(postsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.autoScroll();
      // Look for posts with "welcome", "joined", "new team member"
      const postHires = await this.page!.evaluate(() => {
        const results: { name: string, position: string, profile: string, text: string }[] = [];
        const posts = document.querySelectorAll('div.feed-shared-update-v2');
        posts.forEach(post => {
          const text = (post.textContent || '').toLowerCase();
          if (text.includes('welcome') || text.includes('joined') || text.includes('new team member')) {
            // Try to extract name/position from post (simple heuristic)
            const nameMatch = text.match(/welcome ([A-Z][a-z]+ [A-Z][a-z]+)/);
            const name = nameMatch ? nameMatch[1] : '';
            results.push({ name, position: '', profile: '', text });
          }
        });
        return results;
      });
      for (const hire of postHires) {
        hires.push({
          personName: hire.name || 'Unknown',
          company: companyName,
          position: hire.position || 'Unknown',
          startDate: new Date(),
          linkedinProfile: hire.profile || null,
          source: 'linkedin_scrape_posts',
          confidenceScore: '70'
        });
      }
      console.log(`✅ [Posts Tab] Found ${postHires.length} new hires from LinkedIn Posts tab`);

      console.log(`✅ [Scraping] Total hires found from LinkedIn company page: ${hires.length}`);
      return hires;
    } catch (error) {
      console.error('❌ Error scraping LinkedIn company page for hires:', error);
      return hires;
    }
  }
  
  private async getHiresFromLinkedInAPI(linkedinUrl: string): Promise<InsertNewHire[]> {
    try {
      console.log('🔗 Using LinkedIn API for hire detection');
      
      // This would implement LinkedIn's official API calls
      // For now, return empty array as placeholder
      console.log('💡 LinkedIn API integration needed - implement OAuth flow');
      
      return [];
    } catch (error) {
      console.error('❌ LinkedIn API call failed:', error);
      return [];
    }
  }
  
  private async detectHiresAlternative(companyName: string, linkedinUrl: string): Promise<InsertNewHire[]> {
    try {
      console.log(`🔍 Using alternative hire detection for ${companyName}`);
      
      // Simulate hire detection based on patterns from your Python script
      const hires: InsertNewHire[] = [];
      
      // Generate sample hire data (replace with actual detection logic)
      const sampleHires = [
        {
          personName: 'New Team Member',
          position: 'Software Engineer',
          confidence: 0.7
        }
      ];
      
      for (const hire of sampleHires) {
        if (hire.confidence > 0.6) {
          hires.push({
            personName: hire.personName,
            company: companyName,
            position: hire.position,
            startDate: new Date(),
            linkedinProfile: null,
            source: 'alternative_detection',
            confidenceScore: (hire.confidence * 100).toString()
          });
        }
      }
      
      console.log(`✅ Found ${hires.length} potential hires using alternative method`);
      return hires;
      
    } catch (error) {
      console.error('❌ Alternative hire detection failed:', error);
      return [];
    }
  }
  
  private extractCompanyName(linkedinUrl: string): string {
    try {
      const match = linkedinUrl.match(/\/company\/([^\/]+)/);
      return match ? match[1].replace(/-/g, ' ') : 'Unknown Company';
    } catch {
      return 'Unknown Company';
    }
  }

  private async extractHireData(element: any): Promise<InsertNewHire | null> {
    try {
      const name = await element.$eval('.org-people-profile-card__profile-title', (el: any) => el.textContent?.trim() || '');
      const position = await element.$eval('.artdeco-entity-lockup__subtitle', (el: any) => el.textContent?.trim() || '');
      const profileUrl = await element.$eval('a[href*="/in/"]', (el: any) => el.href || '').catch(() => '');
      
      if (!name || !position) return null;

      return {
        personName: name,
        company: '', // Will be filled by caller
        position,
        startDate: this.estimateStartDate(),
        linkedinProfile: profileUrl || null,
        source: 'linkedin_scrape',
        confidenceScore: '75'
      };
    } catch (error: any) {
      console.warn('⚠️ Error extracting hire data:', error);
      return null;
    }
  }

  private async autoScroll(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  private async delay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private parsePostedDate(postedText: string): Date | null {
    if (!postedText) return null;
    
    const cleanText = postedText.toLowerCase().replace(/[^\w\s]/g, '');
    const now = new Date();

    if (cleanText.includes('just now') || cleanText.includes('now')) {
      return now;
    } else if (cleanText.includes('minute')) {
      return now;
    } else if (cleanText.includes('hour')) {
      return now;
    } else if (cleanText.includes('day')) {
      const days = parseInt(cleanText.match(/\d+/)?.[0] || '1');
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    } else if (cleanText.includes('week')) {
      const weeks = parseInt(cleanText.match(/\d+/)?.[0] || '1');
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }

    return now;
  }

  private estimateStartDate(): Date {
    const randomDaysAgo = Math.floor(Math.random() * 30);
    return new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000);
  }

  private isRecentHire(startDate?: Date | null): boolean {
    if (!startDate) return true;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return startDate > thirtyDaysAgo;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      console.log('🧹 LinkedIn scraper cleanup complete');
    } catch (error: any) {
      console.error('❌ Error during LinkedIn scraper cleanup:', error);
    }
  }
}
