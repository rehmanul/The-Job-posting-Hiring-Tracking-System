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
      const config = this.generateScrapingConfig(company);
      console.log(`🔍 Scraping jobs from ${company.name} website: ${company.careerPageUrl}`);

      const jobs: InsertJobPosting[] = [];
      let currentPage = 1;
      const maxPages = config.pagination?.maxPages || 5;

      do {
        console.log(`📄 Scraping page ${currentPage} for ${company.name}`);

        await this.page.goto(company.careerPageUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for specific conditions if defined
        if (config.waitConditions) {
          for (const condition of config.waitConditions) {
            await this.page.waitForSelector(condition.selector, { 
              timeout: condition.timeout 
            }).catch(() => {
              console.warn(`⚠️ Wait condition not met: ${condition.selector}`);
            });
          }
        }

        // Wait for job listings to load
        await this.page.waitForSelector(config.selectors.jobContainer, { timeout: 10000 })
          .catch(() => {
            console.warn(`⚠️ Job container not found: ${config.selectors.jobContainer}`);
          });

        // Extract jobs from current page
        const pageJobs = await this.extractJobsFromPage(company, config);
        jobs.push(...pageJobs);

        console.log(`✅ Found ${pageJobs.length} jobs on page ${currentPage}`);

        // Check if we should continue to next page
        if (config.pagination && currentPage < maxPages) {
          const hasNextPage = await this.goToNextPage(config.pagination.nextButton);
          if (!hasNextPage) break;
          currentPage++;
          await this.delay(2000, 5000); // Delay between pages
        } else {
          break;
        }

      } while (currentPage <= maxPages);

      console.log(`✅ Total jobs found for ${company.name}: ${jobs.length}`);
      return jobs;

    } catch (error) {
      console.error(`❌ Failed to scrape website for ${company.name}:`, error);
      return [];
    }
  }

  private generateScrapingConfig(company: Company): WebsiteScrapingConfig {
    // Dynamic scraping configuration based on company domain
    const domain = this.extractDomain(company.careerPageUrl || company.website || '');
    
    // Common selectors that work across many career sites
    const commonSelectors = {
      jobContainer: [
        '[data-testid*="job"]',
        '.job-listing',
        '.job-item',
        '.position',
        '.career-opening',
        '.job-card',
        '.job-post',
        '.vacancy',
        'article[data-job]',
        '.job'
      ],
      title: [
        'h1', 'h2', 'h3',
        '[data-testid*="title"]',
        '.job-title',
        '.position-title',
        '.title',
        'a[href*="job"]'
      ],
      location: [
        '[data-testid*="location"]',
        '.location',
        '.job-location',
        '.office',
        '.city'
      ],
      department: [
        '[data-testid*="department"]',
        '.department',
        '.team',
        '.category'
      ]
    };

    // Domain-specific configurations for popular job platforms
    const domainConfigs: Record<string, Partial<WebsiteScrapingConfig>> = {
      'greenhouse.io': {
        selectors: {
          jobContainer: '.opening',
          title: 'a',
          location: '.location',
          department: '.department'
        }
      },
      'lever.co': {
        selectors: {
          jobContainer: '.posting',
          title: 'h5 a',
          location: '.sort-by-location .posting-category',
          department: '.sort-by-team .posting-category'
        }
      },
      'workday.com': {
        selectors: {
          jobContainer: '[data-automation-id="jobPostingItem"]',
          title: '[data-automation-id="jobPostingTitle"]',
          location: '[data-automation-id="jobPostingLocation"]'
        }
      },
      'bamboohr.com': {
        selectors: {
          jobContainer: '.BambooHR-ATS-Jobs-Item',
          title: '.BambooHR-ATS-Jobs-Item-Title a',
          location: '.BambooHR-ATS-Jobs-Item-Location'
        }
      },
      'smartrecruiters.com': {
        selectors: {
          jobContainer: '.opening-job',
          title: '.job-title a',
          location: '.job-location',
          department: '.job-department'
        }
      }
    };

    // Check if we have a specific configuration for this domain
    const specificConfig = domainConfigs[domain];
    
    if (specificConfig) {
      return {
        company,
        ...specificConfig,
        selectors: {
          jobContainer: specificConfig.selectors?.jobContainer || commonSelectors.jobContainer[0],
          title: specificConfig.selectors?.title || commonSelectors.title[0],
          location: specificConfig.selectors?.location,
          department: specificConfig.selectors?.department,
        }
      };
    }

    // Fallback to common selectors
    return {
      company,
      selectors: {
        jobContainer: commonSelectors.jobContainer[0],
        title: commonSelectors.title[0],
        location: commonSelectors.location[0],
        department: commonSelectors.department[0]
      },
      pagination: {
        nextButton: 'button[aria-label*="next"], .next, .pagination-next, [data-testid*="next"]',
        maxPages: 3
      },
      waitConditions: [
        { selector: 'body', timeout: 10000 }
      ]
    };
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
            const classification = await this.mlService.classifyJob(
              jobData.jobTitle,
              jobData.url || ''
            );

            jobs.push({
              ...jobData,
              department: classification.department,
              confidenceScore: (classification.confidence * 100).toString()
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