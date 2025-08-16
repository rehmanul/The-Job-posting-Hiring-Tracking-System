import type { Company, InsertJobPosting } from '@shared/schema';
import { storage } from '../storage';
import puppeteer from 'puppeteer';

export class ProfessionalJobTracker {
  private customSearchKey: string;
  private customSearchEngineId: string;

  constructor() {
    this.customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.customSearchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';
  }

  async trackCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const logMessage = `🔍 Professional job tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'job_tracker', logMessage);

    const jobs: InsertJobPosting[] = [];

    try {
      // 1. Direct career page scraping
      if (company.careerPageUrl || company.website) {
        const careerJobs = await this.scrapeCareerPage(company);
        jobs.push(...careerJobs);
      }

      // 2. LinkedIn job search
      const linkedinJobs = await this.searchLinkedInJobs(company);
      jobs.push(...linkedinJobs);

      // 3. Google Jobs search
      const googleJobs = await this.searchGoogleJobs(company);
      jobs.push(...googleJobs);

      // 4. Indeed/job board search
      const jobBoardJobs = await this.searchJobBoards(company);
      jobs.push(...jobBoardJobs);

      const uniqueJobs = this.deduplicateJobs(jobs);
      
      const resultMessage = `✅ Found ${uniqueJobs.length} jobs for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'job_tracker', resultMessage);

      return uniqueJobs;

    } catch (error) {
      const errorMessage = `❌ Job tracking error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'job_tracker', errorMessage);
      return [];
    }
  }

  private async scrapeCareerPage(company: Company): Promise<InsertJobPosting[]> {
    const url = company.careerPageUrl || company.website;
    if (!url) return [];

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Extract job listings using common selectors
      const jobs = await page.evaluate((companyName) => {
        const jobElements = document.querySelectorAll([
          '.job-listing',
          '.job-item',
          '.position',
          '.career-item',
          '[data-job]',
          '.job-card',
          '.opening'
        ].join(','));

        const extractedJobs = [];

        jobElements.forEach(element => {
          const titleEl = element.querySelector('h1, h2, h3, h4, .title, .job-title, .position-title');
          const locationEl = element.querySelector('.location, .job-location, .city');
          const typeEl = element.querySelector('.type, .job-type, .employment-type');
          const linkEl = element.querySelector('a');

          if (titleEl && titleEl.textContent) {
            extractedJobs.push({
              jobTitle: titleEl.textContent.trim(),
              company: companyName,
              location: locationEl?.textContent?.trim() || 'Not specified',
              jobType: typeEl?.textContent?.trim() || 'Full-time',
              description: element.textContent?.substring(0, 500) || '',
              requirements: '',
              salary: null,
              postedDate: new Date(),
              applicationUrl: linkEl?.href || '',
              source: 'career_page',
              foundDate: new Date()
            });
          }
        });

        return extractedJobs;
      }, company.name);

      await browser.close();
      return jobs;

    } catch (error) {
      console.warn(`Career page scraping failed for ${company.name}:`, error);
      return [];
    }
  }

  private async searchLinkedInJobs(company: Company): Promise<InsertJobPosting[]> {
    if (!this.customSearchKey || !this.customSearchEngineId) return [];

    try {
      const query = `"${company.name}" jobs OR careers site:linkedin.com/jobs`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=10`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      const jobs: InsertJobPosting[] = [];

      if (data.items) {
        for (const item of data.items) {
          const job = this.extractLinkedInJob(item, company);
          if (job) jobs.push(job);
        }
      }

      return jobs;
    } catch (error) {
      console.warn(`LinkedIn job search failed for ${company.name}:`, error);
      return [];
    }
  }

  private async searchGoogleJobs(company: Company): Promise<InsertJobPosting[]> {
    if (!this.customSearchKey || !this.customSearchEngineId) return [];

    try {
      const query = `"${company.name}" jobs OR careers site:jobs.google.com`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=10`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      const jobs: InsertJobPosting[] = [];

      if (data.items) {
        for (const item of data.items) {
          const job = this.extractGoogleJob(item, company);
          if (job) jobs.push(job);
        }
      }

      return jobs;
    } catch (error) {
      console.warn(`Google Jobs search failed for ${company.name}:`, error);
      return [];
    }
  }

  private async searchJobBoards(company: Company): Promise<InsertJobPosting[]> {
    if (!this.customSearchKey || !this.customSearchEngineId) return [];

    try {
      const query = `"${company.name}" jobs OR careers site:indeed.com OR site:glassdoor.com OR site:monster.com`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=5`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      const jobs: InsertJobPosting[] = [];

      if (data.items) {
        for (const item of data.items) {
          const job = this.extractJobBoardJob(item, company);
          if (job) jobs.push(job);
        }
      }

      return jobs;
    } catch (error) {
      console.warn(`Job board search failed for ${company.name}:`, error);
      return [];
    }
  }

  private extractLinkedInJob(item: any, company: Company): InsertJobPosting | null {
    const title = item.title;
    const snippet = item.snippet;
    
    // Extract job title from LinkedIn format
    const jobTitleMatch = title.match(/^(.+?)\s*-\s*(.+?)\s*\|\s*LinkedIn/i);
    if (!jobTitleMatch) return null;

    const jobTitle = jobTitleMatch[1].trim();
    const location = this.extractLocation(snippet) || 'Remote';
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
      source: 'linkedin_search',
      foundDate: new Date()
    };
  }

  private extractGoogleJob(item: any, company: Company): InsertJobPosting | null {
    const title = item.title;
    const snippet = item.snippet;
    
    // Extract job title from Google Jobs format
    const jobTitleMatch = title.match(/^(.+?)\s*(?:-|at)\s*(.+?)(?:\s*\||$)/i);
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
      source: 'google_jobs',
      foundDate: new Date()
    };
  }

  private extractJobBoardJob(item: any, company: Company): InsertJobPosting | null {
    const title = item.title;
    const snippet = item.snippet;
    
    // Extract job title from job board format
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
      source: 'job_board_search',
      foundDate: new Date()
    };
  }

  private extractLocation(text: string): string | null {
    const locationPatterns = [
      /(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:,\s*[A-Z]{2})?)/,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*,\s*[A-Z]{2})/,
      /(Remote|Hybrid|On-site)/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return null;
  }

  private extractJobType(text: string): string | null {
    const typePatterns = [
      /(Full-time|Part-time|Contract|Temporary|Internship|Freelance)/i
    ];

    for (const pattern of typePatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private extractSalary(text: string): string | null {
    const salaryPatterns = [
      /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per\s+)?(?:year|annually|yr))?/i,
      /£[\d,]+(?:\s*-\s*£[\d,]+)?(?:\s*(?:per\s+)?(?:year|annually|yr))?/i,
      /€[\d,]+(?:\s*-\s*€[\d,]+)?(?:\s*(?:per\s+)?(?:year|annually|yr))?/i
    ];

    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }

    return null;
  }

  private deduplicateJobs(jobs: InsertJobPosting[]): InsertJobPosting[] {
    const seen = new Set<string>();
    return jobs.filter(job => {
      const key = `${job.jobTitle.toLowerCase()}-${job.company.toLowerCase()}-${job.location.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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