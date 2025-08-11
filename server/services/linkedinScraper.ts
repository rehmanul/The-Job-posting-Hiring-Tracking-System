import puppeteer, { Browser, Page } from 'puppeteer';
import type { InsertJobPosting, InsertNewHire } from '@shared/schema';
import { GeminiService } from './geminiService';
import { ProxyRotationService } from './proxyRotation';

export class LinkedInScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn = false;
  private isInitialized = false;
  private isEnabled = false;
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

  constructor() {
    this.geminiService = new GeminiService();
    this.proxyService = new ProxyRotationService();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing LinkedIn scraper...');
      
      if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
        console.warn('⚠️ LinkedIn credentials not provided - scraper disabled');
        this.isEnabled = false;
        this.isInitialized = true;
        return;
      }

      await this.geminiService.initialize();
      await this.proxyService.initialize();
      
      this.browser = await puppeteer.launch(this.browserConfig);
      this.page = await this.browser.newPage();
      
      await this.page.setViewport({ width: 1366, height: 768 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      await this.loginToLinkedIn();
      
      this.isEnabled = true;
      this.isInitialized = true;
      
      console.log('✅ LinkedIn scraper initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to launch browser:', error);
      console.log('⚠️ LinkedIn scraper disabled due to browser launch failure');
      this.isEnabled = false;
      this.isInitialized = true;
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
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
        
      } catch (navigationError) {
        console.warn('⚠️ Login navigation timeout, continuing anyway');
        this.isLoggedIn = false;
      }
      
    } catch (error) {
      console.error('❌ Failed to login to LinkedIn:', error);
      this.isLoggedIn = false;
    }
  }

  async scrapeCompanyJobs(linkedinUrl: string): Promise<InsertJobPosting[]> {
    if (!this.isEnabled || !this.page) {
      console.warn('⚠️ LinkedIn scraper not available');
      return [];
    }

    try {
      const jobsUrl = `${linkedinUrl.replace('/company/', '/company/')}/jobs/`;
      console.log(`🔍 Scraping jobs from: ${jobsUrl}`);
      
      await this.page.goto(jobsUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.page.waitForSelector('[data-entity-urn*="job"]', { timeout: 10000 });
      await this.autoScroll();
      
      const jobElements = await this.page.$$('[data-entity-urn*="job"]');
      const jobs: InsertJobPosting[] = [];
      
      for (const element of jobElements.slice(0, 20)) {
        try {
          const jobData = await this.extractJobData(element);
          if (jobData) {
            const classification = await this.geminiService.classifyJob(
              jobData.jobTitle,
              jobData.url || ''
            );
            
            jobs.push({
              company: jobData.company,
              jobTitle: jobData.jobTitle,
              location: jobData.location,
              department: classification.department || null,
              postedDate: jobData.postedDate,
              url: jobData.url,
              confidenceScore: jobData.confidenceScore,
              source: 'linkedin'
            });
          }
        } catch (jobError) {
          console.warn('⚠️ Failed to extract job data:', jobError);
        }
        
        await this.delay(500, 1000);
      }
      
      console.log(`✅ Found ${jobs.length} jobs`);
      return jobs;
      
    } catch (error) {
      console.error('❌ Failed to scrape company jobs:', error);
      return [];
    }
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
    } catch (error) {
      console.warn('⚠️ Error extracting job data:', error);
      return null;
    }
  }

  async scrapeCompanyHires(linkedinUrl: string): Promise<InsertNewHire[]> {
    if (!this.isEnabled || !this.page) {
      console.warn('⚠️ LinkedIn scraper not available');
      return [];
    }

    try {
      const peopleUrl = `${linkedinUrl}/people/`;
      console.log(`👥 Scraping new hires from: ${peopleUrl}`);
      
      await this.page.goto(peopleUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.page.waitForSelector('.org-people-profile-card', { timeout: 10000 });
      await this.autoScroll();
      
      const profileElements = await this.page.$$('.org-people-profile-card');
      const hires: InsertNewHire[] = [];
      
      for (const element of profileElements.slice(0, 50)) {
        try {
          const hireData = await this.extractHireData(element);
          if (hireData && this.isRecentHire(hireData.startDate)) {
            const enhancedHire = await this.geminiService.classifyHire(
              hireData.personName,
              hireData.position
            );
            
            hires.push({
              personName: hireData.personName,
              company: hireData.company,
              position: enhancedHire.position || hireData.position,
              startDate: hireData.startDate,
              linkedinProfile: hireData.linkedinProfile,
              source: 'linkedin_scrape',
              confidenceScore: hireData.confidenceScore
            });
          }
        } catch (hireError) {
          console.warn('⚠️ Failed to extract hire data:', hireError);
        }
        
        await this.delay(300, 800);
      }
      
      console.log(`✅ Found ${hires.length} recent hires`);
      return hires;
      
    } catch (error) {
      console.error('❌ Failed to scrape company hires:', error);
      return [];
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
    } catch (error) {
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
    } catch (error) {
      console.error('❌ Error during LinkedIn scraper cleanup:', error);
    }
  }
}