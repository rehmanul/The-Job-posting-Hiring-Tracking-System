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
    const logMessage = `🎯 PROFESSIONAL job tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'sequential_job_tracker', logMessage);

    // ONLY CAREER PAGE SCRAPING - HIGHEST QUALITY
    try {
      console.log(`🏢 Professional career page extraction for ${company.name}`);
      const careerJobs = await this.getProfessionalCareerPageJobs(company);
      console.log(`✅ Found ${careerJobs.length} QUALITY jobs for ${company.name}`);
      
      const resultMessage = `✅ Professional tracking found ${careerJobs.length} quality jobs for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'sequential_job_tracker', resultMessage);
      
      return careerJobs;
    } catch (error) {
      console.error(`❌ Professional job tracking failed for ${company.name}:`, error);
      return [];
    }
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

  // PROFESSIONAL CAREER PAGE EXTRACTION
  private async getProfessionalCareerPageJobs(company: Company): Promise<InsertJobPosting[]> {
    if (!company.careerPageUrl && !company.website) return [];

    try {
      const careerUrl = company.careerPageUrl || `${company.website}/careers`;
      console.log(`🎯 Professional extraction from: ${careerUrl}`);
      
      const response = await fetch(careerUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        console.warn(`❌ Career page returned ${response.status} for ${company.name}`);
        return [];
      }
      
      const html = await response.text();
      const jobs = this.extractProfessionalJobsFromHTML(html, company);
      
      // Filter by date and validate quality
      const qualityJobs = jobs.filter(job => {
        const postedDate = job.postedDate || new Date();
        const isRecent = postedDate >= new Date('2025-08-14');
        const isQuality = this.validateJobQuality(job);
        return isRecent && isQuality;
      });
      
      console.log(`🎯 Extracted ${jobs.length} raw jobs, ${qualityJobs.length} passed quality check`);
      return qualityJobs;
      
    } catch (error) {
      console.error(`❌ Professional job extraction failed for ${company.name}:`, error);
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

  private extractProfessionalJobsFromHTML(html: string, company: Company): InsertJobPosting[] {
    const jobs: InsertJobPosting[] = [];
    
    // PROFESSIONAL JOB EXTRACTION PATTERNS
    const professionalPatterns = [
      // Job titles in headers with professional keywords
      /<h[1-6][^>]*>\s*([^<]*(?:Engineer|Developer|Manager|Director|Lead|Senior|Principal|Analyst|Specialist|Coordinator|Designer|Architect|Consultant|Executive|Officer)[^<]*?)\s*<\/h[1-6]>/gi,
      
      // Job links with titles
      /<a[^>]*href="[^"]*(?:job|career|position)[^"]*"[^>]*>\s*([^<]{10,80})\s*<\/a>/gi,
      
      // Job cards/containers
      /<div[^>]*class="[^"]*(?:job|position|role|career)[^"]*"[^>]*>[^<]*<[^>]*>\s*([^<]{10,80})\s*<\/[^>]*>/gi,
      
      // List items with job titles
      /<li[^>]*>[^<]*<[^>]*>\s*([^<]*(?:Engineer|Developer|Manager|Director|Lead|Senior|Principal)[^<]*?)\s*<\/[^>]*>/gi,
      
      // Span/div with job title classes
      /<(?:span|div)[^>]*class="[^"]*(?:title|name|position)[^"]*"[^>]*>\s*([^<]{10,80})\s*<\/(?:span|div)>/gi
    ];
    
    for (const pattern of professionalPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const rawTitle = match[1].trim();
        const cleanTitle = this.cleanJobTitle(rawTitle);
        
        if (this.isValidJobTitle(cleanTitle)) {
          const location = this.extractLocationFromContext(html, match.index) || 'Remote/Hybrid';
          const jobType = this.extractJobTypeFromContext(html, match.index) || 'Full-time';
          
          jobs.push({
            jobTitle: cleanTitle,
            company: company.name,
            location: location,
            jobType: jobType,
            description: this.extractJobDescription(html, match.index),
            requirements: '',
            salary: this.extractSalaryFromContext(html, match.index),
            postedDate: new Date(),
            applicationUrl: company.careerPageUrl || company.website || '',
            source: 'Professional Career Page',
            foundDate: new Date()
          });
        }
      }
    }
    
    return this.deduplicateJobs(jobs);
  }
  
  private cleanJobTitle(title: string): string {
    return title
      .replace(/[\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[^a-zA-Z]*/, '')
      .replace(/[^a-zA-Z]*$/, '')
      .trim();
  }
  
  private isValidJobTitle(title: string): boolean {
    if (!title || title.length < 5 || title.length > 100) return false;
    
    // Must contain professional keywords
    const professionalKeywords = [
      'engineer', 'developer', 'manager', 'director', 'lead', 'senior', 'principal',
      'analyst', 'specialist', 'coordinator', 'designer', 'architect', 'consultant',
      'executive', 'officer', 'head', 'chief', 'vice president', 'vp'
    ];
    
    const hasKeyword = professionalKeywords.some(keyword => 
      title.toLowerCase().includes(keyword)
    );
    
    // Reject generic/invalid titles
    const invalidTitles = [
      'working', 'job', 'position', 'role', 'career', 'opportunity', 'opening',
      'apply', 'click', 'here', 'more', 'view', 'see', 'all', 'jobs'
    ];
    
    const isInvalid = invalidTitles.some(invalid => 
      title.toLowerCase() === invalid || title.toLowerCase().includes(invalid)
    );
    
    return hasKeyword && !isInvalid;
  }
  
  private extractLocationFromContext(html: string, index: number): string | null {
    const contextStart = Math.max(0, index - 500);
    const contextEnd = Math.min(html.length, index + 500);
    const context = html.slice(contextStart, contextEnd);
    
    const locationPatterns = [
      /(?:location|office|based|remote|hybrid)[^>]*>\s*([^<]{3,50})\s*</gi,
      /(Remote|Hybrid|London|New York|San Francisco|Berlin|Amsterdam|Dublin|Malta|Gibraltar)/gi
    ];
    
    for (const pattern of locationPatterns) {
      const match = context.match(pattern);
      if (match) return match[1] || match[0];
    }
    
    return null;
  }
  
  private extractJobTypeFromContext(html: string, index: number): string | null {
    const contextStart = Math.max(0, index - 300);
    const contextEnd = Math.min(html.length, index + 300);
    const context = html.slice(contextStart, contextEnd);
    
    const typeMatch = context.match(/(Full-time|Part-time|Contract|Temporary|Permanent|Freelance)/gi);
    return typeMatch ? typeMatch[0] : null;
  }
  
  private extractSalaryFromContext(html: string, index: number): string | null {
    const contextStart = Math.max(0, index - 300);
    const contextEnd = Math.min(html.length, index + 300);
    const context = html.slice(contextStart, contextEnd);
    
    const salaryMatch = context.match(/[£$€]\s*[\d,]+(?:\s*-\s*[£$€]?\s*[\d,]+)?(?:\s*(?:per\s+)?(?:year|month|hour|annum))?/gi);
    return salaryMatch ? salaryMatch[0] : null;
  }
  
  private extractJobDescription(html: string, index: number): string {
    const contextStart = Math.max(0, index - 200);
    const contextEnd = Math.min(html.length, index + 800);
    const context = html.slice(contextStart, contextEnd);
    
    // Extract text content, remove HTML tags
    const textContent = context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return textContent.slice(0, 500);
  }
  
  private validateJobQuality(job: InsertJobPosting): boolean {
    // Quality validation
    if (!job.jobTitle || job.jobTitle.length < 5) return false;
    if (job.jobTitle.toLowerCase().includes('working')) return false;
    if (job.jobTitle.toLowerCase().includes('click')) return false;
    
    return true;
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