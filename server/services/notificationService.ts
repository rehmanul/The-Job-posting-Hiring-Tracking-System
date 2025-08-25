import { logger } from '../logger';
import axios from 'axios';

export class NotificationService {
  private slackWebhookUrl: string;
  private emailRecipients: string[];

  constructor() {
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    this.emailRecipients = (process.env.EMAIL_RECIPIENTS || '').split(',');
  }

  async sendSlackNotification(message: string): Promise<void> {
    if (!this.slackWebhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    try {
      await axios.post(this.slackWebhookUrl, { text: message });
      logger.info('Slack notification sent');
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }

  async sendEmailNotification(subject: string, body: string): Promise<void> {
    if (this.emailRecipients.length === 0) {
      logger.warn('Email recipients not configured');
      return;
    }

    // This is a placeholder for a real email sending service.
    // In a real application, you would use a library like Nodemailer to send emails.
    logger.info(`Sending email to ${this.emailRecipients.join(', ')}`);
    logger.info(`Subject: ${subject}`);
    logger.info(`Body: ${body}`);
  }
}
