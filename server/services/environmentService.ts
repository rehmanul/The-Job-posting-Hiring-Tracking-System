import fs from 'fs';
import path from 'path';

export class EnvironmentService {
  private envPath: string;

  constructor() {
    this.envPath = path.resolve(process.cwd(), '.env');
  }

  async getEnvironmentVariables(): Promise<Record<string, string>> {
    try {
      if (!fs.existsSync(this.envPath)) {
        return {};
      }

      const envContent = fs.readFileSync(this.envPath, 'utf-8');
      const envVars: Record<string, string> = {};

      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            envVars[key.trim()] = value;
          }
        }
      });

      return envVars;
    } catch (error) {
      console.error('Error reading environment variables:', error);
      return {};
    }
  }

  async updateEnvironmentVariable(key: string, value: string): Promise<boolean> {
    try {
      let envContent = '';
      
      if (fs.existsSync(this.envPath)) {
        envContent = fs.readFileSync(this.envPath, 'utf-8');
      }

      const lines = envContent.split('\n');
      let keyFound = false;

      // Update existing key or add new one
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith(`${key}=`)) {
          lines[i] = `${key}=${value}`;
          keyFound = true;
          break;
        }
      }

      if (!keyFound) {
        lines.push(`${key}=${value}`);
      }

      // Remove empty lines at the end and ensure single newline
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
      }

      fs.writeFileSync(this.envPath, lines.join('\n') + '\n', 'utf-8');
      
      // Update process.env immediately
      process.env[key] = value;
      
      return true;
    } catch (error) {
      console.error('Error updating environment variable:', error);
      return false;
    }
  }

  async updateMultipleEnvironmentVariables(variables: Record<string, string>): Promise<boolean> {
    try {
      let envContent = '';
      
      if (fs.existsSync(this.envPath)) {
        envContent = fs.readFileSync(this.envPath, 'utf-8');
      }

      const lines = envContent.split('\n');
      const updatedKeys = new Set<string>();

      // Update existing keys
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        for (const [key, value] of Object.entries(variables)) {
          if (line.startsWith(`${key}=`)) {
            lines[i] = `${key}=${value}`;
            updatedKeys.add(key);
            break;
          }
        }
      }

      // Add new keys
      for (const [key, value] of Object.entries(variables)) {
        if (!updatedKeys.has(key)) {
          lines.push(`${key}=${value}`);
        }
      }

      // Remove empty lines at the end and ensure single newline
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
      }

      fs.writeFileSync(this.envPath, lines.join('\n') + '\n', 'utf-8');
      
      // Update process.env immediately
      for (const [key, value] of Object.entries(variables)) {
        process.env[key] = value;
      }
      
      return true;
    } catch (error) {
      console.error('Error updating environment variables:', error);
      return false;
    }
  }

  getSettingsSchema(): Record<string, any> {
    return {
      // LinkedIn Configuration
      LINKEDIN_ACCESS_TOKEN: {
        label: 'LinkedIn Access Token',
        type: 'password',
        category: 'LinkedIn API',
        description: 'Your LinkedIn API access token'
      },
      LINKEDIN_CLIENT_ID: {
        label: 'LinkedIn Client ID',
        type: 'text',
        category: 'LinkedIn API',
        description: 'LinkedIn application client ID'
      },
      LINKEDIN_CLIENT_SECRET: {
        label: 'LinkedIn Client Secret',
        type: 'password',
        category: 'LinkedIn API',
        description: 'LinkedIn application client secret'
      },

      // Database Configuration
      DATABASE_URL: {
        label: 'Database URL',
        type: 'password',
        category: 'Database',
        description: 'PostgreSQL database connection URL'
      },

      // Google Sheets Integration
      GOOGLE_SHEETS_ID: {
        label: 'Google Sheets ID',
        type: 'text',
        category: 'Google Sheets',
        description: 'ID of your Google Sheets document'
      },
      GOOGLE_SERVICE_ACCOUNT_EMAIL: {
        label: 'Google Service Account Email',
        type: 'email',
        category: 'Google Sheets',
        description: 'Google service account email address'
      },
      GOOGLE_PRIVATE_KEY: {
        label: 'Google Private Key',
        type: 'textarea',
        category: 'Google Sheets',
        description: 'Google service account private key (JSON format)'
      },

      // Slack Integration
      SLACK_BOT_TOKEN: {
        label: 'Slack Bot Token',
        type: 'password',
        category: 'Slack',
        description: 'Slack bot token for notifications'
      },
      SLACK_CHANNEL: {
        label: 'Slack Channel',
        type: 'text',
        category: 'Slack',
        description: 'Slack channel for notifications (e.g., #job-alerts)',
        default: '#job-alerts'
      },

      // Email Configuration
      GMAIL_USER: {
        label: 'Gmail User',
        type: 'email',
        category: 'Email',
        description: 'Gmail address for sending notifications'
      },
      GMAIL_PASS: {
        label: 'Gmail App Password',
        type: 'password',
        category: 'Email',
        description: 'Gmail app-specific password'
      },
      EMAIL_RECIPIENTS: {
        label: 'Email Recipients',
        type: 'text',
        category: 'Email',
        description: 'Comma-separated list of email recipients'
      },

      // Tracking Configuration
      JOB_POSTING_CHECK_INTERVAL: {
        label: 'Job Check Interval (minutes)',
        type: 'number',
        category: 'Tracking',
        description: 'How often to check for new job postings',
        default: '60'
      },
      NEW_HIRE_CHECK_INTERVAL: {
        label: 'Hire Check Interval (minutes)',
        type: 'number',
        category: 'Tracking',
        description: 'How often to check for new hires',
        default: '15'
      },
      TRACKING_INTERVAL_MINUTES: {
        label: 'Analytics Interval (minutes)',
        type: 'number',
        category: 'Tracking',
        description: 'How often to update analytics',
        default: '15'
      },

      // System Configuration
      MAX_RETRIES: {
        label: 'Max Retries',
        type: 'number',
        category: 'System',
        description: 'Maximum number of retry attempts',
        default: '3'
      },
      REQUEST_TIMEOUT: {
        label: 'Request Timeout (ms)',
        type: 'number',
        category: 'System',
        description: 'Request timeout in milliseconds',
        default: '30000'
      },
      MAX_CONCURRENT_REQUESTS: {
        label: 'Max Concurrent Requests',
        type: 'number',
        category: 'System',
        description: 'Maximum concurrent API requests',
        default: '5'
      }
    };
  }
}