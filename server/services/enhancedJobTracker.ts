import { storage } from '../storage';
import type { Company, InsertJobPosting } from '@shared/schema';

export class EnhancedJobTracker {
  private startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Start from yesterday

  async trackNewJobs(): Promise<InsertJobPosting[]> {
    console.log(`🔍 Enhanced job tracking starting from ${this.startDate.toISOString()}`);
    
    const companies = await storage.getCompanies();
    const newJobs: InsertJobPosting[] = [];

    for (const company of companies.filter(c => c.isActive)) {
      try {
        // Track from both sources
        const careerPageJobs = await this.getCareerPageJobs(company);
        const linkedinJobs = await this.getLinkedInJobs(company);
        
        // Combine and deduplicate
        const allJobs = [...careerPageJobs, ...linkedinJobs];
        const uniqueJobs = this.deduplicateJobs(allJobs);
        
        // Filter only NEW jobs from today onwards
        const newJobsOnly = uniqueJobs.filter(job => this.isNewJob(job));
        
        newJobs.push(...newJobsOnly);
        
        console.log(`✅ Found ${newJobsOnly.length} new jobs for ${company.name}`);
        
      } catch (error) {
        console.error(`❌ Error tracking jobs for ${company.name}:`, error);
      }
    }

    return newJobs;
  }

  private async getCareerPageJobs(company: Company): Promise<InsertJobPosting[]> {
    const jobs: InsertJobPosting[] = [];
    
    if (!company.careerPageUrl) return jobs;
    
    try {
      // Scrape company career page
      const scrapedJobs = await this.scrapeCareerPage(company.careerPageUrl);
      
      jobs.push(...scrapedJobs.map(job => ({
        ...job,
        company: company.name,
        source: 'career_page',
        foundDate: new Date()
      })));
      
    } catch (error) {
      console.error(`Career page scraping error for ${company.name}:`, error);
    }
    
    return jobs;
  }

  private async getLinkedInJobs(company: Company): Promise<InsertJobPosting[]> {
    const jobs: InsertJobPosting[] = [];
    
    try {
      // Use LinkedIn job search API or scraping
      const linkedinJobs = await this.searchLinkedInJobs(company);
      
      jobs.push(...linkedinJobs.map(job => ({
        ...job,
        company: company.name,
        source: 'linkedin',
        foundDate: new Date()
      })));
      
    } catch (error) {
      console.error(`LinkedIn job search error for ${company.name}:`, error);
    }
    
    return jobs;
  }

  private isNewJob(job: InsertJobPosting): boolean {
    if (!job.foundDate) return false;
    return job.foundDate >= this.startDate;
  }

  private deduplicateJobs(jobs: InsertJobPosting[]): InsertJobPosting[] {
    const seen = new Set<string>();
    return jobs.filter(job => {
      const key = `${job.jobTitle}-${job.company}-${job.location}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Placeholder methods - implement actual scraping logic
  private async scrapeCareerPage(url: string): Promise<Partial<InsertJobPosting>[]> {
    // Implement career page scraping
    return [];
  }

  private async searchLinkedInJobs(company: Company): Promise<Partial<InsertJobPosting>[]> {
    // Implement LinkedIn job search
    return [];
  }
}