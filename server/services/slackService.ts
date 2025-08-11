import { WebClient, type ChatPostMessageArguments } from '@slack/web-api';
import type { JobPosting, NewHire } from '@shared/schema';

export class SlackService {
  private client: WebClient;
  private channelId: string;

  constructor() {
    const token = process.env.SLACK_BOT_TOKEN;
    const channelId = process.env.SLACK_CHANNEL_ID;

    if (!token) {
      throw new Error('SLACK_BOT_TOKEN environment variable must be set');
    }

    if (!channelId) {
      throw new Error('SLACK_CHANNEL_ID environment variable must be set');
    }

    this.client = new WebClient(token);
    this.channelId = channelId;
  }

  async sendJobAlert(job: JobPosting): Promise<void> {
    try {
      const message: ChatPostMessageArguments = {
        channel: this.channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🆕 *New Job Alert!*`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Company:*\n${job.company}`
              },
              {
                type: 'mrkdwn',
                text: `*Position:*\n${job.jobTitle}`
              },
              {
                type: 'mrkdwn',
                text: `*Location:*\n${job.location || 'Not specified'}`
              },
              {
                type: 'mrkdwn',
                text: `*Department:*\n${job.department || 'Not specified'}`
              }
            ]
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Posted Date:*\n${job.postedDate ? job.postedDate.toDateString() : 'Unknown'}`
              },
              {
                type: 'mrkdwn',
                text: `*Confidence:*\n${job.confidenceScore}%`
              },
              {
                type: 'mrkdwn',
                text: `*Source:*\n${job.source}`
              }
            ]
          }
        ]
      };

      if (job.url) {
        message.blocks?.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Job Posting',
                emoji: true
              },
              style: 'primary',
              url: job.url
            }
          ]
        });
      }

      await this.client.chat.postMessage(message);
      console.log('✅ Job alert sent to Slack');
      
    } catch (error) {
      console.error('❌ Failed to send job alert to Slack:', error);
      throw error;
    }
  }

  async sendHireAlert(hire: NewHire): Promise<void> {
    try {
      const message: ChatPostMessageArguments = {
        channel: this.channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `👋 *New Hire Detected!*`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Person:*\n${hire.personName}`
              },
              {
                type: 'mrkdwn',
                text: `*Company:*\n${hire.company}`
              },
              {
                type: 'mrkdwn',
                text: `*Position:*\n${hire.position}`
              },
              {
                type: 'mrkdwn',
                text: `*Start Date:*\n${hire.startDate ? hire.startDate.toDateString() : 'Unknown'}`
              }
            ]
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Source:*\n${hire.source}`
              },
              {
                type: 'mrkdwn',
                text: `*Confidence:*\n${hire.confidenceScore}%`
              }
            ]
          }
        ]
      };

      if (hire.linkedinProfile) {
        message.blocks?.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View LinkedIn Profile',
                emoji: true
              },
              style: 'primary',
              url: hire.linkedinProfile
            }
          ]
        });
      }

      await this.client.chat.postMessage(message);
      console.log('✅ Hire alert sent to Slack');
      
    } catch (error) {
      console.error('❌ Failed to send hire alert to Slack:', error);
      throw error;
    }
  }

  async sendSystemMessage(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<void> {
    try {
      const iconMap = {
        info: '🔵',
        success: '✅',
        warning: '⚠️',
        error: '❌'
      };

      await this.client.chat.postMessage({
        channel: this.channelId,
        text: `${iconMap[type]} ${message}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${iconMap[type]} *Job Tracker System*\n${message}`
            }
          }
        ]
      });

      console.log('✅ System message sent to Slack');
      
    } catch (error) {
      console.error('❌ Failed to send system message to Slack:', error);
    }
  }

  async sendDailySummary(
    jobsFound: number, 
    hiresFound: number, 
    companiesScanned: number, 
    successRate: number
  ): Promise<void> {
    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📊 Daily Job Tracker Summary',
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Jobs Found:*\n${jobsFound}`
              },
              {
                type: 'mrkdwn',
                text: `*New Hires:*\n${hiresFound}`
              },
              {
                type: 'mrkdwn',
                text: `*Companies Scanned:*\n${companiesScanned}`
              },
              {
                type: 'mrkdwn',
                text: `*Success Rate:*\n${successRate.toFixed(1)}%`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Generated on ${new Date().toLocaleDateString()}`
              }
            ]
          }
        ]
      });

      console.log('✅ Daily summary sent to Slack');
      
    } catch (error) {
      console.error('❌ Failed to send daily summary to Slack:', error);
    }
  }
}
