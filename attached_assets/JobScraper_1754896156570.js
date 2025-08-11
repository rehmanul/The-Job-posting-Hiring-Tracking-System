const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const axios = require('axios');
const winston = require('winston');
const moment = require('moment');

// Use stealth plugin for anti-detection
puppeteer.use(StealthPlugin());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/job-scraper.log' })
  ]
});

class JobScraper {
  constructor() {
    this.browser = null;
    this.isInitialized = false;

    // Rate limiting
    this.requestDelay = parseInt(process.env.MIN_DELAY_MS) || 2000;
    this.maxDelay = parseInt(process.env.MAX_DELAY_MS) || 8000;

    // Browser configuration
    this.browserConfig = {
      headless: process.env.HEADLESS_MODE === 'true' || process.env.DOCKER_ENV === 'true',
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
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    };

    // Common job-related selectors and patterns
    this.jobSelectors = {
      generic: [
        '[class*="job"]',
        '[class*="position"]',
        '[class*="career"]',
        '[class*="opening"]',
        '[class*="vacancy"]',
        '.role',
        '.opportunity'
      ],
      title: [
        '[class*="job-title"]',
        '[class*="position-title"]',
        '[class*="role-title"]',
        'h1', 'h2', 'h3',
        '.title',
        '[class*="heading"]'
      ],
      location: [
        '[class*="location"]',
        '[class*="city"]',
        '[class*="office"]',
        '[class*="remote"]'
      ],
      department: [
        '[class*="department"]',
        '[class*="team"]',
        '[class*="division"]'
      ],
      date: [
        '[class*="date"]',
        '[class*="posted"]',
        '[class*="publish"]',
        'time'
      ]
    };

    // Keywords that indicate job postings
    this.jobKeywords = [
      'apply now', 'apply here', 'job opening', 'position available',
      'we are hiring', 'join our team', 'career opportunity', 'vacancy',
      'employment', 'full time', 'part time', 'contract', 'internship',
      'remote', 'on-site', 'hybrid'
    ];

    // Common career page patterns
    this.careerPagePatterns = [
      '/careers', '/jobs', '/opportunities', '/positions', '/employment',
      '/work-with-us', '/join-us', '/team', '/people'
    ];
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Job scraper...');

      this.browser = await puppeteer.launch(this.browserConfig);

      this.isInitialized = true;
      logger.info('✅ Job scraper initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Job scraper:', error);
      throw error;
    }
  }

  async scrapeCompanyWebsite(websiteUrl, careerPageUrl) {
    try {
      logger.info(`🔍 Scraping jobs from website: ${websiteUrl}`);

      const jobs = [];
      const urlsToScrape = [websiteUrl];

      // Add career page URL if different from main website
      if (careerPageUrl && careerPageUrl !== websiteUrl) {
        urlsToScrape.push(careerPageUrl);
      } else {
        // Try to find career page automatically
        const discoveredCareerUrls = await this.findCareerPages(websiteUrl);
        urlsToScrape.push(...discoveredCareerUrls);
      }

      // Scrape each URL
      for (const url of urlsToScrape) {
        try {
          const pageJobs = await this.scrapePage(url);
          jobs.push(...pageJobs);
          await this.randomDelay();
        } catch (error) {
          logger.warn(`⚠️ Failed to scrape ${url}: ${error.message}`);
        }
      }

      // Deduplicate jobs
      const uniqueJobs = this.deduplicateJobs(jobs);

      logger.info(`✅ Found ${uniqueJobs.length} unique jobs from website`);
      return uniqueJobs;

    } catch (error) {
      logger.error(`❌ Failed to scrape company website ${websiteUrl}: ${error.message}`);
      return [];
    }
  }

  async findCareerPages(websiteUrl) {
    try {
      logger.info(`🔍 Looking for career pages on ${websiteUrl}`);

      const careerUrls = [];
      const page = await this.browser.newPage();

      try {
        // Set realistic browser properties
        await this.setupPage(page);

        await page.goto(websiteUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });

        // Extract all links
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href]')).map(link => ({
            href: link.href,
            text: link.textContent.trim().toLowerCase()
          }));
        });

        // Filter for career-related links
        for (const link of links) {
          const href = link.href.toLowerCase();
          const text = link.text.toLowerCase();

          const isCareerLink = this.careerPagePatterns.some(pattern => 
            href.includes(pattern) || text.includes(pattern.substring(1))
          );

          if (isCareerLink && this.isValidUrl(link.href)) {
            careerUrls.push(link.href);
          }
        }

        // Remove duplicates and limit to 5 URLs
        const uniqueCareerUrls = [...new Set(careerUrls)].slice(0, 5);
        logger.info(`✅ Found ${uniqueCareerUrls.length} potential career pages`);

        return uniqueCareerUrls;

      } finally {
        await page.close();
      }

    } catch (error) {
      logger.warn(`⚠️ Failed to find career pages for ${websiteUrl}: ${error.message}`);
      return [];
    }
  }

  async scrapePage(url) {
    const page = await this.browser.newPage();
    const jobs = [];

    try {
      await this.setupPage(page);

      logger.info(`📄 Scraping page: ${url}`);

      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Wait for dynamic content to load
      await page.waitForTimeout(2000);

      // Try different scraping approaches
      const scrapingMethods = [
        () => this.scrapeStructuredJobs(page),
        () => this.scrapeJobCards(page),
        () => this.scrapeJobLists(page),
        () => this.scrapeJobLinks(page)
      ];

      for (const method of scrapingMethods) {
        try {
          const methodJobs = await method();
          if (methodJobs.length > 0) {
            jobs.push(...methodJobs);
            logger.info(`✅ Found ${methodJobs.length} jobs using structured extraction`);
            break; // Use the first successful method
          }
        } catch (error) {
          logger.debug(`Method failed: ${error.message}`);
        }
      }

      // If no jobs found with structured methods, try content analysis
      if (jobs.length === 0) {
        const contentJobs = await this.analyzePageContent(page);
        jobs.push(...contentJobs);
      }

    } catch (error) {
      logger.warn(`⚠️ Failed to scrape page ${url}: ${error.message}`);
    } finally {
      await page.close();
    }

    return jobs;
  }

  async setupPage(page) {
    // Set realistic browser properties
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    // Block unnecessary resources for better performance
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  async scrapeStructuredJobs(page) {
    try {
      // Look for JSON-LD structured data
      const structuredData = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const jobPostings = [];

        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent);
            if (data['@type'] === 'JobPosting' || (data['@graph'] && data['@graph'].some(item => item['@type'] === 'JobPosting'))) {
              const jobs = data['@type'] === 'JobPosting' ? [data] : data['@graph'].filter(item => item['@type'] === 'JobPosting');
              jobPostings.push(...jobs);
            }
          } catch (e) {
            // Invalid JSON, skip
          }
        }

        return jobPostings;
      });

      return structuredData.map(job => ({
        jobTitle: job.title || '',
        location: job.jobLocation?.address?.addressLocality || job.jobLocation || '',
        department: job.hiringOrganization?.department || '',
        postedDate: job.datePosted ? moment(job.datePosted).format('YYYY-MM-DD') : '',
        url: job.url || page.url(),
        source: 'website'
      }));

    } catch (error) {
      return [];
    }
  }

  async scrapeJobCards(page) {
    try {
      const jobs = await page.evaluate((selectors) => {
        const jobCards = [];

        // Look for common job card patterns
        const cardSelectors = [
          '[class*="job-card"]',
          '[class*="position-card"]', 
          '[class*="career-card"]',
          '[class*="opening-card"]',
          '.card:has([class*="job"])',
          '.item:has([class*="position"])'
        ];

        for (const selector of cardSelectors) {
          const cards = document.querySelectorAll(selector);

          for (const card of cards) {
            const job = {
              jobTitle: '',
              location: '',
              department: '',
              postedDate: '',
              url: window.location.href
            };

            // Extract job title
            for (const titleSelector of selectors.title) {
              const titleEl = card.querySelector(titleSelector);
              if (titleEl && titleEl.textContent.trim()) {
                job.jobTitle = titleEl.textContent.trim();
                break;
              }
            }

            // Extract location
            for (const locationSelector of selectors.location) {
              const locationEl = card.querySelector(locationSelector);
              if (locationEl && locationEl.textContent.trim()) {
                job.location = locationEl.textContent.trim();
                break;
              }
            }

            // Extract department
            for (const deptSelector of selectors.department) {
              const deptEl = card.querySelector(deptSelector);
              if (deptEl && deptEl.textContent.trim()) {
                job.department = deptEl.textContent.trim();
                break;
              }
            }

            // Extract URL if available
            const linkEl = card.querySelector('a[href]');
            if (linkEl) {
              job.url = linkEl.href;
            }

            if (job.jobTitle) {
              jobCards.push(job);
            }
          }

          if (jobCards.length > 0) {
            break; // Found jobs, no need to try other selectors
          }
        }

        return jobCards;
      }, this.jobSelectors);

      return jobs.map(job => ({
        ...job,
        source: 'website'
      }));

    } catch (error) {
      return [];
    }
  }

  async scrapeJobLists(page) {
    try {
      const jobs = await page.evaluate(() => {
        const jobList = [];

        // Look for list-based job postings
        const listSelectors = [
          'ul:has(li:contains("job"))',
          'ol:has(li:contains("position"))',
          '.jobs-list',
          '.positions-list',
          '.careers-list'
        ];

        for (const selector of listSelectors) {
          try {
            const lists = document.querySelectorAll(selector);

            for (const list of lists) {
              const items = list.querySelectorAll('li, .item');

              for (const item of items) {
                const text = item.textContent.trim();
                const linkEl = item.querySelector('a[href]');

                // Basic job detection based on keywords
                if (this.containsJobKeywords(text)) {
                  jobList.push({
                    jobTitle: this.extractJobTitle(text),
                    location: this.extractLocation(text),
                    department: '',
                    postedDate: '',
                    url: linkEl ? linkEl.href : window.location.href
                  });
                }
              }
            }
          } catch (e) {
            // Skip invalid selectors
          }
        }

        return jobList;
      });

      return jobs.filter(job => job.jobTitle).map(job => ({
        ...job,
        source: 'website'
      }));

    } catch (error) {
      return [];
    }
  }

  async scrapeJobLinks(page) {
    try {
      const jobs = await page.evaluate((jobKeywords) => {
        const jobLinks = [];
        const links = document.querySelectorAll('a[href]');

        for (const link of links) {
          const text = link.textContent.trim().toLowerCase();
          const href = link.href.toLowerCase();

          // Check if link text or URL suggests it's a job posting
          const isJobLink = jobKeywords.some(keyword => 
            text.includes(keyword) || href.includes(keyword.replace(' ', '-'))
          );

          if (isJobLink && text.length > 0) {
            jobLinks.push({
              jobTitle: link.textContent.trim(),
              location: '',
              department: '',
              postedDate: '',
              url: link.href
            });
          }
        }

        return jobLinks;
      }, this.jobKeywords);

      return jobs.map(job => ({
        ...job,
        source: 'website'
      }));

    } catch (error) {
      return [];
    }
  }

  async analyzePageContent(page) {
    try {
      const jobs = await page.evaluate((jobKeywords) => {
        const contentJobs = [];
        const textContent = document.body.textContent.toLowerCase();

        // Look for job-related content patterns
        const jobIndicators = ['we are hiring', 'join our team', 'career opportunities', 'open positions'];

        const hasJobContent = jobIndicators.some(indicator => textContent.includes(indicator));

        if (hasJobContent) {
          // Extract potential job titles from headings
          const headings = document.querySelectorAll('h1, h2, h3, h4');

          for (const heading of headings) {
            const headingText = heading.textContent.trim();

            // Check if heading looks like a job title
            if (this.looksLikeJobTitle(headingText)) {
              contentJobs.push({
                jobTitle: headingText,
                location: '',
                department: '',
                postedDate: '',
                url: window.location.href
              });
            }
          }
        }

        return contentJobs;
      }, this.jobKeywords);

      return jobs.map(job => ({
        ...job,
        source: 'website'
      }));

    } catch (error) {
      return [];
    }
  }

  looksLikeJobTitle(text) {
    if (!text || text.length < 5 || text.length > 100) return false;

    const jobTitlePatterns = [
      /\b(engineer|developer|manager|analyst|designer|coordinator|specialist|director|lead|senior|junior)\b/i,
      /\b(full.time|part.time|remote|contract|internship)\b/i,
      /\b(software|marketing|sales|hr|finance|operations|product)\b/i
    ];

    return jobTitlePatterns.some(pattern => pattern.test(text));
  }

  deduplicateJobs(jobs) {
    const seen = new Map();
    const unique = [];

    for (const job of jobs) {
      const key = `${job.jobTitle}_${job.location}`.toLowerCase().replace(/\s+/g, '');

      if (!seen.has(key) && job.jobTitle.trim()) {
        seen.set(key, true);
        unique.push({
          ...job,
          jobTitle: this.cleanText(job.jobTitle),
          location: this.cleanText(job.location),
          department: this.cleanText(job.department),
          postedDate: job.postedDate || moment().format('YYYY-MM-DD')
        });
      }
    }

    return unique;
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async randomDelay(min = this.requestDelay, max = this.maxDelay) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
      logger.info('🧹 Job scraper cleanup complete');
    } catch (error) {
      logger.error('❌ Error during job scraper cleanup:', error);
    }
  }

  isInitialized() {
    return this.isInitialized;
  }
}

module.exports = {
  JobScraper,
  scrapeJobPostings: async (url) => {
    const scraper = new JobScraper();
    try {
      await scraper.initialize();
      const jobs = await scraper.scrapeCompanyWebsite(url, url);
      return jobs;
    } catch (error) {
      console.error("Failed to scrape job postings:", error);
      return [];
    } finally {
      await scraper.cleanup();
    }
  }
};
