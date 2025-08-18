import puppeteer from 'puppeteer';
import { storage } from '../storage';
import { logger } from '../logger';
import type { Company } from '@shared/schema';

export class PythonJobScraper {
  async scrapeCompanyJobs(company: Company): Promise<void> {
    if (!company.careerPageUrl) {
      logger.warn(`No career page URL for ${company.name}`);
      return;
    }

    let browser;
    try {
      logger.info(`Scraping jobs from ${company.name}: ${company.careerPageUrl}`);

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-images']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      await page.goto(company.careerPageUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Scroll to load more content
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract job links using Python script logic
      const jobs = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const jobLinks: any[] = [];
        
        // Job keywords from Python script
        const jobKeywords = [
          'engineer', 'developer', 'manager', 'analyst', 'specialist',
          'coordinator', 'director', 'lead', 'senior', 'junior',
          'architect', 'consultant', 'designer', 'scientist'
        ];
        
        const skipKeywords = [
          'apply', 'view all', 'home', 'about', 'contact', 'privacy',
          'terms', 'cookie', 'back to', 'return to'
        ];

        links.forEach(link => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          if (text.length >= 10 && text.length <= 200 &&
              jobKeywords.some(kw => text.toLowerCase().includes(kw)) &&
              !skipKeywords.some(skip => text.toLowerCase().includes(skip))) {
            
            jobLinks.push({
              title: text,
              url: href.startsWith('http') ? href : window.location.origin + href,
              location: 'Remote',
              department: this.extractDepartment(text)
            });
          }
        });
        
        // Also check other elements for job titles
        const elements = document.querySelectorAll('h1, h2, h3, h4, div, span');
        elements.forEach(elem => {
          const text = elem.textContent?.trim() || '';
          
          if (text.length >= 10 && text.length <= 100 &&
              jobKeywords.some(kw => text.toLowerCase().includes(kw)) &&
              !skipKeywords.some(skip => text.toLowerCase().includes(skip)) &&
              jobLinks.length < 50) {
            
            const parentLink = elem.closest('a');
            const href = parentLink?.href || window.location.href;
            
            jobLinks.push({
              title: text,
              url: href,
              location: 'Remote',
              department: this.extractDepartment(text)
            });
          }
        });
        
        // Remove duplicates
        const seen = new Set();
        return jobLinks.filter(job => {
          const key = job.title.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 50);
      });

      logger.info(`Found ${jobs.length} jobs for ${company.name}`);

      // Save jobs with Python script validation
      for (const jobData of jobs) {
        if (this.validateJobData(jobData)) {
          await this.saveJobIfNew({
            jobTitle: jobData.title,
            company: company.name,
            location: jobData.location,
            jobUrl: jobData.url,
            source: 'Career Page Scraping',
            foundDate: new Date(),
            extractedAt: new Date().toISOString().split('T')[0]
          });
        }
      }

    } catch (error) {
      logger.error(`Job scraping failed for ${company.name}:`, error);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private validateJobData(job: any): boolean {
    if (!job.title || job.title.length < 5) return false;
    
    const titleLower = job.title.toLowerCase();
    
    // Must contain job-related keywords (from Python script)
    const jobKeywords = [
      'engineer', 'developer', 'manager', 'analyst', 'specialist', 'coordinator',
      'director', 'lead', 'senior', 'junior', 'intern', 'associate', 'assistant',
      'consultant', 'architect', 'designer', 'scientist', 'researcher', 'officer',
      'representative', 'executive', 'supervisor', 'technician', 'administrator'
    ];
    
    if (!jobKeywords.some(keyword => titleLower.includes(keyword))) {
      return false;
    }
    
    // Filter out non-job content (from Python script)
    const nonJobKeywords = [
      'cookie', 'privacy', 'terms', 'about', 'contact', 'home', 'news', 'blog',
      'apply now', 'view all', 'see more', 'load more', 'show more', 'read more',
      'back to', 'return to', 'go to', 'click here', 'learn more', 'find out',
      'subscribe', 'follow us', 'social media', 'linkedin', 'twitter', 'facebook'
    ];
    
    if (nonJobKeywords.some(keyword => titleLower.includes(keyword))) {
      return false;
    }
    
    // Check reasonable title length
    if (job.title.length > 200 || job.title.split('\n').length > 2) {
      return false;
    }
    
    return true;
  }

  private extractDepartment(title: string): string {
    const titleLower = title.toLowerCase();
    
    const departments = {
      'Engineering': ['engineer', 'developer', 'software', 'technical', 'devops', 'qa'],
      'Sales': ['sales', 'account', 'business development', 'revenue'],
      'Marketing': ['marketing', 'brand', 'content', 'social media', 'growth'],
      'Product': ['product', 'pm', 'product manager'],
      'Design': ['designer', 'ux', 'ui', 'creative', 'visual'],
      'HR': ['hr', 'human resources', 'people', 'recruiting', 'talent'],
      'Finance': ['finance', 'accounting', 'controller', 'financial'],
      'Operations': ['operations', 'ops', 'logistics', 'supply chain'],
      'Data': ['data', 'analytics', 'scientist', 'analyst'],
      'Customer Success': ['customer', 'support', 'success', 'service']
    };
    
    for (const [dept, keywords] of Object.entries(departments)) {
      if (keywords.some(keyword => titleLower.includes(keyword))) {
        return dept;
      }
    }
    
    return 'General';
  }

  private async saveJobIfNew(jobData: any): Promise<void> {
    try {
      // Check if job already exists
      const existingJobs = await storage.getJobPostings();
      const exists = existingJobs.some(j => 
        j.jobTitle.toLowerCase() === jobData.jobTitle.toLowerCase() &&
        j.company.toLowerCase() === jobData.company.toLowerCase()
      );

      if (exists) {
        return;
      }

      // Save new job
      await storage.createJobPosting(jobData);
      logger.info(`New job saved: ${jobData.jobTitle} at ${jobData.company}`);

    } catch (error) {
      logger.error('Failed to save job:', error);
    }
  }
}