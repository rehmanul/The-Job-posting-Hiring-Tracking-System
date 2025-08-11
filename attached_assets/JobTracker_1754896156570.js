const winston = require('winston');
const { GoogleSheetsService } = require('./GoogleSheetsService');
const { SlackService } = require('./SlackService');
const { EmailService } = require('./EmailService');
const { LinkedInScraper } = require('../scrapers/LinkedInScraper');
const { JobScraper } = require('../scrapers/JobScraper');
const { ConfidenceScorer } = require('../utils/ConfidenceScorer');
const { RateLimiter } = require('../utils/RateLimiter');
const moment = require('moment');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/job-tracker.log' })
  ]
});

class JobTracker {
  constructor() {
// Analytics and health metrics
    this.companiesProcessed = 0;
    this.jobPostingsFound = 0;
    this.newHiresFound = 0;
    this.successfulApiCalls = 0;
    this.errorsEncountered = 0;

    this.sheetsService = new GoogleSheetsService();
    this.slackService = new SlackService();
    this.emailService = new EmailService();
    this.linkedInScraper = new LinkedInScraper();
    this.jobScraper = new JobScraper();
    this.confidenceScorer = new ConfidenceScorer();
    this.rateLimiter = new RateLimiter();

    this.companies = [];
    this.jobPostings = new Map();
    this.newHires = new Map();
    this.isInitialized = false;
  }


  async initialize() {
    try {
      logger.info('🔧 Initializing Job Tracker services...');

      // Initialize all services
      await this.sheetsService.initialize();
      await this.slackService.initialize();
      await this.emailService.initialize();
      await this.linkedInScraper.initialize();
      await this.jobScraper.initialize();

      // Load company data from Google Sheets
      await this.loadCompanies();

      // Load existing job postings and hires
      await this.loadExistingData();

      this.isInitialized = true;
      logger.info('✅ Job Tracker initialized successfully');

      this.startJobPostingCron();
      this.startNewHiresCron();
    } catch (error) {
      logger.error('❌ Failed to initialize Job Tracker:', error);
      throw error;
    }
  }

  async loadCompanies() {
    try {
      logger.info('📊 Loading companies from Google Sheets...');
      this.companies = await this.sheetsService.getCompaniesData();
      logger.info(`✅ Loaded ${this.companies.length} companies`);
    } catch (error) {
      logger.error('❌ Failed to load companies:', error);
      throw error;
    }
  }

  async loadExistingData() {
    try {
      logger.info('📋 Loading existing job postings and hires...');

      const [existingJobs, existingHires] = await Promise.all([
        this.sheetsService.getJobPostings(),
        this.sheetsService.getNewHires()
      ]);

      // Create lookup maps for deduplication
      existingJobs.forEach(job => {
        const key = `${job.company}_${job.jobTitle}_${job.location}`.toLowerCase();
        this.jobPostings.set(key, job);
      });

      existingHires.forEach(hire => {
        const key = `${hire.personName}_${hire.company}_${hire.position}`.toLowerCase();
        this.newHires.set(key, hire);
      });

      logger.info(`✅ Loaded ${existingJobs.length} existing jobs and ${existingHires.length} existing hires`);
    } catch (error) {
      logger.error('❌ Failed to load existing data:', error);
    }
  }

  async trackJobPostings() {
    if (!this.isInitialized) {
      logger.warn('⚠️ Job Tracker not initialized, skipping job postings scan');
      return;
    }

    logger.info('🔍 Starting job postings tracking...');
    const startTime = Date.now();
    const results = {
      processed: 0,
      newJobs: 0,
      errors: 0,
      companies: []
    };

    try {
      for (const company of this.companies) {
        try {
          await this.rateLimiter.waitForJobScraping();

          logger.info(`🏢 Scanning jobs for ${company.companyName}...`);
          const companyResult = await this.scanCompanyJobs(company);

          results.processed++;
          results.newJobs += companyResult.newJobs;
          results.companies.push({
            name: company.companyName,
            newJobs: companyResult.newJobs,
            status: 'success'
          });

          logger.info(`✅ ${company.companyName}: Found ${companyResult.newJobs} new jobs`);

        } catch (error) {
          logger.error(`❌ Error scanning ${company.companyName}:`, error);
          results.errors++;
          results.companies.push({
            name: company.companyName,
            newJobs: 0,
            status: 'error',
            error: error.message
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`✅ Job postings scan completed in ${duration}s: ${results.newJobs} new jobs found`);

      // Send notifications if new jobs found
      if (results.newJobs > 0) {
        await this.sendJobNotifications(results);
      }

      // Update analytics
      await this.updateAnalytics('job_scan', results);

    } catch (error) {
      logger.error('❌ Job postings tracking failed:', error);
      throw error;
    }
  }

  async scanCompanyJobs(company) {
    const result = { newJobs: 0, jobs: [] };

    try {
      // Scrape jobs from company website and LinkedIn
      const [websiteJobs, linkedInJobs] = await Promise.all([
        this.jobScraper.scrapeCompanyWebsite(company.website, company.linkedinCareerPageUrl),
        this.linkedInScraper.scrapeCompanyJobs(company.linkedinUrl)
      ]);

      // Combine and deduplicate jobs
      const allJobs = [...websiteJobs, ...linkedInJobs];
      const newJobs = [];

      for (const job of allJobs) {
        const jobKey = `${job.company}_${job.jobTitle}_${job.location}`.toLowerCase();

        if (!this.jobPostings.has(jobKey)) {
          // Calculate confidence score
          const confidenceScore = this.confidenceScorer.calculateJobScore(job);

          const enrichedJob = {
            ...job,
            company: company.companyName,
            foundDate: moment().format('YYYY-MM-DD HH:mm:ss'),
            confidenceScore: confidenceScore,
            source: job.source || 'website'
          };

          newJobs.push(enrichedJob);
          this.jobPostings.set(jobKey, enrichedJob);
        }
      }

      if (newJobs.length > 0) {
        // Save to Google Sheets
        const jobData = newJobs.map(job => [
          job.company || '',
          job.jobTitle || '',
          job.location || '',
          job.department || '',
          job.postedDate || '',
          job.foundDate || moment().format('YYYY-MM-DD HH:mm:ss'),
          job.url || '',
          job.confidenceScore || 0
        ]);
        await this.sheetsService.updateSheet(this.sheetsService.sheets.jobPostings, jobData);
        result.newJobs = newJobs.length;
        result.jobs = newJobs;
      }

    } catch (error) {
      logger.error(`❌ Error scanning jobs for ${company.companyName}:`, error);
      throw error;
    }

    return result;
  }

  async trackNewHires() {
    if (!this.isInitialized) {
      logger.warn('⚠️ Job Tracker not initialized, skipping new hires scan');
      return;
    }

    logger.info('👥 Starting new hires tracking...');
    const startTime = Date.now();
    const results = {
      processed: 0,
      newHires: 0,
      errors: 0,
      companies: []
    };

    try {
      for (const company of this.companies) {
        try {
          await this.rateLimiter.waitForLinkedInScraping();

          logger.info(`🏢 Scanning new hires for ${company.companyName}...`);
          const companyResult = await this.scanCompanyNewHires(company);

          results.processed++;
          results.newHires += companyResult.newHires;
          results.companies.push({
            name: company.companyName,
            newHires: companyResult.newHires,
            status: 'success'
          });

          logger.info(`✅ ${company.companyName}: Found ${companyResult.newHires} new hires`);

        } catch (error) {
          logger.error(`❌ Error scanning new hires for ${company.companyName}:`, error);
          results.errors++;
          results.companies.push({
            name: company.companyName,
            newHires: 0,
            status: 'error',
            error: error.message
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`✅ New hires scan completed in ${duration}s: ${results.newHires} new hires found`);

      // Send notifications if new hires found
      if (results.newHires > 0) {
        await this.sendHireNotifications(results);
      }

      // Update analytics
      await this.updateAnalytics('hire_scan', results);

    } catch (error) {
      logger.error('❌ New hires tracking failed:', error);
      throw error;
    }
  }

  async scanCompanyNewHires(company) {
    const result = { newHires: 0, hires: [] };

    try {
      // Scrape new hires from LinkedIn
      const recentHires = await this.linkedInScraper.scrapeCompanyNewHires(company.linkedinUrl);
      const newHires = [];

      for (const hire of recentHires) {
        const hireKey = `${hire.personName}_${hire.company}_${hire.position}`.toLowerCase();

        if (!this.newHires.has(hireKey)) {
          // Calculate confidence score
          const confidenceScore = this.confidenceScorer.calculateHireScore(hire);

          const enrichedHire = {
            ...hire,
            company: company.companyName,
            confidenceScore: confidenceScore,
            source: 'linkedin'
          };

          newHires.push(enrichedHire);
          this.newHires.set(hireKey, enrichedHire);
        }
      }

      if (newHires.length > 0) {
        // Save to Google Sheets
        const hireData = newHires.map(hire => [
          hire.personName || '',
          hire.company || '',
          hire.position || '',
          hire.startDate || moment().format('YYYY-MM-DD'),
          hire.linkedinProfile || '',
          hire.source || 'linkedin',
          hire.confidenceScore || 0
        ]);
        await this.sheetsService.updateSheet(this.sheetsService.sheets.newHires, hireData);
        result.newHires = newHires.length;
        result.hires = newHires;
      }

    } catch (error) {
      logger.error(`❌ Error scanning new hires for ${company.companyName}:`, error);
      throw error;
    }

    return result;
  }

  async sendJobNotifications(results) {
    try {
      const message = this.formatJobNotificationMessage(results);

      // Send to Slack
      await this.slackService.sendMessage(message);

      // Send email notifications
      await this.emailService.sendJobAlert(results);

      logger.info(`📢 Sent notifications for ${results.newJobs} new jobs`);
    } catch (error) {
      logger.error('❌ Failed to send job notifications:', error);
    }
  }

  async sendHireNotifications(results) {
    try {
      const message = this.formatHireNotificationMessage(results);

      // Send to Slack
      await this.slackService.sendMessage(message);

      // Send email notifications
      await this.emailService.sendHireAlert(results);

      logger.info(`📢 Sent notifications for ${results.newHires} new hires`);
    } catch (error) {
      logger.error('❌ Failed to send hire notifications:', error);
    }
  }

  formatJobNotificationMessage(results) {
    const { newJobs, companies } = results;
    let message = `🎯 *Job Alert!* Found ${newJobs} new job posting${newJobs > 1 ? 's' : ''}\n\n`;

    companies.filter(c => c.newJobs > 0).forEach(company => {
      message += `• *${company.name}*: ${company.newJobs} new job${company.newJobs > 1 ? 's' : ''}\n`;
    });

    message += `\n⏰ Scan completed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
    return message;
  }

  formatHireNotificationMessage(results) {
    const { newHires, companies } = results;
    let message = `👥 *New Hire Alert!* Found ${newHires} new hire${newHires > 1 ? 's' : ''}\n\n`;

    companies.filter(c => c.newHires > 0).forEach(company => {
      message += `• *${company.name}*: ${company.newHires} new hire${company.newHires > 1 ? 's' : ''}\n`;
    });

    message += `\n⏰ Scan completed at ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
    return message;
  }

  async generateDailySummary() {
    try {
      logger.info('📊 Generating daily summary...');

      const today = moment().format('YYYY-MM-DD');
      const [todayJobs, todayHires] = await Promise.all([
        this.sheetsService.getJobPostingsByDate(today),
        this.sheetsService.getNewHiresByDate(today)
      ]);

      const summary = {
        date: today,
        totalJobs: todayJobs.length,
        totalHires: todayHires.length,
        topCompaniesJobs: this.getTopCompanies(todayJobs),
        topCompaniesHires: this.getTopCompanies(todayHires),
        jobs: todayJobs,
        hires: todayHires
      };

      const message = this.formatDailySummaryMessage(summary);

      // Send to Slack
      await this.slackService.sendMessage(message);

      // Send email summary
      await this.emailService.sendDailySummary(summary);

      logger.info(`📊 Daily summary sent: ${summary.totalJobs} jobs, ${summary.totalHires} hires`);

    } catch (error) {
      logger.error('❌ Failed to generate daily summary:', error);
    }
  }

  getTopCompanies(items) {
    const companyCounts = {};
    items.forEach(item => {
      companyCounts[item.company] = (companyCounts[item.company] || 0) + 1;
    });

    return Object.entries(companyCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([company, count]) => ({ company, count }));
  }

  formatDailySummaryMessage(summary) {
    let message = `📈 *Daily Summary - ${summary.date}*\n\n`;
    message += `🎯 Jobs Found: ${summary.totalJobs}\n`;
    message += `👥 New Hires: ${summary.totalHires}\n\n`;

    if (summary.topCompaniesJobs.length > 0) {
      message += `*Top Companies (Jobs):*\n`;
      summary.topCompaniesJobs.forEach(({ company, count }) => {
        message += `• ${company}: ${count}\n`;
      });
      message += `\n`;
    }

    if (summary.topCompaniesHires.length > 0) {
      message += `*Top Companies (Hires):*\n`;
      summary.topCompaniesHires.forEach(({ company, count }) => {
        message += `• ${company}: ${count}\n`;
      });
    }

    return message;
  }

  async updateAnalytics(scanType, results) {
    try {
      const analyticsData = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        scanType: scanType,
        processed: results.processed,
        newItems: results.newJobs || results.newHires || 0,
        errors: results.errors,
        duration: Date.now() - results.startTime || 0
      };

      await this.sheetsService.updateAnalytics(analyticsData);
    } catch (error) {
      logger.error('❌ Failed to update analytics:', error);
    }
  }

  async sendSlackMessage(message) {
    try {
      await this.slackService.sendMessage(message);
    } catch (error) {
      logger.error('❌ Failed to send Slack message:', error);
    }
  }

  async cleanup() {
    logger.info('🧹 Cleaning up Job Tracker...');
    try {

    try {
      const analyticsData = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        companiesProcessed: this.companiesProcessed,
        jobPostingsFound: this.jobPostingsFound,
        newHiresFound: this.newHiresFound,
        successfulApiCalls: this.successfulApiCalls,
        errorsEncountered: this.errorsEncountered
      };

      const values = [[
        analyticsData.timestamp,
        analyticsData.companiesProcessed,
        analyticsData.jobPostingsFound,
        analyticsData.newHiresFound,
        analyticsData.successfulApiCalls,
        analyticsData.errorsEncountered
      ]];

      await this.sheetsService.updateSheet(this.sheetsService.sheets.analytics, values);
      logger.info('✅ Analytics logged to Google Sheets');
    } catch (error) {
      logger.error('❌ Failed to log analytics:', error);
    }
  }

    try {
      const analyticsData = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        companiesProcessed: this.companiesProcessed,
        jobPostingsFound: this.jobPostingsFound,
        newHiresFound: this.newHiresFound,
        successfulApiCalls: this.successfulApiCalls,
        errorsEncountered: this.errorsEncountered
      };

      const values = [[
        analyticsData.timestamp,
        analyticsData.companiesProcessed,
        analyticsData.jobPostingsFound,
        analyticsData.newHiresFound,
        analyticsData.successfulApiCalls,
        analyticsData.errorsEncountered
      ]];

      await this.sheetsService.updateSheet(this.sheetsService.sheets.analytics, values);
      logger.info('✅ Analytics logged to Google Sheets');
    } catch (error) {
      logger.error('❌ Failed to log analytics:', error);
    }
  }

    try {
      const analyticsData = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        companiesProcessed: this.companiesProcessed,
        jobPostingsFound: this.jobPostingsFound,
        newHiresFound: this.newHiresFound,
        successfulApiCalls: this.successfulApiCalls,
        errorsEncountered: this.errorsEncountered
      };

      const values = [[
        analyticsData.timestamp,
        analyticsData.companiesProcessed,
        analyticsData.jobPostingsFound,
        analyticsData.newHiresFound,
        analyticsData.successfulApiCalls,
        analyticsData.errorsEncountered
      ]];

      await this.sheetsService.updateSheet(this.sheetsService.sheets.analytics, values);
      logger.info('✅ Analytics logged to Google Sheets');
    } catch (error) {
      logger.error('❌ Failed to log analytics:', error);
    }
  }

  async logHealthMetrics() {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      const healthMetricsData = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        memoryUsage: JSON.stringify(memoryUsage),
        cpuUsage: JSON.stringify(cpuUsage),
        uptime: uptime
      };

      const values = [[
        healthMetricsData.timestamp,
        healthMetricsData.memoryUsage,
        healthMetricsData.cpuUsage,
        healthMetricsData.uptime
      ]];

      await this.sheetsService.updateSheet(this.sheetsService.sheets.healthMetrics, values);
      logger.info('✅ Health metrics logged to Google Sheets');
    } catch (error) {
      logger.error('❌ Failed to log health metrics:', error);
    }
  }
      await this.linkedInScraper.cleanup(); // This line was already here
      await this.jobScraper.cleanup(); // This line was already here

    try {
      const analyticsData = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        companiesProcessed: this.companiesProcessed,
        jobPostingsFound: this.jobPostingsFound,
        newHiresFound: this.newHiresFound,
        successfulApiCalls: this.successfulApiCalls,
        errorsEncountered: this.errorsEncountered
      };

      const values = [[
        analyticsData.timestamp,
        analyticsData.companiesProcessed,
        analyticsData.jobPostingsFound,
        analyticsData.newHiresFound,
        analyticsData.successfulApiCalls,
        analyticsData.errorsEncountered
      ]];

      await this.sheetsService.updateSheet(this.sheetsService.sheets.analytics, values);
      logger.info('✅ Analytics logged to Google Sheets');
    } catch (error) {
      logger.error('❌ Failed to log analytics:', error);
    }
  }

  async logHealthMetrics() {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      const healthMetricsData = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        memoryUsage: JSON.stringify(memoryUsage),
        cpuUsage: JSON.stringify(cpuUsage),
        uptime: uptime
      };

      const values = [[
        healthMetricsData.timestamp,
        healthMetricsData.memoryUsage,
        healthMetricsData.cpuUsage,
        healthMetricsData.uptime
      ]];

      await this.sheetsService.updateSheet(this.sheetsService.sheets.healthMetrics, values);
      logger.info('✅ Health metrics logged to Google Sheets');
    } catch (error) {
      logger.error('❌ Failed to log health metrics:', error);
    }
  }
      logger.info('✅ Job Tracker cleanup complete');
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
    }
  }
}

const cron = require('node-cron');

module.exports = { JobTracker };

JobTracker.prototype.runJobPostingChecks = async function() {
  try {
    logger.info('🚀 Running job posting checks...');
    const companies = await this.sheetsService.getCompaniesData();

    for (const company of companies) {
      logger.info(`🏢 Scanning job postings for ${company.companyName}...`);
      const jobPostings = await this.jobScraper.scrapeJobPostings(company.website, company.linkedinCareerPageUrl);

      const newJobs = [];
      for (const job of jobPostings) {
        const jobKey = `${job.company}_${job.jobTitle}_${job.location}`.toLowerCase();
        if (!this.jobPostings.has(jobKey)) {
          newJobs.push(job);
          this.jobPostings.set(jobKey, job);
        }
      }

      if (newJobs.length > 0) {
        logger.info(`✅ Found ${newJobs.length} new job postings for ${company.companyName}`);
        const jobData = newJobs.map(job => [
          job.company || '',
          job.jobTitle || '',
          job.location || '',
          job.department || '',
          job.postedDate || '',
          job.foundDate || moment().format('YYYY-MM-DD HH:mm:ss'),
          job.url || '',
          job.confidenceScore || 0
        ]);
        await this.sheetsService.updateSheet(this.sheetsService.sheets.jobPostings, jobData);
        await this.slackService.sendMessage(`🎯 New job postings found for ${company.companyName}: ${newJobs.length}`);
        await this.emailService.sendEmail({
          to: 'recipient@example.com', // Replace with actual recipient
          subject: `🎯 New Job Postings for ${company.companyName}`,
          body: `Found ${newJobs.length} new job postings for ${company.companyName}`
        });
      } else {
        logger.info(`No new job postings found for ${company.companyName}`);
      }
    }
    logger.info('✅ Job posting checks completed.');
  } catch (error) {
    logger.error('❌ Error during job posting checks:', error);
  }
};

JobTracker.prototype.runNewHiresChecks = async function() {
  try {
    logger.info('🚀 Running new hires checks...');
    const companies = await this.sheetsService.getCompaniesData();

    for (const company of companies) {
      logger.info(`🏢 Scanning new hires for ${company.companyName}...`);
      const newHires = await this.linkedInScraper.scrapeNewHires(company.linkedinUrl);

      const newHireList = [];
      for (const hire of newHires) {
        const hireKey = `${hire.personName}_${hire.company}_${hire.position}`.toLowerCase();
        if (!this.newHires.has(hireKey)) {
          newHireList.push(hire);
          this.newHires.set(hireKey, hire);
        }
      }

      if (newHireList.length > 0) {
        logger.info(`✅ Found ${newHireList.length} new hires for ${company.companyName}`);
        const hireData = newHireList.map(hire => [
          hire.personName || '',
          hire.company || '',
          hire.position || '',
          hire.startDate || moment().format('YYYY-MM-DD'),
          hire.linkedinProfile || '',
          hire.source || 'linkedin',
          hire.confidenceScore || 0
        ]);
        await this.sheetsService.updateSheet(this.sheetsService.sheets.newHires, hireData);
        await this.slackService.sendMessage(`🎉 New hires found for ${company.companyName}: ${newHireList.length}`);
      } else {
        logger.info(`No new hires found for ${company.companyName}`);
      }
    }
    logger.info('✅ New hires checks completed.');
  } catch (error) {
    logger.error('❌ Error during new hires checks:', error);
  }
};

JobTracker.prototype.startJobPostingCron = function() {
  const jobPostingInterval = process.env.JOB_POSTING_CHECK_INTERVAL || '0 0 * * *';
  cron.schedule(jobPostingInterval, () => {
    logger.info('⏰ Running scheduled job posting checks...');
    this.runJobPostingChecks();
  });
  logger.info(`✅ Job posting checks scheduled with interval: ${jobPostingInterval}`);
};

JobTracker.prototype.startNewHiresCron = function() {
  const newHiresInterval = process.env.NEW_HIRES_CHECK_INTERVAL || '0 0 * * *';
  cron.schedule(newHiresInterval, () => {
    logger.info('⏰ Running scheduled new hires checks...');
    this.runNewHiresChecks();
  });
  logger.info(`✅ New hires checks scheduled with interval: ${newHiresInterval}`);
};
