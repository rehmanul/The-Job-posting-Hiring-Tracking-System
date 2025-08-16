import type { Company, InsertJobPosting } from '@shared/schema';
import { storage } from '../storage';

export class SequentialJobTracker {
  private linkedinAccessToken: string;
  private googleProjectId: string;
  private customSearchKey: string;
  private customSearchEngineId: string;

  constructor() {
    this.linkedinAccessToken = process.env.LINKEDIN_ACCESS_TOKEN || '';
    this.googleProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    this.customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.customSearchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';
  }

  async trackCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const logMessage = `🔍 Sequential job tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'sequential_job_tracker', logMessage);

    let jobs: InsertJobPosting[] = [];

    // STEP 1: LinkedIn Official API
    try {
      console.log(`🔗 Step 1: LinkedIn Official API for ${company.name}`);
      const linkedinJobs = await this.getLinkedInAPIJobs(company);
      jobs.push(...linkedinJobs);
      console.log(`✅ LinkedIn API found ${linkedinJobs.length} jobs`);
    } catch (error) {
      console.warn(`⚠️ LinkedIn API failed for ${company.name}:`, error);
    }

    // STEP 2: Webhook Data (if available)
    try {
      console.log(`📡 Step 2: Webhook data for ${company.name}`);
      const webhookJobs = await this.getWebhookJobs(company);
      jobs.push(...webhookJobs);
      console.log(`✅ Webhook found ${webhookJobs.length} jobs`);
    } catch (error) {
      console.warn(`⚠️ Webhook failed for ${company.name}:`, error);
    }

    // STEP 3: Company Career Pages
    if (jobs.length < 5) {
      try {
        console.log(`🏢 Step 3: Career page scraping for ${company.name}`);
        const careerJobs = await this.getCareerPageJobs(company);
        jobs.push(...careerJobs);
        console.log(`✅ Career page found ${careerJobs.length} jobs`);
      } catch (error) {
        console.warn(`⚠️ Career page failed for ${company.name}:`, error);
      }
    }

    // STEP 4: Custom Search (last resort)
    if (jobs.length < 3) {
      try {
        console.log(`🔍 Step 4: Custom Search fallback for ${company.name}`);
        const searchJobs = await this.getCustomSearchJobs(company);
        jobs.push(...searchJobs);
        console.log(`✅ Custom Search found ${searchJobs.length} jobs`);
      } catch (error) {
        console.warn(`⚠️ Custom Search failed for ${company.name}:`, error);
      }
    }

    const uniqueJobs = this.deduplicateJobs(jobs);
    const resultMessage = `✅ Sequential tracking found ${uniqueJobs.length} total jobs for ${company.name}`;
    console.log(resultMessage);
    await this.logToDatabase('info', 'sequential_job_tracker', resultMessage);

    return uniqueJobs;
  }

  // STEP 1: LinkedIn Official API
  private async getLinkedInAPIJobs(company: Company): Promise<InsertJobPosting[]> {
    if (!this.linkedinAccessToken) return [];

    try {
      // Jobs Search API
      const jobsUrl = `https://api.linkedin.com/rest/jobs?q=byCompany&company=${encodeURIComponent(company.name)}&count=25`;
      
      const response = await fetch(jobsUrl, {
        headers: {
          'Authorization': `Bearer ${this.linkedinAccessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status}`);
      }

      const data = await response.json();
      const jobs = data.elements || [];
      
      return jobs
        .filter((job: any) => {
          const postedDate = job.listedAt ? new Date(job.listedAt) : new Date();
          return postedDate >= new Date('2025-08-14');
        })
        .map((job: any) => ({
          jobTitle: job.title || 'Untitled Position',
          company: company.name,
          location: job.formattedLocation || 'Not specified',
          jobType: job.workplaceTypes?.[0] || 'Full-time',
          description: job.description?.text || '',
          requirements: '',
          salary: null,
          postedDate: job.listedAt ? new Date(job.listedAt) : new Date(),
          applicationUrl: job.dashEntityUrn || '',
          source: 'LinkedIn Official API',
          foundDate: new Date()
        }));
    } catch (error) {
      console.error(`LinkedIn Jobs API error for ${company.name}:`, error);
      return [];
    }
  }

  // STEP 2: Webhook Data
  private async getWebhookJobs(company: Company): Promise<InsertJobPosting[]> {
    try {
      // Check for recent webhook job data
      const recentWebhookData = await storage.getWebhookData(company.name, 7); // Last 7 days
      const jobs: InsertJobPosting[] = [];

      for (const webhookEntry of recentWebhookData) {
        if (webhookEntry.type === 'job_posting') {
          const postedDate = webhookEntry.postedDate ? new Date(webhookEntry.postedDate) : new Date();
          if (postedDate >= new Date('2025-08-14'));
            jobs.push({
              jobTitle: webhookEntry.jobTitle,
              company: company.name,
              location: webhookEntry.location || 'Not specified',
              jobType: webhookEntry.jobType || 'Full-time',
              description: webhookEntry.description || '',
              requirements: webhookEntry.requirements || '',
              salary: webhookEntry.salary,
              postedDate,
              applicationUrl: webhookEntry.applicationUrl || '',
              source: 'LinkedIn Webhook',
              foundDate: new Date()
            });
          }
        }
      }

      return jobs;
    } catch (error) {
      console.error(`Webhook jobs error for ${company.name}:`, error);
      return [];
    }
  }

  // STEP 3: Company Career Pages
  private async getCareerPageJobs(company: Company): Promise<InsertJobPosting[]> {
    if (!company.careerPageUrl && !company.website) return [];

    try {
      const careerUrl = company.careerPageUrl || `${company.website}/careers`;
      console.log(`Scraping career page: ${careerUrl}`);
      
      // Basic career page scraping
      const response = await fetch(careerUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) return [];
      
      const html = await response.text();
      const jobs = this.extractJobsFromHTML(html, company);
      
      return jobs.filter(job => {
        const postedDate = job.postedDate || new Date();
        return postedDate >= new Date('2025-08-14');
      });
    } catch (error) {
      console.error(`Career page scraping error for ${company.name}:`, error);
      return [];
    }
  }

  // STEP 4: Custom Search (fallback)
  private async getCustomSearchJobs(company: Company): Promise<InsertJobPosting[]> {
    if (!this.customSearchKey || !this.customSearchEngineId) return [];

    try {
      const query = `"${company.name}" jobs OR careers site:linkedin.com/jobs OR site:indeed.com`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=10`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      const jobs: InsertJobPosting[] = [];
      if (data.items) {
        for (const item of data.items) {
          const job = this.extractJobFromSearchResult(item, company);
          if (job && job.postedDate >= new Date('2025-08-14')) {
            jobs.push(job);
          }
        }
      }

      return jobs;
    } catch (error) {
      console.error(`Custom Search jobs error for ${company.name}:`, error);
      return [];
    }
  }

  private extractJobFromSearchResult(item: any, company: Company): InsertJobPosting | null {
    const title = item.title;
    const snippet = item.snippet;
    
    // Extract job title from search result
    const jobTitleMatch = title.match(/^(.+?)\s*(?:-|at|@)\s*(.+?)(?:\s*\||$)/i);
    if (!jobTitleMatch) return null;

    const jobTitle = jobTitleMatch[1].trim();
    const location = this.extractLocation(snippet) || 'Not specified';
    const jobType = this.extractJobType(snippet) || 'Full-time';

    return {
      jobTitle,
      company: company.name,
      location,
      jobType,
      description: snippet || '',
      requirements: '',
      salary: this.extractSalary(snippet),
      postedDate: new Date(),
      applicationUrl: item.link,
      source: 'Custom Search',
      foundDate: new Date()
    };
  }

  private extractLocation(text: string): string | null {
    const locationPatterns = [
      /(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:,\s*[A-Z]{2})?)/,
      /(Remote|Hybrid|On-site)/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  private extractJobType(text: string): string | null {
    const typeMatch = text.match(/(Full-time|Part-time|Contract|Temporary|Internship)/i);
    return typeMatch ? typeMatch[1] : null;
  }

  private extractSalary(text: string): string | null {
    const salaryMatch = text.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per\s+)?(?:year|annually))?/i);
    return salaryMatch ? salaryMatch[0] : null;
  }

  private deduplicateJobs(jobs: InsertJobPosting[]): InsertJobPosting[] {
    const seen = new Set<string>();
    return jobs.filter(job => {
      const key = `${job.jobTitle.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private extractJobsFromHTML(html: string, company: Company): InsertJobPosting[] {
    const jobs: InsertJobPosting[] = [];
    
    // Simple job extraction patterns
    const jobPatterns = [
      /<h[1-6][^>]*>([^<]*(?:engineer|developer|manager|analyst|specialist|coordinator)[^<]*)<\/h[1-6]>/gi,
      /<a[^>]*href="[^"]*job[^"]*"[^>]*>([^<]+)<\/a>/gi,
      /<div[^>]*class="[^"]*job[^"]*"[^>]*>.*?<.*?>([^<]+)<\/.*?>/gi
    ];
    
    for (const pattern of jobPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const title = match[1].trim();
        if (title.length > 5 && title.length < 100) {
          jobs.push({
            jobTitle: title,
            company: company.name,
            location: 'Not specified',
            jobType: 'Full-time',
            description: '',
            requirements: '',
            salary: null,
            postedDate: new Date(),
            applicationUrl: company.careerPageUrl || company.website || '',
            source: 'Career Page',
            foundDate: new Date()
          });
        }
      }
    }
    
    return jobs;
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