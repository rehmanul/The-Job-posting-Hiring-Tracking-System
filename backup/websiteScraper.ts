import puppeteer, { Browser, Page } from 'puppeteer';
import type { InsertJobPosting, Company } from '@shared/schema';
import { GeminiService } from './geminiService';
import { ProxyRotationService } from './proxyRotation';

interface WebsiteScrapingConfig {
  company: Company;
  selectors: {
    jobContainer: string;
    title: string;
    location?: string;
    department?: string;
    description?: string;
    url?: string;
    postedDate?: string;
  };
  pagination?: {
    nextButton: string;
    maxPages: number;
  };
  waitConditions?: {
    selector: string;
    timeout: number;
  }[];
}

export class WebsiteScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private geminiService: GeminiService;
  private proxyService: ProxyRotationService;

  private readonly browserConfig = {
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
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
      console.log('🌐 Initializing Website Scraper...');

      await this.geminiService.initialize();
      await this.proxyService.initialize();

      this.browser = await puppeteer.launch(this.browserConfig);
      this.page = await this.browser.newPage();

      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Anti-detection measures
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Override the plugins property to use a custom getter
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Pass the chrome test
        window.chrome = {
          runtime: {},
        };

        // Pass the permissions test
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      this.isInitialized = true;
      console.log('✅ Website Scraper initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Website Scraper:', error);
      this.isInitialized = false;

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  async scrapeCompanyWebsite(company: Company): Promise<InsertJobPosting[]> {
    if (!this.isInitialized || !this.page || !company.careerPageUrl) {
      console.warn(`⚠️ Website scraper not available or no career page URL for ${company.name}`);
      return [];
    }

    try {
      console.log(`🔍 Scraping jobs from ${company.name}: ${company.careerPageUrl}`);
      
      // Navigate with shorter timeout
      await this.page.goto(company.careerPageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Wait for content to load
      await this.delay(3000, 5000);
      
      // Scroll to load dynamic content
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.delay(2000, 3000);

      // Extract job links using comprehensive selectors
      const jobs = await this.page.evaluate((companyName) => {
        const jobKeywords = [
          'engineer', 'developer', 'manager', 'analyst', 'specialist',
          'coordinator', 'director', 'lead', 'senior', 'junior',
          'architect', 'consultant', 'designer', 'scientist'
        ];
        
        const skipKeywords = [
          'apply', 'view all', 'home', 'about', 'contact', 'privacy',
          'terms', 'cookie', 'back to', 'return to'
        ];
        
        const links = Array.from(document.querySelectorAll('a'));
        const jobLinks: any[] = [];
        
        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          if (text.length >= 10 && text.length <= 150 &&
              jobKeywords.some(kw => text.toLowerCase().includes(kw)) &&
              !skipKeywords.some(skip => text.toLowerCase().includes(skip))) {
            
            jobLinks.push({
              title: text,
              url: href,
              location: 'Remote',
              department: 'General'
            });
          }
        });
        
        // Also check other elements for job titles
        const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span'));
        elements.forEach(elem => {
          const text = elem.textContent?.trim() || '';
          
          if (text.length >= 10 && text.length <= 100 &&
              jobKeywords.some(kw => text.toLowerCase().includes(kw)) &&
              !skipKeywords.some(skip => text.toLowerCase().includes(skip)) &&
              jobLinks.length < 25) {
            
            const parentLink = elem.closest('a');
            const href = parentLink?.href || window.location.href;
            
            jobLinks.push({
              title: text,
              url: href,
              location: 'Remote',
              department: 'General'
            });
          }
        });
        
        return jobLinks.slice(0, 25); // Limit to 25 jobs
      }, company.name);

      // Convert to InsertJobPosting format
      const jobPostings: InsertJobPosting[] = jobs.map(job => ({
        company: company.name,
        jobTitle: job.title,
        location: job.location,
        department: job.department,
        postedDate: new Date(),
        url: job.url,
        confidenceScore: '90',
        source: 'career_page'
      }));

      console.log(`✅ Found ${jobPostings.length} jobs for ${company.name}`);
      return jobPostings;

    } catch (error) {
      console.error(`❌ Failed to scrape website for ${company.name}:`, error);
      return [];
    }
  }

  private async extractJobsFromLinkedInAPI(companyId: string): Promise<InsertJobPosting[]> {
    // Placeholder for LinkedIn API integration
    // This would use LinkedIn's official API endpoints
    console.log(`🔗 LinkedIn API integration needed for company: ${companyId}`);
    return [];
  }

  private async extractJobsFromPage(company: Company, config: WebsiteScrapingConfig): Promise<InsertJobPosting[]> {
    if (!this.page) return [];

    try {
      const jobElements = await this.page.$$(config.selectors.jobContainer);
      const jobs: InsertJobPosting[] = [];

      for (const element of jobElements) {
        try {
          const jobData = await this.extractJobDataFromElement(element, config, company.name);
          if (jobData) {
            // Use ML service to classify and enhance job data
            const classification = await this.geminiService.classifyJob(
              jobData.jobTitle,
              jobData.url || ''
            );

            jobs.push({
              ...jobData,
              department: classification.department || null,
              confidenceScore: classification.confidence ? (classification.confidence * 100).toString() : '90'
            });
          }
        } catch (jobError) {
          console.warn('⚠️ Failed to extract individual job data:', jobError);
        }
      }

      return jobs;

    } catch (error) {
      console.error('❌ Failed to extract jobs from page:', error);
      return [];
    }
  }

  private async extractJobDataFromElement(
    element: any,
    config: WebsiteScrapingConfig,
    companyName: string
  ): Promise<InsertJobPosting | null> {
    try {
      const title = await this.safeExtractText(element, config.selectors.title);
      if (!title) return null;

      const location = config.selectors.location 
        ? await this.safeExtractText(element, config.selectors.location)
        : null;

      const department = config.selectors.department
        ? await this.safeExtractText(element, config.selectors.department)
        : null;

      const url = await this.safeExtractAttribute(element, 'a', 'href');

      return {
        company: companyName,
        jobTitle: title.trim(),
        location: location?.trim() || null,
        department: department?.trim() || null,
        postedDate: new Date(), // Current scrape time as posted date
        url: url ? this.absoluteUrl(url, config.company.careerPageUrl || '') : null,
        confidenceScore: '90', // High confidence for direct website scraping
        source: 'website'
      };

    } catch (error) {
      console.warn('⚠️ Error extracting job data from element:', error);
      return null;
    }
  }

  private async safeExtractText(element: any, selector: string): Promise<string | null> {
    try {
      return await element.$eval(selector, (el: Element) => el.textContent?.trim() || '');
    } catch {
      // Try direct text extraction if selector fails
      try {
        return await element.evaluate((el: Element, sel: string) => {
          const target = el.querySelector(sel) || el;
          return target.textContent?.trim() || '';
        }, selector);
      } catch {
        return null;
      }
    }
  }

  private async safeExtractAttribute(
    element: any,
    selector: string,
    attribute: string
  ): Promise<string | null> {
    try {
      return await element.$eval(selector, (el: Element, attr: string) => 
        el.getAttribute(attr), attribute);
    } catch {
      return null;
    }
  }

  private absoluteUrl(relativeUrl: string, baseUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  private async goToNextPage(nextButtonSelector: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      const nextButton = await this.page.$(nextButtonSelector);
      if (!nextButton) return false;

      // Check if button is enabled/clickable
      const isDisabled = await nextButton.evaluate(el => 
        el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
      );

      if (isDisabled) return false;

      await nextButton.click();
      await this.page.waitForNavigation({ 
        waitUntil: 'networkidle2', 
        timeout: 10000 
      }).catch(() => {
        // Navigation might not be needed for SPA
      });

      return true;

    } catch (error) {
      console.warn('⚠️ Failed to navigate to next page:', error);
      return false;
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
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
      }
      if (this.browser) {
        await this.browser.close();
      }
      console.log('🧹 Website scraper cleanup complete');
    } catch (error) {
      console.error('❌ Error during website scraper cleanup:', error);
    }
  }
}