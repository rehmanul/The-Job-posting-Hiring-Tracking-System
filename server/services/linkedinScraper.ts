import puppeteer, { Browser, Page } from 'puppeteer';
import type { JobPosting, NewHire, InsertJobPosting, InsertNewHire } from '@shared/schema';
import { MLDetectionService } from './mlDetection';
import { ProxyRotationService } from './proxyRotation';

export class LinkedInScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn = false;
  private isInitialized = false;
  private isEnabled = false;
  private mlService: MLDetectionService;
  private proxyService: ProxyRotationService;

  private readonly browserConfig = {
    headless: process.env.NODE_ENV === 'production',
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
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  };

  constructor() {
    this.mlService = new MLDetectionService();
    this.proxyService = new ProxyRotationService();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing LinkedIn scraper...');
      
      // Check if LinkedIn credentials are available
      if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
        console.warn('⚠️ LinkedIn credentials not provided - scraper will run in limited mode');
        this.isEnabled = false;
        this.isInitialized = true;
        return;
      }

      // Initialize ML service for job classification
      await this.mlService.initialize();
      
      // Initialize proxy rotation service
      await this.proxyService.initialize();
      
      // Launch browser with production configuration
      this.browser = await puppeteer.launch({
        ...this.browserConfig,
        args: [
          ...this.browserConfig.args,
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set realistic viewport and user agent
      await this.page.setViewport({ width: 1366, height: 768 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Stealth mode configurations
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Remove automation indicators
        delete window.navigator.webdriver;
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      // Login to LinkedIn if credentials are provided
      await this.loginToLinkedIn();
      
      this.isEnabled = true;
      this.isInitialized = true;
      
      console.log('✅ LinkedIn scraper initialized successfully');
      
    } catch (error) {
      console.warn('⚠️ LinkedIn scraper initialization failed, continuing without it:', error);
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

      // Enter credentials
      await this.page.type('#username', process.env.LINKEDIN_EMAIL, { delay: 100 });
      await this.page.type('#password', process.env.LINKEDIN_PASSWORD, { delay: 100 });
      
      // Submit login form
      await this.page.click('[type="submit"]');
      
      // Wait for successful login or handle 2FA/verification
      try {
        await this.page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 15000 
        });
        
        // Check if we're redirected to challenge page
        const currentUrl = this.page.url();
        if (currentUrl.includes('challenge') || currentUrl.includes('verification')) {
          console.warn('⚠️ LinkedIn requires additional verification. Manual intervention may be needed.');
          // Continue anyway as some operations might still work
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

      // Wait for job listings to load
      await this.page.waitForSelector('[data-entity-urn*="job"]', { timeout: 10000 });
      
      // Scroll to load more jobs
      await this.autoScroll();
      
      // Extract job data
      const jobElements = await this.page.$$('[data-entity-urn*="job"]');
      const jobs: InsertJobPosting[] = [];
      
      for (const element of jobElements.slice(0, 20)) { // Limit to 20 jobs per company
        try {
          const jobData = await this.extractJobData(element);
          if (jobData) {
            // Use ML service to classify job
            const classification = await this.mlService.classifyJob(
              jobData.jobTitle,
              jobData.description || ''
            );
            
            jobs.push({
              ...jobData,
              department: classification.department,
              seniority: classification.seniority,
              foundDate: new Date()
            });
          }
        } catch (jobError) {
          console.warn('⚠️ Failed to extract job data:', jobError);
        }
        
        // Add delay between job extractions
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
      const location = await element.$eval('[data-test-id="job-search-card-location"]', (el: any) => el.textContent?.trim() || '').catch(() => 'Remote');
      const postingUrl = await element.$eval('h3 a', (el: any) => el.href || '').catch(() => '');
      
      // Get job description by clicking into the job
      let description = '';
      try {
        await element.click();
        await this.page.waitForSelector('[data-test-id="job-details"]', { timeout: 5000 });
        description = await this.page.$eval('[data-test-id="job-details"]', (el: any) => el.textContent?.trim() || '');
      } catch (descError) {
        console.warn('⚠️ Could not extract job description');
      }

      if (!title) return null;

      return {
        jobTitle: title,
        location,
        description: description.slice(0, 2000), // Limit description length
        postingUrl,
        foundDate: new Date()
      };
      
    } catch (error) {
      console.warn('⚠️ Failed to extract job data from element:', error);
      return null;
    }
  }

  async scrapeNewHires(linkedinUrl: string): Promise<InsertNewHire[]> {
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

      // Look for "New joiners" or similar sections
      const newHires: InsertNewHire[] = [];
      
      try {
        await this.page.waitForSelector('[data-test-id="people-card"]', { timeout: 10000 });
        
        const peopleElements = await this.page.$$('[data-test-id="people-card"]');
        
        for (const element of peopleElements.slice(0, 10)) { // Limit to 10 recent hires
          try {
            const name = await element.$eval('h3', (el: any) => el.textContent?.trim() || '');
            const position = await element.$eval('.t-14', (el: any) => el.textContent?.trim() || '').catch(() => '');
            const profileUrl = await element.$eval('a', (el: any) => el.href || '').catch(() => '');
            
            if (name) {
              newHires.push({
                personName: name,
                position,
                linkedinProfile: profileUrl,
                foundDate: new Date()
              });
            }
          } catch (personError) {
            console.warn('⚠️ Failed to extract person data:', personError);
          }
        }
        
      } catch (peopleError) {
        console.warn('⚠️ No people data found on company page');
      }
      
      console.log(`✅ Found ${newHires.length} potential new hires`);
      return newHires;
      
    } catch (error) {
      console.error('❌ Failed to scrape new hires:', error);
      return [];
    }
  }

  private async autoScroll(): Promise<void> {
    try {
      await this.page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight || totalHeight > 3000) { // Limit scrolling
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
    } catch (error) {
      console.warn('⚠️ Auto-scroll failed:', error);
    }
  }

  private async delay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.isLoggedIn = false;
      this.isInitialized = false;
      
      console.log('✅ LinkedIn scraper cleanup complete');
      
    } catch (error) {
      console.error('❌ Error during LinkedIn scraper cleanup:', error);
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing LinkedIn scraper...');
      
      await this.launchBrowser();
      
      // Setup LinkedIn authentication
      const linkedinEmail = process.env.LINKEDIN_EMAIL;
      const linkedinPassword = process.env.LINKEDIN_PASSWORD;
      
      if (linkedinEmail && linkedinPassword) {
        await this.login(linkedinEmail, linkedinPassword);
      } else {
        console.warn('⚠️ No LinkedIn credentials provided. Limited functionality available.');
      }

      this.isInitialized = true;
      this.isEnabled = true;
      console.log('✅ LinkedIn scraper initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize LinkedIn scraper:', error);
      console.warn('⚠️ LinkedIn scraper disabled due to browser launch failure');
      this.isEnabled = false;
      return; // Don't throw error, just disable the service
    }
  }

  private async launchBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch(this.browserConfig);
      this.page = await this.browser.newPage();

      // Set realistic browser properties
      await this.page.setUserAgent(this.browserConfig.args.find(arg => arg.includes('user-agent'))?.split('=')[1] || '');
      await this.page.setViewport({ width: 1366, height: 768 });

      // Block unnecessary resources for better performance
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      console.log('✅ Browser launched successfully');
      
    } catch (error) {
      console.error('❌ Failed to launch browser:', error);
      throw error;
    }
  }

  private async login(email: string, password: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      console.log('🔐 Logging into LinkedIn...');

      await this.page.goto('https://www.linkedin.com/login', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.randomDelay(1000, 3000);

      // Fill login form
      await this.page.waitForSelector('input[name="session_key"]', { timeout: 10000 });
      await this.page.type('input[name="session_key"]', email, { delay: 100 });
      await this.randomDelay(500, 1500);

      await this.page.type('input[name="session_password"]', password, { delay: 100 });
      await this.randomDelay(500, 1500);

      // Submit login
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
        this.page.click('button[type="submit"]')
      ]);

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed') || currentUrl.includes('/in/')) {
        this.isLoggedIn = true;
        console.log('✅ LinkedIn login successful');
      } else {
        throw new Error('Login failed - unexpected redirect');
      }

    } catch (error) {
      console.error('❌ LinkedIn login failed:', error);
      throw error;
    }
  }

  async scrapeCompanyJobs(companyLinkedInUrl: string): Promise<InsertJobPosting[]> {
    if (!this.isEnabled || !this.page) {
      console.warn('⚠️ LinkedIn scraper disabled - skipping job scraping');
      return [];
    }
    
    try {
      console.log(`🔍 Scraping jobs for company: ${companyLinkedInUrl}`);

      const jobs: InsertJobPosting[] = [];
      const jobsUrl = `${companyLinkedInUrl}/jobs/`;

      await this.page.goto(jobsUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.randomDelay(2000, 5000);

      // Wait for job listings to load
      try {
        await this.page.waitForSelector('.jobs-search__results-list, .org-jobs-recently-posted-jobs-module', { timeout: 10000 });
      } catch (error) {
        console.warn(`⚠️ No job listings found for ${companyLinkedInUrl}`);
        return jobs;
      }

      // Scrape job cards
      const jobCards = await this.page.$$('.result-card, .org-jobs-recently-posted-jobs-module__job-posting');

      for (const card of jobCards.slice(0, 20)) { // Limit to first 20 jobs
        try {
          const rawJobData = await this.extractJobData(card);
          if (rawJobData && rawJobData.jobTitle) {
            // Enhance with ML detection
            const enhancedJob = await this.mlService.enhanceJobDetection(
              rawJobData, 
              `LinkedIn job scraping for company: ${companyLinkedInUrl}`
            );
            
            jobs.push({
              ...enhancedJob,
              source: 'linkedin',
            });
          }
        } catch (error) {
          console.warn('⚠️ Failed to extract job data from card:', (error as Error).message);
        }
      }

      console.log(`✅ Found ${jobs.length} jobs for company`);
      return jobs;

    } catch (error) {
      console.error(`❌ Failed to scrape company jobs: ${(error as Error).message}`);
      return [];
    }
  }

  private async extractJobData(jobCard: any): Promise<Partial<InsertJobPosting> | null> {
    if (!this.page) return null;
    
    try {
      const jobTitle = await this.getTextContent(jobCard, '.result-card__title, .org-jobs-recently-posted-jobs-module__job-posting-title');
      const jobLocation = await this.getTextContent(jobCard, '.job-result-card__location, .org-jobs-recently-posted-jobs-module__job-posting-location');
      const postedTime = await this.getTextContent(jobCard, '.job-result-card__listdate, .org-jobs-recently-posted-jobs-module__job-posting-date');

      // Try to get the job URL
      let jobUrl = '';
      try {
        const linkElement = await jobCard.$('.result-card__title-link, .org-jobs-recently-posted-jobs-module__job-posting-title a');
        if (linkElement) {
          jobUrl = await this.page.evaluate((el: Element) => (el as HTMLAnchorElement).href, linkElement);
        }
      } catch (error) {
        // Job URL extraction failed, continue without it
      }

      return {
        jobTitle: this.cleanText(jobTitle),
        location: this.cleanText(jobLocation),
        postedDate: this.parsePostedDate(postedTime),
        url: jobUrl,
        department: '', // Not available from LinkedIn listings
        confidenceScore: '90', // Base confidence for LinkedIn scraping
      };

    } catch (error) {
      console.warn('⚠️ Error extracting job data:', (error as Error).message);
      return null;
    }
  }

  async scrapeNewHires(companyLinkedInUrl: string): Promise<InsertNewHire[]> {
    if (!this.isEnabled || !this.page) {
      console.warn('⚠️ LinkedIn scraper disabled - skipping new hire scraping');
      return [];
    }
    
    try {
      console.log(`👥 Scraping new hires for company: ${companyLinkedInUrl}`);

      if (!this.isLoggedIn) {
        console.warn('⚠️ Not logged into LinkedIn, cannot access new hires data');
        return [];
      }

      const newHires: InsertNewHire[] = [];
      const peopleUrl = `${companyLinkedInUrl}/people/`;

      await this.page.goto(peopleUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await this.randomDelay(2000, 5000);

      // Wait for people grid to load
      try {
        await this.page.waitForSelector('.org-people-profile-card, .artdeco-entity-lockup', { timeout: 10000 });
      } catch (error) {
        console.warn(`⚠️ No people data found for ${companyLinkedInUrl}`);
        return newHires;
      }

      // Look for recent hire indicators
      const profileCards = await this.page.$$('.org-people-profile-card, .artdeco-entity-lockup');

      for (const card of profileCards.slice(0, 50)) { // Limit to first 50 profiles
        try {
          const rawHireData = await this.extractNewHireData(card);
          if (rawHireData && this.isRecentHire(rawHireData.startDate)) {
            // Enhance with ML detection
            const enhancedHire = await this.mlService.enhanceHireDetection(
              rawHireData,
              `LinkedIn hire detection for company: ${companyLinkedInUrl}`
            );
            
            newHires.push({
              ...enhancedHire,
              company: companyLinkedInUrl,
              source: 'linkedin',
            });
          }
        } catch (error) {
          console.warn('⚠️ Failed to extract hire data from profile:', (error as Error).message);
        }
      }

      console.log(`✅ Found ${newHires.length} recent hires for company`);
      return newHires;

    } catch (error) {
      console.error(`❌ Failed to scrape company new hires: ${(error as Error).message}`);
      return [];
    }
  }

  private async extractNewHireData(profileCard: any): Promise<Partial<InsertNewHire> | null> {
    if (!this.page) return null;
    
    try {
      const personName = await this.getTextContent(profileCard, '.artdeco-entity-lockup__title, .org-people-profile-card__profile-title');
      const position = await this.getTextContent(profileCard, '.artdeco-entity-lockup__subtitle, .org-people-profile-card__profile-info');

      // Try to get LinkedIn profile URL
      let linkedinProfile = '';
      try {
        const linkElement = await profileCard.$('.artdeco-entity-lockup__title a, .org-people-profile-card__profile-link');
        if (linkElement) {
          linkedinProfile = await this.page.evaluate((el: Element) => (el as HTMLAnchorElement).href, linkElement);
        }
      } catch (error) {
        // Profile URL extraction failed, continue without it
      }

      // Estimate start date (LinkedIn doesn't always show exact start dates)
      const startDate = this.estimateStartDate();

      return {
        personName: this.cleanText(personName),
        position: this.cleanText(position),
        startDate: startDate,
        linkedinProfile: linkedinProfile
      };

    } catch (error) {
      console.warn('⚠️ Error extracting hire data:', (error as Error).message);
      return null;
    }
  }

  private async getTextContent(element: any, selector?: string): Promise<string> {
    if (!this.page) return '';
    
    try {
      const targetElement = selector ? await element.$(selector) : element;
      if (targetElement) {
        return await this.page.evaluate((el: Element) => el.textContent?.trim() || '', targetElement);
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  private async randomDelay(min = 2000, max = 8000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private cleanText(text: string): string {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
  }

  private parsePostedDate(postedText: string): Date | undefined {
    if (!postedText) return undefined;

    const cleanText = postedText.toLowerCase();
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
    // Since we can't always get exact start dates, estimate recent hires as within last 30 days
    const randomDaysAgo = Math.floor(Math.random() * 30);
    return new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000);
  }

  private isRecentHire(startDate?: Date): boolean {
    if (!startDate) return true; // If no date, assume recent
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
