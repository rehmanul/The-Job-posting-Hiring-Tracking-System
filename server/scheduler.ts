import cron from 'node-cron';
import { JobTrackerService } from './services/jobTracker';
import { HealthMonitorService } from './services/healthMonitor';

export class SchedulerService {
  private jobTracker: JobTrackerService;
  private healthMonitor: HealthMonitorService;
  private isRunning = false;

  constructor() {
    this.jobTracker = new JobTrackerService();
    this.healthMonitor = new HealthMonitorService();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Scheduler Service...');
      
      await this.jobTracker.initialize();
      await this.healthMonitor.initialize();
      
      console.log('✅ Scheduler Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Scheduler Service:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    try {
      console.log('▶️ Starting scheduled tasks...');
      
      const jobInterval = parseInt(process.env.JOB_POSTING_CHECK_INTERVAL || '15');
      const hireInterval = parseInt(process.env.NEW_HIRE_CHECK_INTERVAL || '60');
      const analyticsInterval = parseInt(process.env.TRACKING_INTERVAL_MINUTES || '30');

      console.log(`📅 Scheduling tasks:`);
      console.log(`   - Job postings: every ${jobInterval} minutes`);
      console.log(`   - New hires: every ${hireInterval} minutes`);
      console.log(`   - Analytics: every ${analyticsInterval} minutes`);

      // Job postings tracking
      cron.schedule(`*/${jobInterval} * * * *`, async () => {
        if (!this.isRunning) return;
        
        console.log('🔍 Running scheduled job postings scan...');
        try {
          await this.jobTracker.trackJobPostings();
          await this.healthMonitor.recordHealthMetric('job_scan', 'healthy');
        } catch (error) {
          console.error('❌ Scheduled job scan failed:', error);
          await this.healthMonitor.recordHealthMetric(
            'job_scan', 
            'down', 
            undefined,
            (error as Error).message
          );
        }
      });

      // New hires tracking
      cron.schedule(`*/${hireInterval} * * * *`, async () => {
        if (!this.isRunning) return;
        
        console.log('👥 Running scheduled new hires scan...');
        try {
          await this.jobTracker.trackNewHires();
          await this.healthMonitor.recordHealthMetric('hire_scan', 'healthy');
        } catch (error) {
          console.error('❌ Scheduled hire scan failed:', error);
          await this.healthMonitor.recordHealthMetric(
            'hire_scan', 
            'down',
            undefined,
            (error as Error).message
          );
        }
      });

      // Analytics and health checks
      cron.schedule(`*/${analyticsInterval} * * * *`, async () => {
        if (!this.isRunning) return;
        
        console.log('📊 Running scheduled analytics and health checks...');
        try {
          await this.healthMonitor.updateAnalytics();
          await this.healthMonitor.performHealthChecks();
          await this.healthMonitor.recordHealthMetric('system', 'healthy');
        } catch (error) {
          console.error('❌ Scheduled analytics/health check failed:', error);
          await this.healthMonitor.recordHealthMetric(
            'system', 
            'degraded',
            undefined,
            (error as Error).message
          );
        }
      });

      // Daily summary (9 AM every day)
      cron.schedule('0 9 * * *', async () => {
        if (!this.isRunning) return;
        
        console.log('📈 Generating daily summary...');
        try {
          await this.jobTracker.generateDailySummary();
        } catch (error) {
          console.error('❌ Daily summary generation failed:', error);
        }
      });

      // Health checks every 5 minutes
      cron.schedule('*/5 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          await this.healthMonitor.performHealthChecks();
        } catch (error) {
          console.error('❌ Health check failed:', error);
        }
      });

      this.isRunning = true;
      await this.jobTracker.startTracking();
      
      console.log('✅ All scheduled tasks started');
      
    } catch (error) {
      console.error('❌ Failed to start scheduler:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Scheduler is not running');
      return;
    }

    try {
      console.log('⏸️ Stopping scheduled tasks...');
      
      this.isRunning = false;
      await this.jobTracker.stopTracking();
      
      console.log('✅ All scheduled tasks stopped');
      
    } catch (error) {
      console.error('❌ Error stopping scheduler:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.stop();
      await this.jobTracker.cleanup();
      
      console.log('🧹 Scheduler cleanup complete');
    } catch (error) {
      console.error('❌ Error during scheduler cleanup:', error);
    }
  }

  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}
