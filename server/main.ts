import { ProfessionalHireTracker } from './services/professionalHireTracker';
import { ProfessionalJobTracker } from './services/professionalJobTracker';
import { AnalyticsService } from './services/analyticsService';
import { HealthService } from './services/healthService';
import { SummaryService } from './services/summaryService';
import { FinalGoogleSheets } from './services/finalGoogleSheets';
import { NotificationService } from './services/notificationService';
import { logger } from './logger';

class Main {
  private hireTracker: ProfessionalHireTracker;
  private jobTracker: ProfessionalJobTracker;
  private analyticsService: AnalyticsService;
  private healthService: HealthService;
  private summaryService: SummaryService;
  private googleSheetsService: FinalGoogleSheets;
  private notificationService: NotificationService;

  constructor() {
    this.hireTracker = new ProfessionalHireTracker();
    this.jobTracker = new ProfessionalJobTracker();
    this.analyticsService = new AnalyticsService();
    this.healthService = new HealthService();
    this.summaryService = new SummaryService();
    this.googleSheetsService = new FinalGoogleSheets();
    this.notificationService = new NotificationService();
  }

  async run(): Promise<void> {
    try {
      logger.info('Starting the main process');

      await this.googleSheetsService.initialize();

      await this.hireTracker.trackHires();
      await this.jobTracker.trackJobs();

      await this.analyticsService.updateAnalytics();
      await this.healthService.updateHealthMetrics();
      await this.summaryService.generateSummary();

      await this.notificationService.sendSlackNotification('Hiring tracker process finished successfully.');
      await this.notificationService.sendEmailNotification('Hiring Tracker Summary', 'The hiring tracker process has finished successfully.');

      logger.info('Main process finished');
    } catch (error) {
      logger.error('Main process failed:', error);
    }
  }

  async runMaintenance(): Promise<void> {
    try {
      logger.info('Starting maintenance tasks');

      await this.googleSheetsService.cleanDuplicateData();
      await this.googleSheetsService.exportAnalytics();
      await this.healthService.systemHealthCheck();

      logger.info('Maintenance tasks finished');
    } catch (error) {
      logger.error('Maintenance tasks failed:', error);
    }
  }
}

const main = new Main();
main.run();
