const dotenv = require('dotenv');
const winston = require('winston');
const cron = require('node-cron');
const { JobTracker } = require('./services/JobTracker');
const { HealthMonitor } = require('./services/HealthMonitor');
const { WebServer } = require('./services/WebServer');

// Load environment variables
dotenv.config();

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

class JobTrackerApplication {
  constructor() {
    this.jobTracker = new JobTracker();
    this.healthMonitor = new HealthMonitor();
    this.webServer = new WebServer();
    this.isRunning = false;
  }

  async initialize() {
    try {
      logger.info('🚀 Starting Job Tracker System...');

      // Initialize services
      await this.jobTracker.initialize();
      await this.healthMonitor.initialize();

      // Start web server for monitoring
      if (process.env.SERVER_PORT) {
        await this.webServer.start(process.env.SERVER_PORT);
        logger.info(`📊 Monitoring dashboard available at http://localhost:${process.env.SERVER_PORT}`);
      }

      // Setup cron jobs
      this.setupScheduledTasks();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.isRunning = true;
      logger.info('✅ Job Tracker System initialized successfully');

      // Send startup notification
      await this.jobTracker.sendSlackMessage('🚀 Job Tracker System started successfully!');

    } catch (error) {
      logger.error('❌ Failed to initialize Job Tracker System:', error);
      process.exit(1);
    }
  }

  setupScheduledTasks() {
    const jobInterval = process.env.JOB_POSTING_CHECK_INTERVAL || 15;
    const hireInterval = process.env.NEW_HIRE_CHECK_INTERVAL || 60;
    const trackingInterval = process.env.TRACKING_INTERVAL_MINUTES || 30;

    logger.info(`📅 Setting up scheduled tasks:`);
    logger.info(`   - Job postings check: every ${jobInterval} minutes`);
    logger.info(`   - New hires check: every ${hireInterval} minutes`);
    logger.info(`   - General tracking: every ${trackingInterval} minutes`);

    // Job postings tracking (every X minutes)
    cron.schedule(`*/${jobInterval} * * * *`, async () => {
      if (!this.isRunning) return;

      logger.info('🔍 Starting job postings scan...');
      try {
        await this.jobTracker.trackJobPostings();
        await this.healthMonitor.recordHealthMetric('job_scan', 'success');
      } catch (error) {
        logger.error('❌ Job postings scan failed:', error);
        await this.healthMonitor.recordHealthMetric('job_scan', 'error', error.message);
      }
    });

    // New hires tracking (every X minutes)
    cron.schedule(`*/${hireInterval} * * * *`, async () => {
      if (!this.isRunning) return;

      logger.info('👥 Starting new hires scan...');
      try {
        await this.jobTracker.trackNewHires();
        await this.healthMonitor.recordHealthMetric('hire_scan', 'success');
      } catch (error) {
        logger.error('❌ New hires scan failed:', error);
        await this.healthMonitor.recordHealthMetric('hire_scan', 'error', error.message);
      }
    });

    // Health check and analytics update (every X minutes)
    cron.schedule(`*/${trackingInterval} * * * *`, async () => {
      if (!this.isRunning) return;

      logger.info('📊 Updating analytics and health metrics...');
      try {
        await this.healthMonitor.updateAnalytics();
        await this.healthMonitor.recordHealthMetric('analytics_update', 'success');
      } catch (error) {
        logger.error('❌ Analytics update failed:', error);
        await this.healthMonitor.recordHealthMetric('analytics_update', 'error', error.message);
      }
    });

    // Daily summary report (every day at 9 AM)
    cron.schedule('0 9 * * *', async () => {
      if (!this.isRunning) return;

      logger.info('📈 Generating daily summary report...');
      try {
        await this.jobTracker.generateDailySummary();
      } catch (error) {
        logger.error('❌ Daily summary generation failed:', error);
      }
    });
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`🛑 Received ${signal}. Shutting down gracefully...`);
      this.isRunning = false;

      try {
        await this.jobTracker.sendSlackMessage('🛑 Job Tracker System shutting down...');
        await this.jobTracker.cleanup();
        await this.webServer.stop();
        logger.info('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }
}

// Start the application
const app = new JobTrackerApplication();
app.initialize().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = { JobTrackerApplication };
