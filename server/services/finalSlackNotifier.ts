import { logger } from '../logger';

export class FinalSlackNotifier {
  private webhookUrl: string;
  private channel: string;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    this.channel = process.env.SLACK_CHANNEL || '#job-alerts';
  }

  async sendHireNotification(hire: any): Promise<void> {
    try {
      const payload = {
        channel: this.channel,
        attachments: [{
          color: '#36a64f',
          title: '🎉 New Hire Detected!',
          fields: [
            { title: 'Person', value: hire.personName, short: true },
            { title: 'Company', value: hire.company, short: true },
            { title: 'Position', value: hire.position, short: true },
            { title: 'Previous Company', value: hire.previousCompany || 'N/A', short: true },
            { title: 'Confidence', value: `${(hire.confidenceScore * 100).toFixed(0)}%`, short: true },
            { title: 'Source', value: hire.source, short: true }
          ],
          actions: hire.linkedinProfile ? [{
            type: 'button',
            text: 'View LinkedIn Profile',
            url: hire.linkedinProfile
          }] : [],
          footer: 'Job Tracker Pro',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      await this.sendToSlack(payload);
      logger.info(`Hire notification sent: ${hire.personName}`);
    } catch (error) {
      logger.error('Hire notification failed:', error);
    }
  }

  async sendJobNotification(job: any): Promise<void> {
    try {
      const payload = {
        channel: this.channel,
        attachments: [{
          color: '#2196F3',
          title: '💼 New Job Posted!',
          fields: [
            { title: 'Company', value: job.company, short: true },
            { title: 'Position', value: job.jobTitle, short: true },
            { title: 'Location', value: job.location, short: true },
            { title: 'Department', value: job.department, short: true },
            { title: 'Confidence', value: `${(job.confidenceScore * 100).toFixed(0)}%`, short: true },
            { title: 'Posted', value: job.date, short: true }
          ],
          actions: [{
            type: 'button',
            text: 'View Job',
            url: job.jobUrl
          }],
          footer: 'Job Tracker Pro',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      await this.sendToSlack(payload);
      logger.info(`Job notification sent: ${job.jobTitle}`);
    } catch (error) {
      logger.error('Job notification failed:', error);
    }
  }

  async sendDailySummary(stats: any): Promise<void> {
    try {
      const payload = {
        channel: this.channel,
        attachments: [{
          color: '#FF9800',
          title: '📊 Daily Summary Report',
          fields: [
            { title: 'Companies Tracked', value: stats.totalCompanies.toString(), short: true },
            { title: 'Active Companies', value: stats.activeCompanies.toString(), short: true },
            { title: 'Jobs Found Today', value: stats.todayJobs.toString(), short: true },
            { title: 'Hires Found Today', value: stats.todayHires.toString(), short: true },
            { title: 'Total Jobs', value: stats.totalJobs.toString(), short: true },
            { title: 'Total Hires', value: stats.totalHires.toString(), short: true }
          ],
          footer: 'Job Tracker Pro - Daily Report',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      await this.sendToSlack(payload);
      logger.info('Daily summary sent to Slack');
    } catch (error) {
      logger.error('Daily summary failed:', error);
    }
  }

  private async sendToSlack(payload: any): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }
    } catch (error) {
      logger.error('Slack send failed:', error);
    }
  }
}