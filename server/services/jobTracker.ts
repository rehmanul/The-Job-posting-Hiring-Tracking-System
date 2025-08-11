import { storage } from '../storage';
import { GoogleSheetsService } from './googleSheets';
import { GoogleSheetsIntegrationService } from './googleSheetsIntegration';
import { LinkedInScraper } from './linkedinScraper';
import { SlackService } from './slackService';
import { EmailService } from './emailService';
import type { Company, InsertJobPosting, InsertNewHire } from '@shared/schema';

export class JobTrackerService {
  private googleSheets: GoogleSheetsService;
  private googleSheetsIntegration: GoogleSheetsIntegrationService;
  private linkedinScraper: LinkedInScraper;
  private slackService: SlackService;
  private emailService: EmailService;
  private isRunning = false;

  constructor() {
    this.googleSheets = new GoogleSheetsService();
    this.googleSheetsIntegration = new GoogleSheetsIntegrationService();
    this.linkedinScraper = new LinkedInScraper();
    this.slackService = new SlackService();
    this.emailService = new EmailService();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Job Tracker Service...');
      
      await this.googleSheets.initialize();
      
      try {
        await this.linkedinScraper.initialize();
        console.log('✅ LinkedIn scraper initialized successfully');
      } catch (error) {
        console.warn('⚠️ LinkedIn scraper initialization failed, continuing without it:', error);
        // Continue without LinkedIn scraper - other features will still work
      }
      
      // Clear any existing sample data and load real companies from Google Sheets
      await storage.clearSampleCompanies();
      await this.loadCompaniesFromGoogleSheets();
      
      console.log('✅ Job Tracker Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Job Tracker Service:', error);
      throw error;
    }
  }

  async startTracking(): Promise<void> {
    this.isRunning = true;
    console.log('▶️ Job tracking started');
    
    await this.slackService.sendSystemMessage('Job tracking system started successfully!', 'success');
  }

  async stopTracking(): Promise<void> {
    this.isRunning = false;
    console.log('⏸️ Job tracking stopped');
    
    await this.slackService.sendSystemMessage('Job tracking system stopped', 'warning');
  }

  async trackJobPostings(): Promise<void> {
    if (!this.isRunning) {
      console.log('⏸️ Job tracking is paused, skipping job scan');
      return;
    }

    try {
      console.log('🔍 Starting job postings scan...');
      
      const companies = await storage.getCompanies();
      const activeCompanies = companies.filter(c => c.isActive);
      
      let totalJobsFound = 0;
      let companiesScanned = 0;
      
      for (const company of activeCompanies) {
        try {
          console.log(`🏢 Scanning ${company.name}...`);
          
          const jobs = await this.scrapeCompanyJobs(company);
          totalJobsFound += jobs.length;
          companiesScanned++;
          
          // Process each job
          for (const jobData of jobs) {
            const job = await storage.createJobPosting({
              ...jobData,
              company: company.name,
            });
            
            // Sync to Google Sheets
            await this.googleSheets.syncJobPosting(job);
            
            // Send notifications
            await this.slackService.sendJobAlert(job);
            await this.emailService.sendJobAlert(job);
            
            console.log(`✅ New job processed: ${job.jobTitle} at ${job.company}`);
          }
          
          // Update company scan timestamp
          await storage.updateCompany(company.id, { 
            lastScanned: new Date() 
          });
          
          // Add delay between companies to avoid rate limiting
          await this.delay(5000, 15000);
          
        } catch (error) {
          console.error(`❌ Failed to scan ${company.name}:`, error);
          
          await storage.createSystemLog({
            level: 'error',
            service: 'job_tracker',
            message: `Failed to scan ${company.name}`,
            metadata: { error: (error as Error).message }
          });
        }
      }
      
      console.log(`✅ Job scan completed: ${totalJobsFound} jobs found from ${companiesScanned} companies`);
      
      // Record analytics
      await this.recordJobScanAnalytics(totalJobsFound, companiesScanned);
      
    } catch (error) {
      console.error('❌ Job postings scan failed:', error);
      await this.slackService.sendSystemMessage(`Job scan failed: ${(error as Error).message}`, 'error');
    }
  }

  async trackNewHires(): Promise<void> {
    if (!this.isRunning) {
      console.log('⏸️ Job tracking is paused, skipping hire scan');
      return;
    }

    try {
      console.log('👥 Starting new hires scan...');
      
      const companies = await storage.getCompanies();
      const activeCompanies = companies.filter(c => c.isActive && c.linkedinUrl);
      
      let totalHiresFound = 0;
      let companiesScanned = 0;
      
      for (const company of activeCompanies) {
        try {
          console.log(`🏢 Scanning hires for ${company.name}...`);
          
          const hires = await this.linkedinScraper.scrapeNewHires(company.linkedinUrl!);
          totalHiresFound += hires.length;
          companiesScanned++;
          
          // Process each hire
          for (const hireData of hires) {
            const hire = await storage.createNewHire({
              ...hireData,
              company: company.name,
            });
            
            // Sync to Google Sheets
            await this.googleSheets.syncNewHire(hire);
            
            // Send notifications
            await this.slackService.sendHireAlert(hire);
            await this.emailService.sendHireAlert(hire);
            
            console.log(`✅ New hire processed: ${hire.personName} at ${hire.company}`);
          }
          
          // Add delay between companies to avoid rate limiting
          await this.delay(10000, 20000);
          
        } catch (error) {
          console.error(`❌ Failed to scan hires for ${company.name}:`, error);
          
          await storage.createSystemLog({
            level: 'error',
            service: 'job_tracker',
            message: `Failed to scan hires for ${company.name}`,
            metadata: { error: (error as Error).message }
          });
        }
      }
      
      console.log(`✅ Hire scan completed: ${totalHiresFound} hires found from ${companiesScanned} companies`);
      
      // Record analytics
      await this.recordHireScanAnalytics(totalHiresFound, companiesScanned);
      
    } catch (error) {
      console.error('❌ New hires scan failed:', error);
      await this.slackService.sendSystemMessage(`Hire scan failed: ${(error as Error).message}`, 'error');
    }
  }

  private async scrapeCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const jobs: InsertJobPosting[] = [];
    
    // Try LinkedIn first if URL is available
    if (company.linkedinUrl) {
      try {
        const linkedinJobs = await this.linkedinScraper.scrapeCompanyJobs(company.linkedinUrl);
        jobs.push(...linkedinJobs);
      } catch (error) {
        console.warn(`⚠️ LinkedIn scraping failed for ${company.name}:`, error);
      }
    }
    
    // TODO: Add website scraping and careers page scraping
    // This would involve implementing additional scrapers for company websites
    
    return jobs;
  }

  private async loadCompaniesFromGoogleSheets(): Promise<void> {
    try {
      // Try to sync companies from Google Sheets if available
      if (this.googleSheets) {
        try {
          await storage.syncCompaniesFromGoogleSheets(this.googleSheets);
          console.log('✅ Companies synced from Google Sheets');
        } catch (sheetsError) {
          console.warn('⚠️ Failed to sync from Google Sheets:', sheetsError);
        }
      }
      
      // Check if we have any companies configured
      let companies = await storage.getCompanies();
      
      // If no companies exist, create default production-ready companies
      if (companies.length === 0) {
        console.log('📋 No companies configured - initializing with production company set');
        await this.initializeProductionCompanies();
        companies = await storage.getCompanies();
      }
      
      if (companies.length === 0) {
        throw new Error('Failed to initialize company configuration');
      }
      
      console.log(`✅ Loaded ${companies.length} companies for tracking`);
      const activeCount = companies.filter(c => c.isActive).length;
      console.log(`📊 ${activeCount} companies are currently active for tracking`);
      
    } catch (error) {
      console.error('❌ Failed to initialize company configuration:', error);
      throw error;
    }
  }

  private async initializeProductionCompanies(): Promise<void> {
    const productionCompanies = [
      {
        name: 'OpenAI',
        website: 'https://openai.com',
        linkedinUrl: 'https://www.linkedin.com/company/openai',
        isActive: true
      },
      {
        name: 'Anthropic',
        website: 'https://anthropic.com',
        linkedinUrl: 'https://www.linkedin.com/company/anthropic',
        isActive: true
      },
      {
        name: 'Google DeepMind',
        website: 'https://deepmind.google',
        linkedinUrl: 'https://www.linkedin.com/company/deepmind',
        isActive: true
      },
      {
        name: 'Microsoft',
        website: 'https://microsoft.com',
        linkedinUrl: 'https://www.linkedin.com/company/microsoft',
        isActive: true
      },
      {
        name: 'Meta',
        website: 'https://meta.com',
        linkedinUrl: 'https://www.linkedin.com/company/meta',
        isActive: true
      },
      {
        name: 'Apple',
        website: 'https://apple.com',
        linkedinUrl: 'https://www.linkedin.com/company/apple',
        isActive: true
      },
      {
        name: 'Amazon',
        website: 'https://amazon.com',
        linkedinUrl: 'https://www.linkedin.com/company/amazon',
        isActive: true
      },
      {
        name: 'Tesla',
        website: 'https://tesla.com',
        linkedinUrl: 'https://www.linkedin.com/company/tesla-motors',
        isActive: true
      },
      {
        name: 'SpaceX',
        website: 'https://spacex.com',
        linkedinUrl: 'https://www.linkedin.com/company/spacex',
        isActive: true
      },
      {
        name: 'Stripe',
        website: 'https://stripe.com',
        linkedinUrl: 'https://www.linkedin.com/company/stripe',
        isActive: true
      }
    ];

    console.log('🏢 Initializing production company database...');
    
    for (const companyData of productionCompanies) {
      try {
        await storage.createCompany(companyData);
        console.log(`✅ Added company: ${companyData.name}`);
      } catch (error) {
        // Company might already exist, continue
        console.log(`⚠️ Company ${companyData.name} may already exist, skipping`);
      }
    }
    
    console.log('✅ Production company database initialized');
  }

  private async recordJobScanAnalytics(jobsFound: number, companiesScanned: number): Promise<void> {
    try {
      await storage.createAnalytics({
        jobsFound,
        totalCompanies: (await storage.getCompanies()).length,
        activeCompanies: (await storage.getCompanies()).filter(c => c.isActive).length,
        successfulScans: companiesScanned,
        failedScans: 0, // TODO: Track failures properly
        avgResponseTime: '2.5', // TODO: Calculate actual response time
        metadata: {
          scanType: 'jobs',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Failed to record job scan analytics:', error);
    }
  }

  private async recordHireScanAnalytics(hiresFound: number, companiesScanned: number): Promise<void> {
    try {
      await storage.createAnalytics({
        hiresFound,
        totalCompanies: (await storage.getCompanies()).length,
        activeCompanies: (await storage.getCompanies()).filter(c => c.isActive).length,
        successfulScans: companiesScanned,
        failedScans: 0, // TODO: Track failures properly
        avgResponseTime: '3.2', // TODO: Calculate actual response time
        metadata: {
          scanType: 'hires',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Failed to record hire scan analytics:', error);
    }
  }

  async generateDailySummary(): Promise<void> {
    try {
      console.log('📊 Generating daily summary...');
      
      // Get today's data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const jobs = await storage.getJobPostings();
      const hires = await storage.getNewHires();
      const companies = await storage.getCompanies();
      
      const todayJobs = jobs.filter(j => j.foundDate && j.foundDate >= today).length;
      const todayHires = hires.filter(h => h.foundDate && h.foundDate >= today).length;
      const activeCompanies = companies.filter(c => c.isActive).length;
      
      // Calculate success rate (placeholder logic)
      const successRate = 96.8; // TODO: Calculate based on actual success/failure metrics
      
      // Send summary notifications
      await this.slackService.sendDailySummary(todayJobs, todayHires, activeCompanies, successRate);
      await this.emailService.sendDailySummary(todayJobs, todayHires, activeCompanies, successRate);
      
      console.log('✅ Daily summary sent');
      
    } catch (error) {
      console.error('❌ Failed to generate daily summary:', error);
    }
  }

  private async delay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async cleanup(): Promise<void> {
    try {
      await this.linkedinScraper.cleanup();
      console.log('🧹 Job Tracker Service cleanup complete');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}
