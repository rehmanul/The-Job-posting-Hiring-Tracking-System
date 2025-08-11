const nodemailer = require('nodemailer');
const winston = require('winston');
const moment = require('moment');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/email.log' })
  ]
});

class EmailService {
  constructor() {
    this.transporter = null;
    this.recipients = [];
    this.isInitialized = false;
  }

  async initialize() {
    try {
      logger.info('📧 Initializing Email service...');

      if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) is required');
      }

      if (!process.env.EMAIL_RECIPIENTS) {
        throw new Error('EMAIL_RECIPIENTS environment variable is required');
      }

      // Parse recipients
      this.recipients = process.env.EMAIL_RECIPIENTS.split(',').map(email => email.trim());

      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Test the connection
      await this.transporter.verify();
      logger.info(`📧 Connected to SMTP server: ${process.env.SMTP_HOST}`);
      logger.info(`📧 Email recipients: ${this.recipients.join(', ')}`);

      this.isInitialized = true;
      logger.info('✅ Email service initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Email service:', error);
      throw error;
    }
  }

  async sendJobAlert(jobResults) {
    try {
      if (!this.isInitialized) {
        logger.warn('⚠️ Email service not initialized, skipping email');
        return;
      }

      if (!jobResults.newJobs || jobResults.newJobs === 0) return;

      const subject = `🎯 Job Alert: ${jobResults.newJobs} New Job${jobResults.newJobs > 1 ? 's' : ''} Found`;
      const html = this.buildJobAlertHtml(jobResults);

      await this.sendEmail(subject, html);
      logger.info(`📧 Sent job alert email for ${jobResults.newJobs} new jobs`);

    } catch (error) {
      logger.error('❌ Failed to send job alert email:', error);
    }
  }

  async sendHireAlert(hireResults) {
    try {
      if (!this.isInitialized) {
        logger.warn('⚠️ Email service not initialized, skipping email');
        return;
      }

      if (!hireResults.newHires || hireResults.newHires === 0) return;

      const subject = `👥 New Hire Alert: ${hireResults.newHires} New Hire${hireResults.newHires > 1 ? 's' : ''} Detected`;
      const html = this.buildHireAlertHtml(hireResults);

      await this.sendEmail(subject, html);
      logger.info(`📧 Sent hire alert email for ${hireResults.newHires} new hires`);

    } catch (error) {
      logger.error('❌ Failed to send hire alert email:', error);
    }
  }

  async sendDailySummary(summary) {
    try {
      if (!this.isInitialized) return;

      const subject = `📊 Daily Summary - ${summary.date}`;
      const html = this.buildDailySummaryHtml(summary);

      await this.sendEmail(subject, html);
      logger.info('📧 Sent daily summary email');

    } catch (error) {
      logger.error('❌ Failed to send daily summary email:', error);
    }
  }

  async sendErrorAlert(error, context = '') {
    try {
      if (!this.isInitialized) return;

      const subject = '🚨 Job Tracker System Error Alert';
      const html = this.buildErrorAlertHtml(error, context);

      await this.sendEmail(subject, html);
      logger.info('📧 Sent error alert email');

    } catch (err) {
      logger.error('❌ Failed to send error alert email:', err);
    }
  }

  async sendEmail(subject, html, text = null) {
    try {
      const mailOptions = {
        from: `"Job Tracker System" <${process.env.GMAIL_USER}>`,
        to: this.recipients.join(', '),
        subject: subject,
        html: html,
        text: text || this.stripHtmlTags(html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`📧 Email sent successfully: ${result.messageId}`);
      return result;

    } catch (error) {
      logger.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  buildJobAlertHtml(jobResults) {
    const { newJobs, companies } = jobResults;
    const companiesWithJobs = companies.filter(c => c.newJobs > 0);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Job Alert</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 15px; margin-bottom: 20px; }
            .alert-box { background-color: #e8f4fd; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0; }
            .company-list { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .company-item { padding: 8px 0; border-bottom: 1px solid #dee2e6; }
            .company-item:last-child { border-bottom: none; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
            .timestamp { color: #6c757d; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 Job Alert - ${newJobs} New Job${newJobs > 1 ? 's' : ''} Found!</h1>
            </div>

            <div class="alert-box">
              <h2>Summary</h2>
              <p><strong>${newJobs}</strong> new job posting${newJobs > 1 ? 's' : ''} ${newJobs > 1 ? 'have' : 'has'} been detected across ${companiesWithJobs.length} compan${companiesWithJobs.length > 1 ? 'ies' : 'y'}.</p>
            </div>

            ${companiesWithJobs.length > 0 ? `
            <div class="company-list">
              <h3>Company Breakdown</h3>
              ${companiesWithJobs.map(company => `
                <div class="company-item">
                  <strong>${company.name}</strong>: ${company.newJobs} new job${company.newJobs > 1 ? 's' : ''}
                </div>
              `).join('')}
            </div>
            ` : ''}

            <div class="footer">
              <p class="timestamp">Scan completed: ${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
              <p>This is an automated message from the Job Tracker System.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  buildHireAlertHtml(hireResults) {
    const { newHires, companies } = hireResults;
    const companiesWithHires = companies.filter(c => c.newHires > 0);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Hire Alert</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 15px; margin-bottom: 20px; }
            .alert-box { background-color: #eafaf1; border-left: 4px solid #27ae60; padding: 15px; margin: 20px 0; }
            .company-list { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .company-item { padding: 8px 0; border-bottom: 1px solid #dee2e6; }
            .company-item:last-child { border-bottom: none; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
            .timestamp { color: #6c757d; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👥 New Hire Alert - ${newHires} New Hire${newHires > 1 ? 's' : ''} Detected!</h1>
            </div>

            <div class="alert-box">
              <h2>Summary</h2>
              <p><strong>${newHires}</strong> new hire${newHires > 1 ? 's' : ''} ${newHires > 1 ? 'have' : 'has'} been detected across ${companiesWithHires.length} compan${companiesWithHires.length > 1 ? 'ies' : 'y'}.</p>
            </div>

            ${companiesWithHires.length > 0 ? `
            <div class="company-list">
              <h3>Company Breakdown</h3>
              ${companiesWithHires.map(company => `
                <div class="company-item">
                  <strong>${company.name}</strong>: ${company.newHires} new hire${company.newHires > 1 ? 's' : ''}
                </div>
              `).join('')}
            </div>
            ` : ''}

            <div class="footer">
              <p class="timestamp">Scan completed: ${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
              <p>This is an automated message from the Job Tracker System.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  buildDailySummaryHtml(summary) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Daily Summary</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { color: #2c3e50; border-bottom: 2px solid #e74c3c; padding-bottom: 15px; margin-bottom: 20px; }
            .stats-box { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat-item { text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 8px; }
            .stat-number { font-size: 2em; font-weight: bold; color: #3498db; }
            .top-companies { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .company-item { padding: 5px 0; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Daily Summary - ${summary.date}</h1>
            </div>

            <div class="stats-box">
              <div class="stat-item">
                <div class="stat-number">${summary.totalJobs}</div>
                <div>Jobs Found</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">${summary.totalHires}</div>
                <div>New Hires</div>
              </div>
            </div>

            ${summary.topCompaniesJobs && summary.topCompaniesJobs.length > 0 ? `
            <div class="top-companies">
              <h3>Top Companies (Jobs)</h3>
              ${summary.topCompaniesJobs.map(({ company, count }) => `
                <div class="company-item">${company}: ${count}</div>
              `).join('')}
            </div>
            ` : ''}

            ${summary.topCompaniesHires && summary.topCompaniesHires.length > 0 ? `
            <div class="top-companies">
              <h3>Top Companies (Hires)</h3>
              ${summary.topCompaniesHires.map(({ company, count }) => `
                <div class="company-item">${company}: ${count}</div>
              `).join('')}
            </div>
            ` : ''}

            <div class="footer">
              <p>Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
              <p>This is an automated message from the Job Tracker System.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  buildErrorAlertHtml(error, context) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>System Error Alert</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { color: #c0392b; border-bottom: 2px solid #e74c3c; padding-bottom: 15px; margin-bottom: 20px; }
            .error-box { background-color: #fbeaea; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; }
            .error-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: monospace; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 System Error Alert</h1>
            </div>

            <div class="error-box">
              <h2>Error Details</h2>
              <p><strong>Context:</strong> ${context || 'Unknown'}</p>
              <p><strong>Time:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
            </div>

            <div class="error-details">
              <h3>Error Message</h3>
              <p>${error.message}</p>
              ${error.stack ? `<pre>${error.stack}</pre>` : ''}
            </div>

            <div class="footer">
              <p>Please investigate this error as soon as possible.</p>
              <p>This is an automated message from the Job Tracker System.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  stripHtmlTags(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  isInitialized() {
    return this.isInitialized;
  }
}

module.exports = { EmailService };
