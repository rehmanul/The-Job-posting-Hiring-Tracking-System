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
          if (postedDate >= new Date('2025-08-14')) {
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
    
    // STRICT CAREER PAGE JOB EXTRACTION - Only real job postings
    const careerPagePatterns = [
      // Job posting links with specific job titles
      /<a[^>]*href="[^"]*(?:\/job|\/position|\/career|\/apply)[^"]*"[^>]*>\s*([^<]*(?:Engineer|Developer|Manager|Director|Lead|Senior|Principal|Analyst|Specialist|Designer|Architect)[^<]*?)\s*<\/a>/gi,
      
      // Job cards with job-specific classes
      /<div[^>]*class="[^"]*(?:job-card|job-item|position-card|role-item)[^"]*"[^>]*>[\s\S]*?<[^>]*class="[^"]*(?:job-title|position-title|role-title)[^"]*"[^>]*>\s*([^<]{8,80})\s*<\/[^>]*>/gi,
      
      // Table rows with job data
      /<tr[^>]*>[\s\S]*?<td[^>]*>\s*([^<]*(?:Engineer|Developer|Manager|Director|Lead|Senior|Principal)[^<]*?)\s*<\/td>/gi,
      
      // Specific job title headers in career sections
      /<h[2-4][^>]*>\s*([^<]*(?:Software|Senior|Lead|Principal|Frontend|Backend|Full Stack|Data|Product|Engineering|Technical)[^<]*?(?:Engineer|Developer|Manager|Analyst|Designer|Architect)[^<]*?)\s*<\/h[2-4]>/gi
    ];
    
    console.log(`🔍 Extracting jobs from ${html.length} chars of HTML for ${company.name}`);
    
    for (const pattern of careerPagePatterns) {
      let match;
      let patternMatches = 0;
      
      while ((match = pattern.exec(html)) !== null) {
        patternMatches++;
        const rawTitle = match[1].trim();
        const cleanTitle = this.cleanJobTitle(rawTitle);
        
        console.log(`🎯 Found potential job: "${cleanTitle}"`);
        
        if (this.isValidJobTitle(cleanTitle)) {
          const location = this.extractLocationFromContext(html, match.index) || 'Remote/Hybrid';
          const jobType = this.extractJobTypeFromContext(html, match.index) || 'Full-time';
          
          const job = {
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
          };
          
          jobs.push(job);
          console.log(`✅ Added quality job: "${cleanTitle}"`);
        }
      }
      
      console.log(`📊 Pattern found ${patternMatches} matches`);
    }
    
    const uniqueJobs = this.deduplicateJobs(jobs);
    console.log(`🎯 Final result: ${uniqueJobs.length} unique quality jobs`);
    
    return uniqueJobs;
  }
  
  private cleanJobTitle(title: string): string {
    return title
      .replace(/[\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[^a-zA-Z]*/, '')
      .replace(/[^a-zA-Z\s]*$/, '')
      .replace(/\s*[-|•].*$/, '') // Remove everything after dash or bullet
      .replace(/\s*\(.*\)\s*/, ' ') // Remove parentheses content
      .trim();
  }
  
  private isValidJobTitle(title: string): boolean {
    if (!title || title.length < 8 || title.length > 100) return false;
    
    const lowerTitle = title.toLowerCase();
    
    // STRICT REJECTION - Block all garbage titles
    const strictRejects = [
      'working', 'job', 'position', 'role', 'career', 'opportunity', 'opening',
      'apply', 'click', 'here', 'more', 'view', 'see', 'all', 'jobs', 'reviews',
      'pros and cons', 'employment', 'hiring', 'careers', 'about', 'company',
      'overview', 'description', 'benefits', 'culture', 'team', 'join', 'work',
      'life', 'balance', 'salary', 'compensation', 'perks', 'office', 'location'
    ];
    
    // Reject if title contains any garbage terms
    if (strictRejects.some(reject => lowerTitle.includes(reject))) {
      return false;
    }
    
    // Must contain SPECIFIC professional job titles
    const validJobTitles = [
      'software engineer', 'senior engineer', 'lead engineer', 'principal engineer',
      'frontend developer', 'backend developer', 'full stack developer', 'web developer',
      'data scientist', 'data analyst', 'data engineer', 'machine learning engineer',
      'product manager', 'project manager', 'program manager', 'engineering manager',
      'technical lead', 'team lead', 'tech lead', 'architect', 'senior architect',
      'devops engineer', 'site reliability engineer', 'security engineer',
      'qa engineer', 'test engineer', 'automation engineer', 'mobile developer',
      'ios developer', 'android developer', 'ui/ux designer', 'product designer',
      'marketing manager', 'sales manager', 'account manager', 'business analyst',
      'financial analyst', 'operations manager', 'hr manager', 'recruiter',
      'director', 'senior director', 'vp', 'vice president', 'cto', 'ceo', 'cfo'
    ];
    
    // Must match at least one valid job title pattern
    return validJobTitles.some(validTitle => 
      lowerTitle.includes(validTitle) || 
      this.fuzzyMatch(lowerTitle, validTitle)
    );
  }
  
  private fuzzyMatch(title: string, pattern: string): boolean {
    const titleWords = title.split(' ');
    const patternWords = pattern.split(' ');
    
    // Check if most pattern words are in title
    const matches = patternWords.filter(word => 
      titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
    );
    
    return matches.length >= Math.ceil(patternWords.length * 0.7);
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
    // STRICT quality validation
    if (!job.jobTitle || job.jobTitle.length < 8) return false;
    
    const lowerTitle = job.jobTitle.toLowerCase();
    
    // Block ALL garbage patterns
    const garbagePatterns = [
      'working', 'click', 'reviews', 'pros and cons', 'employment',
      'jobs & careers', 'careers', 'about', 'company', 'overview',
      'description', 'benefits', 'culture', 'team', 'join us',
      'why work', 'life at', 'work at', 'hiring', 'recruitment'
    ];
    
    if (garbagePatterns.some(pattern => lowerTitle.includes(pattern))) {
      console.log(`❌ Rejected garbage title: "${job.jobTitle}"`);
      return false;
    }
    
    // Must be a real job title
    if (!this.isValidJobTitle(job.jobTitle)) {
      console.log(`❌ Rejected invalid job title: "${job.jobTitle}"`);
      return false;
    }
    
    console.log(`✅ Accepted quality job: "${job.jobTitle}"`);
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