import puppeteer from 'puppeteer';
import { logger } from '../logger';
import type { Company, InsertJobPosting } from '@shared/schema';
import { FinalGoogleSheets } from './finalGoogleSheets';

export class JobScraperService {
  private googleSheetsService: FinalGoogleSheets;

  constructor() {
    this.googleSheetsService = new FinalGoogleSheets();
  }

  async scrapeCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    if (!company.careerPage) {
      logger.warn(`No career page URL for ${company.name}`);
      return [];
    }

    let browser;
    try {
      logger.info(`Scraping jobs from ${company.name}: ${company.careerPage}`);

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ]
      });

      const page = await browser.newPage();
      await page.goto(company.careerPage, { waitUntil: 'networkidle2' });

      const jobs = await page.evaluate(() => {
        const jobLinks: any[] = [];
        const jobKeywords = [
          'engineer', 'developer', 'manager', 'analyst', 'specialist',
          'coordinator', 'director', 'lead', 'senior', 'junior',
          'architect', 'consultant', 'designer', 'scientist'
        ];
        const skipKeywords = [
          'apply', 'view all', 'home', 'about', 'contact', 'privacy',
          'terms', 'cookie', 'back to', 'return to'
        ];

        document.querySelectorAll('a').forEach(link => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          if (text.length >= 10 && text.length <= 200 &&
              jobKeywords.some(kw => text.toLowerCase().includes(kw)) &&
              !skipKeywords.some(skip => text.toLowerCase().includes(skip))) {
            
            jobLinks.push({
              title: text.trim().replace(/\s+/g, ' '),
              url: href.startsWith('http') ? href : window.location.origin + href,
              location: 'Remote',
              department: 'General'
            });
          }
        });
        return jobLinks;
      });

      logger.info(`Found ${jobs.length} jobs for ${company.name}`);
      return jobs.map(job => ({
        jobTitle: job.title,
        company: company.name,
        location: job.location,
        department: job.department,
        jobUrl: job.url,
        source: 'Career Page Scraping',
        importDate: new Date(),
      }));

    } catch (error) {
      logger.error(`Job scraping failed for ${company.name}:`, error);
      return [];
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
