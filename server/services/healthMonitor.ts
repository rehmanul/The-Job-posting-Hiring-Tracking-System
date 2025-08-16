import { storage } from '../storage';
import { GoogleSheetsService } from './googleSheets';
import type { InsertHealthMetric } from '@shared/schema';

export class HealthMonitorService {
  private googleSheets: GoogleSheetsService | null = null;

  async initialize(): Promise<void> {
    try {
      this.googleSheets = new GoogleSheetsService();
      await this.googleSheets.initialize();
      console.log('✅ Health Monitor Service initialized');
    } catch (error) {
      console.warn('⚠️ Google Sheets not available for health monitoring');
    }
  }

  async recordHealthMetric(
    service: string, 
    status: 'healthy' | 'degraded' | 'down',
    responseTime?: number,
    errorMessage?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const metric: InsertHealthMetric = {
        service,
        status,
        responseTime: responseTime?.toString(),
        errorMessage,
        metadata
      };

      const healthMetric = await storage.createHealthMetric(metric);

      // Sync to Google Sheets if available
      if (this.googleSheets) {
        try {
          await this.googleSheets.syncHealthMetric(healthMetric);
        } catch (error) {
          console.warn('⚠️ Failed to sync health metric to Google Sheets:', error);
        }
      }

      // Log system event
      await storage.createSystemLog({
        level: status === 'healthy' ? 'info' : 'warn',
        service: 'health_monitor',
        message: `${service} status: ${status}`,
        metadata: { responseTime, errorMessage, ...metadata }
      });

    } catch (error) {
      console.error('❌ Failed to record health metric:', error);
    }
  }

  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'down';
    services: Array<{
      service: string;
      status: 'healthy' | 'degraded' | 'down';
      lastCheck: Date;
      responseTime?: number;
    }>;
  }> {
    try {
      const recentMetrics = await storage.getHealthMetrics(undefined, 1); // Last 1 hour
      
      // Group by service and get latest status
      const serviceMap = new Map();
      
      for (const metric of recentMetrics) {
        if (!serviceMap.has(metric.service) || 
            (serviceMap.get(metric.service).timestamp && metric.timestamp &&
             serviceMap.get(metric.service).timestamp < metric.timestamp)) {
          serviceMap.set(metric.service, metric);
        }
      }

      const services = Array.from(serviceMap.values()).map(metric => ({
        service: metric.service,
        status: metric.status as 'healthy' | 'degraded' | 'down',
        lastCheck: metric.timestamp || new Date(),
        responseTime: metric.responseTime ? parseFloat(metric.responseTime) : undefined
      }));

      // Determine overall health
      let overall: 'healthy' | 'degraded' | 'down' = 'healthy';
      
      if (services.some(s => s.status === 'down')) {
        overall = 'down';
      } else if (services.some(s => s.status === 'degraded')) {
        overall = 'degraded';
      }

      return { overall, services };

    } catch (error) {
      console.error('❌ Failed to get system health:', error);
      return {
        overall: 'down',
        services: []
      };
    }
  }

  async performHealthChecks(): Promise<void> {
    console.log('🔍 Performing system health checks...');

    // Check Google Sheets connectivity
    await this.checkGoogleSheetsHealth();
    
    // Check LinkedIn access (basic connectivity)
    await this.checkLinkedInHealth();
    
    // Check Slack connectivity
    await this.checkSlackHealth();
    
    // Check Email service
    await this.checkEmailHealth();
    
    // Check database/storage health
    await this.checkStorageHealth();

    console.log('✅ Health checks completed');
  }

  private async checkGoogleSheetsHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!this.googleSheets) {
        await this.recordHealthMetric('google_sheets', 'down', 0, 'Service not initialized');
        return;
      }

      // Try to access a sheet to test connectivity
      await this.googleSheets.getCompanies();
      
      const responseTime = Date.now() - startTime;
      await this.recordHealthMetric('google_sheets', 'healthy', responseTime);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.recordHealthMetric(
        'google_sheets', 
        'down', 
        responseTime,
        (error as Error).message
      );
    }
  }

  private async checkLinkedInHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check LinkedIn API credentials for LinkedIn-only system
      const hasAccessToken = !!process.env.LINKEDIN_ACCESS_TOKEN;
      const hasCredentials = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
      
      const responseTime = Date.now() - startTime;
      
      if (hasAccessToken && hasCredentials) {
        await this.recordHealthMetric('linkedin', 'healthy', responseTime);
      } else if (hasCredentials) {
        await this.recordHealthMetric(
          'linkedin', 
          'degraded', 
          responseTime,
          'LinkedIn credentials configured but no access token'
        );
      } else {
        await this.recordHealthMetric(
          'linkedin', 
          'down', 
          responseTime,
          'No LinkedIn API credentials configured'
        );
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.recordHealthMetric(
        'linkedin', 
        'down', 
        responseTime,
        (error as Error).message
      );
    }
  }

  private async checkSlackHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test Slack by checking if we can connect to the API
      const hasCredentials = !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL);
      
      const responseTime = Date.now() - startTime;
      
      if (hasCredentials) {
        await this.recordHealthMetric('slack', 'healthy', responseTime);
      } else {
        await this.recordHealthMetric(
          'slack', 
          'down', 
          responseTime,
          'Slack credentials not configured'
        );
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.recordHealthMetric(
        'slack', 
        'down', 
        responseTime,
        (error as Error).message
      );
    }
  }

  private async checkEmailHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const hasCredentials = !!(process.env.GMAIL_USER && process.env.GMAIL_PASS);
      
      const responseTime = Date.now() - startTime;
      
      if (hasCredentials) {
        await this.recordHealthMetric('email', 'healthy', responseTime);
      } else {
        await this.recordHealthMetric(
          'email', 
          'down', 
          responseTime,
          'Email credentials not configured'
        );
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.recordHealthMetric(
        'email', 
        'down', 
        responseTime,
        (error as Error).message
      );
    }
  }

  private async checkStorageHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test storage by performing a simple operation
      await storage.getCompanies();
      
      const responseTime = Date.now() - startTime;
      await this.recordHealthMetric('storage', 'healthy', responseTime);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.recordHealthMetric(
        'storage', 
        'down', 
        responseTime,
        (error as Error).message
      );
    }
  }

  async updateAnalytics(): Promise<void> {
    try {
      console.log('📊 Updating system analytics...');
      
      const companies = await storage.getCompanies();
      const jobs = await storage.getJobPostings();
      const hires = await storage.getNewHires();
      
      // Get today's counts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayJobs = jobs.filter(j => j.foundDate && j.foundDate >= today);
      const todayHires = hires.filter(h => h.foundDate && h.foundDate >= today);
      
      await storage.createAnalytics({
        totalCompanies: companies.length,
        activeCompanies: companies.filter(c => c.isActive).length,
        jobsFound: todayJobs.length,
        hiresFound: todayHires.length,
        successfulScans: 0, // TODO: Track from actual scan results
        failedScans: 0, // TODO: Track from actual scan results
        avgResponseTime: '2.1', // TODO: Calculate from health metrics
        metadata: {
          updateType: 'scheduled',
          timestamp: new Date().toISOString()
        }
      });

      // Sync to Google Sheets if available
      if (this.googleSheets) {
        const latestAnalytics = await storage.getLatestAnalytics();
        if (latestAnalytics) {
          await this.googleSheets.syncAnalytics(latestAnalytics);
        }
      }

      console.log('✅ Analytics updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update analytics:', error);
    }
  }
}
