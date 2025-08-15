import { storage } from '../storage';
import { GoogleSheetsService } from './googleSheets';
import { GoogleSheetsIntegrationService } from './googleSheetsIntegration';
import { LinkedInScraper } from './linkedinScraper';
import { LinkedInAPIService } from './linkedinAPI';
import { WebsiteScraper } from './websiteScraper';
// REMOVED: All broken services replaced with aggressive tracker
import { SlackService } from './slackService';
import { EmailService } from './emailService';
import { initializeGamingCompanies } from '../config/targetCompanies';
import type { Company, InsertJobPosting, InsertNewHire } from '@shared/schema';
import { GoogleSearchService } from './googleSearchService';

export class JobTrackerService {
  protected googleSheets: GoogleSheetsService;
  private googleSheetsIntegration: GoogleSheetsIntegrationService;
  protected linkedinScraper: LinkedInScraper;
  protected linkedinAPI: LinkedInAPIService;
  private websiteScraper: WebsiteScraper;
  // REMOVED: All broken services
  protected slackService: SlackService;
  protected emailService: EmailService;
  protected isRunning = false;

  private linkedinSessionCookies: any[] | null | undefined = null;
  private googleSearchService: GoogleSearchService;

  constructor(linkedinSessionCookies?: any[] | null) {
    this.googleSheets = new GoogleSheetsService();
    this.googleSheetsIntegration = new GoogleSheetsIntegrationService();
    this.linkedinSessionCookies = linkedinSessionCookies;
    this.linkedinScraper = new LinkedInScraper(this.linkedinSessionCookies ?? undefined);
    this.linkedinAPI = new LinkedInAPIService();
    this.websiteScraper = new WebsiteScraper();
    // REMOVED: All broken services
    this.slackService = new SlackService();
    this.emailService = new EmailService();
    this.googleSearchService = new GoogleSearchService();
  }

  // Placeholder: Set LinkedIn session cookies (call this after OAuth login or via API)
  setLinkedInSessionCookies(cookies: any[]) {
    this.linkedinSessionCookies = cookies;
    this.linkedinScraper = new LinkedInScraper(this.linkedinSessionCookies ?? undefined);
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Job Tracker Service...');
      
      await this.googleSheets.initialize();
      await this.linkedinScraper.initialize();
      await this.linkedinAPI.initialize();
      await this.websiteScraper.initialize();
      // REMOVED: Broken service initialization
      
      // Load companies from Google Sheets and sync to storage
      console.log('🏢 Loading companies from Google Sheets...');
      await this.syncCompaniesFromGoogleSheets();
      
      console.log('✅ Job Tracker Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Job Tracker Service:', error);
      throw error;
    }
  }

  private async syncCompaniesFromGoogleSheets(): Promise<void> {
    try {
      const companiesData = await this.googleSheets.getCompanies();
      
      if (companiesData.length === 0) {
        console.warn('⚠️ No companies found in Google Sheets');
        return;
      }
      
      // Clear existing companies and sync from Google Sheets
      await storage.clearSampleCompanies();
      
      for (const companyData of companiesData) {
        await storage.createCompany({
          name: companyData.name || '',
          website: companyData.website || '',
          linkedinUrl: companyData.linkedinUrl || '',
          careerPageUrl: companyData.careerPageUrl || '',
          isActive: companyData.isActive !== false,
        });
      }
      
      console.log(`✅ Synced ${companiesData.length} companies from Google Sheets to storage`);
      
      // Verify sync worked
      const storedCompanies = await storage.getCompanies();
      const activeCompanies = storedCompanies.filter(c => c.isActive);
      console.log(`📊 Storage now has ${storedCompanies.length} companies (${activeCompanies.length} active)`);
      
    } catch (error) {
      console.error('❌ Failed to sync companies from Google Sheets:', error);
      throw error;
    }
  }

  async startTracking(): Promise<void> {
    this.isRunning = true;
    console.log('▶️ Job tracking started');
    
    // Perform initial full scan on startup
    console.log('🚀 Performing initial full tracking scan...');
    
    try {
      // Run tracking tasks sequentially - hires first, then jobs
      console.log('👥 Starting new hires scan...');
      await this.trackNewHires();
      
      console.log('🔍 Starting job postings scan...');
      await this.trackJobPostings();
      
      console.log('📊 Updating analytics...');
      await this.updateAnalytics();
      
      console.log('✅ Initial full tracking scan completed');
      await this.slackService.sendSystemMessage('Job tracking system started with initial scan completed!', 'success');
      
    } catch (error) {
      console.error('❌ Initial tracking scan failed:', error);
      await this.slackService.sendSystemMessage('Job tracking started but initial scan had issues', 'warning');
    }
  }
  
  private async updateAnalytics(): Promise<void> {
    try {
      console.log('📊 Updating system analytics...');
      
      const companies = await storage.getCompanies();
      const jobs = await storage.getJobPostings();
      const hires = await storage.getNewHires();
      
      await storage.createAnalytics({
        totalCompanies: companies.length,
        activeCompanies: companies.filter(c => c.isActive).length,
        jobsFound: jobs.length,
        hiresFound: hires.length,
        successfulScans: companies.filter(c => c.isActive).length,
        failedScans: 0,
        avgResponseTime: '0',
        metadata: {
          scanType: 'startup',
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('✅ Analytics updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update analytics:', error);
    }
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
      
      console.log(`📊 Found ${companies.length} total companies, ${activeCompanies.length} active`);
      
      if (activeCompanies.length === 0) {
        console.log('⚠️ No active companies configured - skipping job scan');
        // Try to reload companies from Google Sheets if storage is empty
        if (companies.length === 0) {
          console.log('🔄 Attempting to reload companies from Google Sheets...');
          await this.syncCompaniesFromGoogleSheets();
          const reloadedCompanies = await storage.getCompanies();
          const reloadedActiveCompanies = reloadedCompanies.filter(c => c.isActive);
          if (reloadedActiveCompanies.length === 0) {
            return;
          }
        } else {
          return;
        }
      }
      
      let totalJobsFound = 0;
      let companiesScanned = 0;
      
      for (const company of activeCompanies) {
        try {
          console.log(`🏢 Scanning ${company.name}...`);
          
          const jobs = await this.scrapeCompanyJobs(company);
          totalJobsFound += jobs.length;
          companiesScanned++;
          
          for (const jobData of jobs) {
            try {
              const job = await storage.createJobPosting({
                ...jobData,
                company: company.name,
              });
              
              await this.googleSheets.syncJobPosting(job);
              await this.slackService.sendJobAlert(job);
              await this.emailService.sendJobAlert(job);
              
              console.log(`✅ New job processed: ${job.jobTitle} at ${job.company}`);
            } catch (err) {
              if ((err as Error).message.includes('Duplicate job detected')) {
                console.log(`🔄 Skipping duplicate job: ${jobData.jobTitle} at ${company.name}`);
                continue;
              }
              console.error('❌ Failed to create job posting:', err, jobData);
            }
          }
          
          await storage.updateCompany(company.id, { 
            isActive: company.isActive, 
            website: company.website,
            linkedinUrl: company.linkedinUrl,
            careerPageUrl: company.careerPageUrl
          });
          
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
      const activeCompanies = companies.filter(c => c.isActive);
      
      console.log(`📊 Found ${companies.length} total companies, ${activeCompanies.length} active`);
      
      if (activeCompanies.length === 0) {
        console.log('⚠️ No active companies configured - skipping hire scan');
        // Try to reload companies from Google Sheets if storage is empty
        if (companies.length === 0) {
          console.log('🔄 Attempting to reload companies from Google Sheets...');
          await this.syncCompaniesFromGoogleSheets();
          const reloadedCompanies = await storage.getCompanies();
          const reloadedActiveCompanies = reloadedCompanies.filter(c => c.isActive);
          if (reloadedActiveCompanies.length === 0) {
            return;
          }
        } else {
          return;
        }
      }
      
      let totalHiresFound = 0;
      let companiesScanned = 0;
      
      // Process companies in smaller batches to avoid rate limits
      const batchSize = 3;
      for (let i = 0; i < activeCompanies.length; i += batchSize) {
        const batch = activeCompanies.slice(i, i + batchSize);
        
        for (const company of batch) {
          try {
            console.log(`🎯 AGGRESSIVE hire tracking for ${company.name}...`);
            
            // NUCLEAR OPTION: Use aggressive tracker that bypasses all broken services
            const { AggressiveHireTracker } = await import('./aggressiveHireTracker.js');
            const aggressiveTracker = new AggressiveHireTracker();
            await aggressiveTracker.initialize();
            
            const hires = await aggressiveTracker.trackCompanyHires(company.name, company.linkedinUrl || undefined);
            console.log(`🚀 AGGRESSIVE tracker found ${hires.length} authentic hires`);
            
            await aggressiveTracker.close();
            totalHiresFound += hires.length;
            companiesScanned++;
            for (const hireData of hires) {
              // Validate hireData fields
              if (!hireData.personName || !hireData.company || !hireData.position) {
                console.warn(`⚠️ Skipping hire with missing fields:`, JSON.stringify(hireData));
                continue;
              }
              let hire;
              try {
                hire = await storage.createNewHire({
                  ...hireData,
                  company: company.name,
                });
              } catch (err) {
                if ((err as Error).message.includes('Duplicate hire detected')) {
                  console.log(`🔄 Skipping duplicate hire: ${hireData.personName} at ${hireData.company}`);
                  continue;
                }
                console.error('❌ Failed to create new hire in storage:', err, hireData);
                continue;
              }
              try {
                await this.googleSheets.syncNewHire(hire);
              } catch (err) {
                console.error('❌ Failed to sync new hire to Google Sheets:', err, hire);
              }
              try {
                await this.slackService.sendHireAlert(hire);
              } catch (err) {
                console.error('❌ Failed to send Slack hire alert:', err, hire);
              }
              try {
                await this.emailService.sendHireAlert(hire);
              } catch (err) {
                console.error('❌ Failed to send email hire alert:', err, hire);
              }
              console.log(`✅ New hire processed: ${hire.personName} at ${hire.company}`);
            }
            await this.delay(3000, 5000); // Shorter delay within batch
          } catch (error) {
            console.error(`❌ Failed to scan hires for ${company.name}:`, error);
          }
        }
        
        // Longer delay between batches to respect rate limits
        if (i + batchSize < activeCompanies.length) {
          console.log(`⏸️ Batch completed, waiting 30s before next batch...`);
          await this.delay(30000, 35000);
        }
      }
      
      console.log(`✅ Hire scan completed: ${totalHiresFound} hires found from ${companiesScanned} companies`);
      
      await this.recordHireScanAnalytics(totalHiresFound, companiesScanned);
      
    } catch (error) {
      console.error('❌ New hires scan failed:', error);
      await this.slackService.sendSystemMessage(`Hire scan failed: ${(error as Error).message}`, 'error');
    }
  }
  
  // REMOVED: LinkedIn token method - using direct scraping now

  protected async searchGoogleForHires(companyName: string): Promise<InsertNewHire[]> {
    return await this.googleSearchService.searchForHires(companyName);
  }

  private async scrapeCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const jobs: InsertJobPosting[] = [];
    
    // Only scrape career pages for job postings
    if (company.careerPageUrl) {
      try {
        const websiteJobs = await this.websiteScraper.scrapeCompanyWebsite(company);
        jobs.push(...websiteJobs);
      } catch (error) {
        console.warn(`⚠️ Career page scraping failed for ${company.name}:`, error);
      }
    }
    
    return jobs;
  }

  private async recordJobScanAnalytics(jobsFound: number, companiesScanned: number): Promise<void> {
    try {
      await storage.createAnalytics({
        jobsFound,
        totalCompanies: (await storage.getCompanies()).length,
        activeCompanies: (await storage.getCompanies()).filter(c => c.isActive).length,
        successfulScans: companiesScanned,
        failedScans: 0, 
        avgResponseTime: '0',
        metadata: {
          scanType: 'jobs',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Failed to record job scan analytics:', error);
    }
  }

  protected async recordHireScanAnalytics(hiresFound: number, companiesScanned: number): Promise<void> {

    try {
      await storage.createAnalytics({
        hiresFound,
        totalCompanies: (await storage.getCompanies()).length,
        activeCompanies: (await storage.getCompanies()).filter(c => c.isActive).length,
        successfulScans: companiesScanned,
        failedScans: 0,
        avgResponseTime: '0',
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
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const jobs = await storage.getJobPostings();
      const hires = await storage.getNewHires();
      const companies = await storage.getCompanies();
      
      const todayJobs = jobs.filter(j => j.foundDate && j.foundDate >= today).length;
      const todayHires = hires.filter(h => h.foundDate && h.foundDate >= today).length;
      const activeCompanies = companies.filter(c => c.isActive).length;
      
      const analytics = await storage.getAnalytics();
      const recentAnalytics = analytics.slice(-7);
      const successRate = recentAnalytics.length > 0 
        ? recentAnalytics.reduce((sum, a) => {
            const successful = a.successfulScans || 0;
            const failed = a.failedScans || 0;
            const total = successful + failed;
            return sum + (total > 0 ? (successful / total * 100) : 0);
          }, 0) / recentAnalytics.length
        : 0;
      
      await this.slackService.sendDailySummary(todayJobs, todayHires, activeCompanies, successRate);
      await this.emailService.sendDailySummary(todayJobs, todayHires, activeCompanies, successRate);
      
      console.log('✅ Daily summary sent');
      
    } catch (error) {
      console.error('❌ Failed to generate daily summary:', error);
    }
  }

  async generateSummaryReports(type: 'Daily' | 'Weekly' | 'Monthly'): Promise<void> {
    try {
      console.log(`📊 Generating ${type.toLowerCase()} summary report...`);
      
      const jobs = await storage.getJobPostings();
      const hires = await storage.getNewHires();
      const companies = await storage.getCompanies();
      
      // Calculate date range based on report type
      const now = new Date();
      let startDate = new Date();
      
      if (type === 'Daily') {
        startDate.setHours(0, 0, 0, 0);
      } else if (type === 'Weekly') {
        startDate.setDate(now.getDate() - 7);
      } else {
        startDate.setMonth(now.getMonth() - 1);
      }
      
      const periodJobs = jobs.filter(j => j.foundDate && j.foundDate >= startDate);
      const periodHires = hires.filter(h => h.foundDate && h.foundDate >= startDate);
      
      // Calculate metrics
      const remoteJobs = periodJobs.filter(j => 
        j.location?.toLowerCase().includes('remote') || 
        j.location?.toLowerCase().includes('anywhere')
      ).length;
      
      // Find top company by job count
      const companyJobCounts = periodJobs.reduce((acc, job) => {
        acc[job.company] = (acc[job.company] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topCompany = Object.entries(companyJobCounts)
        .sort(([,a], [,b]) => b - a)[0] || ['N/A', 0];
      
      // Calculate growth rate (simplified)
      const previousPeriodJobs = type === 'Daily' ? 
        jobs.filter(j => {
          const yesterday = new Date(startDate);
          yesterday.setDate(yesterday.getDate() - 1);
          return j.foundDate && j.foundDate >= yesterday && j.foundDate < startDate;
        }).length : 0;
      
      const growthRate = previousPeriodJobs > 0 ? 
        ((periodJobs.length - previousPeriodJobs) / previousPeriodJobs) * 100 : 0;
      
      // Find most active day (simplified)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const mostActiveDay = dayNames[now.getDay()];
      
      await this.googleSheets.syncSummaryReport({
        type,
        totalJobs: periodJobs.length,
        totalHires: periodHires.length,
        activeCompanies: companies.filter(c => c.isActive).length,
        growthRate,
        topCompany: topCompany[0],
        topCompanyJobs: topCompany[1],
        remoteJobs,
        mostActiveDay
      });
      
      console.log(`✅ ${type} summary report generated`);
      
    } catch (error) {
      console.error(`❌ Failed to generate ${type.toLowerCase()} summary report:`, error);
    }
  }

  protected async delay(min: number, max: number): Promise<void> {

    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async cleanup(): Promise<void> {
    try {
      await this.linkedinScraper.cleanup();
      await this.linkedinAPI.cleanup();
      await this.websiteScraper.cleanup();
      // REMOVED: Broken service cleanup
      console.log('🧹 Job Tracker Service cleanup complete');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}
