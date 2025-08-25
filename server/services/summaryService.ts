import { FinalGoogleSheets } from './finalGoogleSheets';
import { logger } from '../logger';

export class SummaryService {
  private googleSheetsService: FinalGoogleSheets;

  constructor() {
    this.googleSheetsService = new FinalGoogleSheets();
  }

  async generateSummary(): Promise<void> {
    try {
      const companies = await this.googleSheetsService.getCompanyData();
      const hires = await this.googleSheetsService.getHires();
      const jobs = await this.googleSheetsService.getJobs();

      const totalHires = hires.length;
      const totalJobs = jobs.length;
      const totalCompanies = companies.length;

      const summary = [
        ['HIRING TRACKER SUMMARY REPORT'],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ['OVERALL STATISTICS'],
        ['Total Companies Tracked', totalCompanies],
        ['Total Hires Found', totalHires],
        ['Total Job Postings', totalJobs],
        ['Last Update', new Date().toLocaleString()],
        [],
        ['COMPANY BREAKDOWN'],
        ['Company', 'Hires', 'Jobs', 'Priority', 'Status'],
      ];

      for (const company of companies) {
        const companyHires = hires.filter(h => h.company === company.name).length;
        const companyJobs = jobs.filter(j => j.company === company.name).length;
        summary.push([
          company.name,
          companyHires,
          companyJobs,
          company.priority,
          'Active'
        ]);
      }

      await this.googleSheetsService.updateSummary(summary);
      logger.info('Summary generated');
    } catch (error) {
      logger.error('Failed to generate summary:', error);
    }
  }
}
