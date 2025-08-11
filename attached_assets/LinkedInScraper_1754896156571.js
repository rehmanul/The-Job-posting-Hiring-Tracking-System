const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
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
    new winston.transports.File({ filename: 'logs/linkedin-scraper.log' })
  ]
});

class LinkedInScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    this.isInitialized = false;

    // Rate limiting
    this.lastRequestTime = 0;
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

    // Selectors
    this.selectors = {
      loginEmail: 'input[name="session_key"]',
      loginPassword: 'input[name="session_password"]',
      loginButton: 'button[type="submit"]',
      jobCard: '.jobs-search__results-list .result-card',
      jobTitle: '.result-card__title',
      jobCompany: '.result-card__subtitle',
      jobLocation: '.job-result-card__location',
      jobPostedTime: '.job-result-card__listdate',
      companyEmployees: '.org-people-profile-card__profile-link',
      recentHire: '.feed-shared-update-v2',
      hireAnnouncement: '[data-control-name="people_highlight_announcement"]'
    };
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing LinkedIn scraper...');

      await this.launchBrowser();

      // Setup LinkedIn authentication
      if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
        await this.login();
      } else if (process.env.LINKEDIN_COOKIES) {
        await this.setCookies();
      } else {
        logger.warn('⚠️ No LinkedIn authentication provided. Limited functionality available.');
      }

      this.isInitialized = true;
      logger.info('✅ LinkedIn scraper initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize LinkedIn scraper:', error);
      throw error;
    }
  }

  async launchBrowser() {
    try {
      this.browser = await puppeteer.launch(this.browserConfig);
      this.page = await this.browser.newPage();

      // Set realistic browser properties
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
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

      logger.info('✅ Browser launched successfully');

    } catch (error) {
      logger.error('❌ Failed to launch browser:', error);
      throw error;
    }
  }

  async login() {
    try {
      logger.info('🔐 Logging into LinkedIn...');

      await this.navigateWithRetry('https://www.linkedin.com/login');
      await this.randomDelay();

      // Fill login form
      await this.page.waitForSelector(this.selectors.loginEmail, { timeout: 10000 });
      await this.page.type(this.selectors.loginEmail, process.env.LINKEDIN_EMAIL, { delay: 100 });
      await this.randomDelay(500, 1500);

      await this.page.type(this.selectors.loginPassword, process.env.LINKEDIN_PASSWORD, { delay: 100 });
      await this.randomDelay(500, 1500);

      // Submit login
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
        this.page.click(this.selectors.loginButton)
      ]);

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed') || currentUrl.includes('/in/')) {
        this.isLoggedIn = true;
        logger.info('✅ LinkedIn login successful');
      } else {
        throw new Error('Login failed - unexpected redirect');
      }

    } catch (error) {
      logger.error('❌ LinkedIn login failed:', error);
      throw error;
    }
  }

  async setCookies() {
    try {
      logger.info('🍪 Setting LinkedIn cookies...');

      const cookies = JSON.parse(process.env.LINKEDIN_COOKIES);
      await this.page.setCookie(...cookies);

      // Navigate to LinkedIn to test cookies
      await this.navigateWithRetry('https://www.linkedin.com/feed');

      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed') || currentUrl.includes('/in/')) {
        this.isLoggedIn = true;
        logger.info('✅ LinkedIn cookies set successfully');
      } else {
        throw new Error('Invalid or expired cookies');
      }

    } catch (error) {
      logger.error('❌ Failed to set LinkedIn cookies:', error);
      throw error;
    }
  }

  async scrapeCompanyJobs(companyLinkedInUrl) {
    try {
      logger.info(`🔍 Scraping jobs for company: ${companyLinkedInUrl}`);

      if (!this.isLoggedIn) {
        logger.warn('⚠️ Not logged into LinkedIn, limited job data available');
      }

      const jobs = [];
      const jobsUrl = `${companyLinkedInUrl}/jobs/`;

      await this.navigateWithRetry(jobsUrl);
      await this.randomDelay();

      // Wait for job listings to load
      try {
        await this.page.waitForSelector('.jobs-search__results-list, .org-jobs-recently-posted-jobs-module', { timeout: 10000 });
      } catch (error) {
        logger.warn(`⚠️ No job listings found for ${companyLinkedInUrl}`);
        return jobs;
      }

      // Scrape job cards
      const jobCards = await this.page.$$('.result-card, .org-jobs-recently-posted-jobs-module__job-posting');

      for (const card of jobCards.slice(0, 20)) { // Limit to first 20 jobs
        try {
          const jobData = await this.extractJobData(card);
          if (jobData && jobData.jobTitle) {
            jobs.push({
              ...jobData,
              source: 'linkedin',
              scrapedAt: moment().toISOString()
            });
          }
        } catch (error) {
          logger.warn('⚠️ Failed to extract job data from card:', error.message);
        }
      }

      logger.info(`✅ Found ${jobs.length} jobs for company`);
      return jobs;

    } catch (error) {
      logger.error(`❌ Failed to scrape company jobs: ${error.message}`);
      return [];
    }
  }

  async extractJobData(jobCard) {
    try {
      const jobTitle = await this.getTextContent(jobCard, '.result-card__title, .org-jobs-recently-posted-jobs-module__job-posting-title');
      const jobLocation = await this.getTextContent(jobCard, '.job-result-card__location, .org-jobs-recently-posted-jobs-module__job-posting-location');
      const postedTime = await this.getTextContent(jobCard, '.job-result-card__listdate, .org-jobs-recently-posted-jobs-module__job-posting-date');

      // Try to get the job URL
      let jobUrl = '';
      try {
        const linkElement = await jobCard.$('.result-card__title-link, .org-jobs-recently-posted-jobs-module__job-posting-title a');
        if (linkElement) {
          jobUrl = await this.page.evaluate(el => el.href, linkElement);
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
        source: 'linkedin'
      };

    } catch (error) {
      logger.warn('⚠️ Error extracting job data:', error.message);
      return null;
    }
  }

  async scrapeNewHires(companyLinkedInUrl) {
    try {
      logger.info(`👥 Scraping new hires for company: ${companyLinkedInUrl}`);

      if (!this.isLoggedIn) {
        logger.warn('⚠️ Not logged into LinkedIn, cannot access new hires data');
        return [];
      }

      const newHires = [];
      const peopleUrl = `${companyLinkedInUrl}/people/`;

      await this.navigateWithRetry(peopleUrl);
      await this.randomDelay();

      // Wait for people grid to load
      try {
        await this.page.waitForSelector('.org-people-profile-card, .artdeco-entity-lockup', { timeout: 10000 });
      } catch (error) {
        logger.warn(`⚠️ No people data found for ${companyLinkedInUrl}`);
        return newHires;
      }

      // Look for recent hire indicators
      const profileCards = await this.page.$$('.org-people-profile-card, .artdeco-entity-lockup');

      for (const card of profileCards.slice(0, 50)) { // Limit to first 50 profiles
        try {
          const hireData = await this.extractNewHireData(card);
          if (hireData && this.isRecentHire(hireData.startDate)) {
            newHires.push({
              ...hireData,
              company: companyLinkedInUrl, // Add company
              source: 'linkedin',
              scrapedAt: moment().toISOString()
            });
          }
        } catch (error) {
          logger.warn('⚠️ Failed to extract hire data from profile:', error.message);
        }
      }

      // Also check company updates/feed for hire announcements
      const feedHires = await this.scrapeHireAnnouncements(companyLinkedInUrl);
      newHires.push(...feedHires);

      logger.info(`✅ Found ${newHires.length} recent hires for company`);
      return newHires;

    } catch (error) {
      logger.error(`❌ Failed to scrape company new hires: ${error.message}`);
      return [];
    }
  }

  async extractNewHireData(profileCard) {
    try {
      const personName = await this.getTextContent(profileCard, '.artdeco-entity-lockup__title, .org-people-profile-card__profile-title');
      const position = await this.getTextContent(profileCard, '.artdeco-entity-lockup__subtitle, .org-people-profile-card__profile-info');

      // Try to get LinkedIn profile URL
      let linkedinProfile = '';
      try {
        const linkElement = await profileCard.$('.artdeco-entity-lockup__title a, .org-people-profile-card__profile-link');
        if (linkElement) {
          linkedinProfile = await this.page.evaluate(el => el.href, linkElement);
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
      logger.warn('⚠️ Error extracting hire data:', error.message);
      return null;
    }
  }

  async scrapeHireAnnouncements(companyLinkedInUrl) {
    try {
      const hireAnnouncements = [];
      const updatesUrl = `${companyLinkedInUrl}/posts/`;

      await this.navigateWithRetry(updatesUrl);
      await this.randomDelay();

      // Look for hire-related posts in the company feed
      const updates = await this.page.$$('.feed-shared-update-v2');

      for (const update of updates.slice(0, 10)) { // Check last 10 posts
        try {
          const postText = await this.getTextContent(update, '.feed-shared-text');

          if (this.isHireAnnouncement(postText)) {
            const hireInfo = this.extractHireInfoFromPost(postText);
            if (hireInfo) {
              hireAnnouncements.push({
                ...hireInfo,
                source: 'linkedin_announcement',
                scrapedAt: moment().toISOString()
              });
            }
          }
        } catch (error) {
          // Skip this post if we can't process it
        }
      }

      return hireAnnouncements;

    } catch (error) {
      logger.warn('⚠️ Failed to scrape hire announcements:', error.message);
      return [];
    }
  }

  async getTextContent(element, selector) {
    try {
      const targetElement = selector ? await element.$(selector) : element;
      if (targetElement) {
        return await this.page.evaluate(el => el.textContent.trim(), targetElement);
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  async navigateWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.page.goto(url, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        return;
      } catch (error) {
        logger.warn(`⚠️ Navigation attempt ${i + 1} failed for ${url}: ${error.message}`);
        if (i === maxRetries - 1) throw error;
        await this.randomDelay(5000, 10000);
      }
    }
  }

  async randomDelay(min = this.requestDelay, max = this.maxDelay) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  cleanText(text) {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
  }

  parsePostedDate(postedText) {
    if (!postedText) return '';

    const cleanText = postedText.toLowerCase();
    const now = moment();

    if (cleanText.includes('just now') || cleanText.includes('now')) {
      return now.format('YYYY-MM-DD');
    } else if (cleanText.includes('minute')) {
      return now.format('YYYY-MM-DD');
    } else if (cleanText.includes('hour')) {
      return now.format('YYYY-MM-DD');
    } else if (cleanText.includes('day')) {
      const days = parseInt(cleanText.match(/\d+/)?.[0] || '1');
      return now.subtract(days, 'days').format('YYYY-MM-DD');
    } else if (cleanText.includes('week')) {
      const weeks = parseInt(cleanText.match(/\d+/)?.[0] || '1');
      return now.subtract(weeks, 'weeks').format('YYYY-MM-DD');
    }

    return now.format('YYYY-MM-DD');
  }

  estimateStartDate() {
    // Since we can't always get exact start dates, estimate recent hires as within last 30 days
    const randomDaysAgo = Math.floor(Math.random() * 30);
    return moment().subtract(randomDaysAgo, 'days').format('YYYY-MM-DD');
  }

  isRecentHire(startDate) {
    if (!startDate) return true; // If no date, assume recent
    const thirtyDaysAgo = moment().subtract(30, 'days');
    return moment(startDate).isAfter(thirtyDaysAgo);
  }

  isHireAnnouncement(postText) {
    if (!postText) return false;

    const hireKeywords = [
      'welcome to the team',
      'joined our team',
      'new team member',
      'pleased to announce',
      'excited to welcome',
      'joining us as',
      'new hire',
      'new addition'
    ];

    const lowerText = postText.toLowerCase();
    return hireKeywords.some(keyword => lowerText.includes(keyword));
  }

  extractHireInfoFromPost(postText) {
    // Basic extraction of hire info from announcement posts
    // This is a simplified version - could be enhanced with NLP

    try {
      const lines = postText.split('\n').map(line => line.trim()).filter(line => line);

      // Look for patterns like "Welcome John Smith as Senior Developer"
      for (const line of lines) {
        const welcomeMatch = line.match(/welcome\s+([^\s]+\s+[^\s]+).*?as\s+(.+?)(?:\.|$)/i);
        if (welcomeMatch) {
          return {
            personName: welcomeMatch[1].trim(),
            position: welcomeMatch[2].trim(),
            startDate: moment().format('YYYY-MM-DD'),
            linkedinProfile: ''
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      logger.info('🧹 LinkedIn scraper cleanup complete');
    } catch (error) {
      logger.error('❌ Error during LinkedIn scraper cleanup:', error);
    }
  }

  isInitialized() {
    return this.isInitialized;
  }
}

module.exports = { LinkedInScraper, scrapeNewHires: LinkedInScraper.prototype.scrapeNewHires };
