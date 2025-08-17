import { storage } from '../storage';
import { GoogleSheetsService } from './googleSheets';
import { GoogleSheetsIntegrationService } from './googleSheetsIntegration';
import { LinkedInAPIService } from './linkedinAPI';
import { SlackService } from './slackService';
import { EmailService } from './emailService';
import { initializeGamingCompanies } from '../config/targetCompanies';
import type { Company, InsertJobPosting, InsertNewHire } from '@shared/schema';

export class JobTrackerService {
  protected googleSheets: GoogleSheetsService;
  private googleSheetsIntegration: GoogleSheetsIntegrationService;
  protected linkedinAPI: LinkedInAPIService;
  protected slackService: SlackService;
  protected emailService: EmailService;
  protected isRunning = false;

  private linkedinSessionCookies: any[] | null | undefined = null;

  constructor(linkedinSessionCookies?: any[] | null) {
    this.googleSheets = new GoogleSheetsService();
    this.googleSheetsIntegration = new GoogleSheetsIntegrationService();
    this.linkedinSessionCookies = linkedinSessionCookies;
    this.linkedinAPI = new LinkedInAPIService();
    this.slackService = new SlackService();
    this.emailService = new EmailService();
  }

  // Placeholder: Set LinkedIn session cookies (call this after OAuth login or via API)
  setLinkedInSessionCookies(cookies: any[]) {
    this.linkedinSessionCookies = cookies;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Job Tracker Service...');
      
      await this.googleSheets.initialize();
      await this.linkedinAPI.initialize();
      
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
      await this.logToDatabase('info', 'job_tracker', '👥 Starting new hires scan...');
      await this.trackNewHires();
      
      console.log('🔍 Starting job postings scan...');
      await this.logToDatabase('info', 'job_tracker', '🔍 Starting job postings scan...');
      await this.trackJobPostings();
      
      console.log('📊 Updating analytics...');
      await this.logToDatabase('info', 'job_tracker', '📊 Updating analytics...');
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
      
      let companies = await storage.getCompanies();
      let activeCompanies = companies.filter(c => c.isActive);
      
      // Check if companies are missing LinkedIn URLs and reload if needed
      const companiesWithoutLinkedIn = activeCompanies.filter(c => !c.linkedinUrl);
      if (companiesWithoutLinkedIn.length > 0) {
        console.log(`🔄 ${companiesWithoutLinkedIn.length} companies missing LinkedIn URLs, reloading from Google Sheets...`);
        await this.syncCompaniesFromGoogleSheets();
        companies = await storage.getCompanies();
        activeCompanies = companies.filter(c => c.isActive);
      }
      
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
          const scanMessage = `🏢 Scanning ${company.name}...`;
          console.log(scanMessage);
          await this.logToDatabase('info', 'job_tracker', scanMessage);
          
          const jobs = await this.scrapeCompanyJobs(company);
          
          // Deduplicate jobs before processing
          const existingJobs = await storage.getJobPostings();
          const uniqueJobsCount = jobs.filter(jobData => {
            return !existingJobs.some(existing => 
              existing.jobTitle.toLowerCase() === jobData.jobTitle.toLowerCase() && 
              existing.company.toLowerCase() === company.name.toLowerCase()
            );
          }).length;
          totalJobsFound += uniqueJobsCount;
          companiesScanned++;
          const uniqueJobs = jobs.filter(jobData => {
            return !existingJobs.some(existing => 
              existing.jobTitle.toLowerCase() === jobData.jobTitle.toLowerCase() && 
              existing.company.toLowerCase() === company.name.toLowerCase()
            );
          });
          
          console.log(`📊 Found ${jobs.length} jobs, ${uniqueJobs.length} are truly NEW`);
          
          for (const jobData of uniqueJobs) {
            try {
              const job = await storage.createJobPosting({
                ...jobData,
                company: company.name,
              });
              
              // Only notify for truly unique jobs
              await this.googleSheets.syncJobPosting(job);
              await this.slackService.sendJobAlert(job);
              await this.emailService.sendJobAlert(job);
              
              const jobMessage = `✅ NEW UNIQUE job processed: ${job.jobTitle} at ${job.company}`;
              console.log(jobMessage);
              await this.logToDatabase('info', 'job_tracker', jobMessage);
            } catch (err) {
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
      
      let companies = await storage.getCompanies();
      let activeCompanies = companies.filter(c => c.isActive);
      
      // Check if companies are missing LinkedIn URLs and reload if needed
      const companiesWithoutLinkedIn = activeCompanies.filter(c => !c.linkedinUrl);
      if (companiesWithoutLinkedIn.length > 0) {
        console.log(`🔄 ${companiesWithoutLinkedIn.length} companies missing LinkedIn URLs, reloading from Google Sheets...`);
        await this.syncCompaniesFromGoogleSheets();
        companies = await storage.getCompanies();
        activeCompanies = companies.filter(c => c.isActive);
      }
      
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
            const hireMessage = `🎯 AGGRESSIVE hire tracking for ${company.name}...`;
            console.log(hireMessage);
            await this.logToDatabase('info', 'job_tracker', hireMessage);
            
            // FIXED hire tracker: Properly extracts names from LinkedIn URLs and search results
            const { FixedHireTracker } = await import('./fixedHireTracker');
            const hireTracker = new FixedHireTracker();
            
            const hires = await hireTracker.trackCompanyHires(company);
            const foundMessage = `🚀 FIXED tracker found ${hires.length} REAL NAMES (Andrew Hernandez style extraction)`;
            console.log(foundMessage);
            await this.logToDatabase('info', 'job_tracker', foundMessage);
            // Validate and deduplicate hires before processing
            const validHires = hires.filter(hireData => 
              hireData.personName && hireData.company && hireData.position
            );
            
            const existingHires = await storage.getNewHires();
            const uniqueHiresCount = validHires.filter(hireData => {
              return !existingHires.some(existing => 
                existing.personName.toLowerCase() === hireData.personName.toLowerCase() && 
                existing.company.toLowerCase() === company.name.toLowerCase()
              );
            }).length;
            totalHiresFound += uniqueHiresCount;
            companiesScanned++;
            const uniqueHires = validHires.filter(hireData => {
              return !existingHires.some(existing => 
                existing.personName.toLowerCase() === hireData.personName.toLowerCase() && 
                existing.company.toLowerCase() === company.name.toLowerCase()
              );
            });
            
            console.log(`📊 Found ${hires.length} hires, ${uniqueHires.length} are truly NEW`);
            
            for (const hireData of uniqueHires) {
              let hire;
              try {
                hire = await storage.createNewHire({
                  ...hireData,
                  company: company.name,
                });
              } catch (err) {
                console.error('❌ Failed to create new hire in storage:', err, hireData);
                continue;
              }
              
              // Only notify for truly unique hires
              try {
                await this.googleSheets.syncNewHire(hire);
                await this.slackService.sendHireAlert(hire);
                await this.emailService.sendHireAlert(hire);
              } catch (err) {
                console.error('❌ Failed to send notifications:', err, hire);
              }
              
              const processedMessage = `✅ NEW UNIQUE hire processed: ${hire.personName} at ${hire.company}`;
              console.log(processedMessage);
              await this.logToDatabase('info', 'job_tracker', processedMessage);
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
      
      const completedMessage = `✅ Hire scan completed: ${totalHiresFound} hires found from ${companiesScanned} companies`;
      console.log(completedMessage);
      await this.logToDatabase('info', 'job_tracker', completedMessage);
      
      await this.recordHireScanAnalytics(totalHiresFound, companiesScanned);
      
    } catch (error) {
      console.error('❌ New hires scan failed:', error);
      await this.slackService.sendSystemMessage(`Hire scan failed: ${(error as Error).message}`, 'error');
    }
  }
  
  // REMOVED: LinkedIn token method - using direct scraping now



  private async scrapeCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const jobs: InsertJobPosting[] = [];
    
    // BACK TO ORIGINAL: Use proper job scraping instead of garbage Custom Search
    try {
      const { SequentialJobTracker } = await import('./sequentialJobTracker');
      const jobTracker = new SequentialJobTracker();
      const trackedJobs = await jobTracker.trackCompanyJobs(company);
      jobs.push(...trackedJobs);
        
      const apiMessage = `✅ Original job tracker found ${trackedJobs.length} QUALITY JOBS for ${company.name}`;
      console.log(apiMessage);
      await this.logToDatabase('info', 'job_tracker', apiMessage);
    } catch (error) {
      console.warn(`⚠️ Original job tracking failed for ${company.name}:`, error);
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
      await this.linkedinAPI.cleanup();
      console.log('🧹 Job Tracker Service cleanup complete');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
  
  private async logToDatabase(level: string, service: string, message: string): Promise<void> {
    try {
      await storage.createSystemLog({
        level,
        service,
        message,
        metadata: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      // Ignore database logging errors
    }
  }
}
