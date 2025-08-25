import { FinalGoogleSheets } from './finalGoogleSheets';
import { logger } from '../logger';
import type { InsertNewHire, InsertJobPosting } from '@shared/schema';

export class AnalyticsService {
  private googleSheetsService: FinalGoogleSheets;

  constructor() {
    this.googleSheetsService = new FinalGoogleSheets();
  }

  private getThisMonthCount(items: (InsertNewHire | InsertJobPosting)[]): number {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    
    return items.filter(item => {
      const date = new Date(item.importDate);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;
  }

  async updateAnalytics(): Promise<void> {
    try {
      const companies = await this.googleSheetsService.getCompanyData();
      const hires = await this.googleSheetsService.getHires();
      const jobs = await this.googleSheetsService.getJobs();

      const analytics = [];

      for (const company of companies) {
        const companyHires = hires.filter(h => h.company === company.name);
        const companyJobs = jobs.filter(j => j.company === company.name);

        analytics.push(
          ['Total Hires', companyHires.length, new Date(), company.name, 'System', ''],
          ['Total Jobs', companyJobs.length, new Date(), company.name, 'System', ''],
          ['Hires This Month', this.getThisMonthCount(companyHires), new Date(), company.name, 'System', ''],
          ['Jobs This Month', this.getThisMonthCount(companyJobs), new Date(), company.name, 'System', '']
        );
      }

      const totalHires = hires.length;
      const totalJobs = jobs.length;

      analytics.push(
        ['System Total Hires', totalHires, new Date(), 'All Companies', 'System', ''],
        ['System Total Jobs', totalJobs, new Date(), 'All Companies', 'System', '']
      );

      await this.googleSheetsService.updateAnalytics(analytics);
      logger.info('Analytics updated');
    } catch (error) {
      logger.error('Failed to update analytics:', error);
    }
  }
}