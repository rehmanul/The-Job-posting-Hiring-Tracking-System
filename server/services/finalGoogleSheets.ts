import { GoogleAuth } from 'google-auth-library';
import { sheets_v4, google } from 'googleapis';
import { logger } from '../logger';

export class FinalGoogleSheets {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
  }

  async initialize(): Promise<void> {
    try {
      const auth = new GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      logger.info('Google Sheets initialized');
    } catch (error) {
      logger.error('Google Sheets initialization failed:', error);
    }
  }

  async updateSummary(data: any): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Summary!A:K',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            data.reportType,
            data.reportDate,
            data.period,
            data.totalJobs,
            data.totalHires,
            data.activeCompanies,
            data.growthRate,
            data.topCompany,
            data.topCompanyJobs,
            data.remoteJobs,
            data.mostActiveDay
          ]]
        }
      });
      logger.info('Summary updated in Google Sheets');
    } catch (error) {
      logger.error('Summary update failed:', error);
    }
  }

  async updateHealthMetrics(data: any): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Health Metrics!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            data.timestamp,
            data.service,
            data.status,
            data.responseTime,
            data.errorMessage || '',
            data.cpuUsage || '0%',
            data.memoryUsage || '0%',
            data.details || ''
          ]]
        }
      });
    } catch (error) {
      logger.error('Health metrics update failed:', error);
    }
  }

  async updateNewHires(data: any): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'New Hires!A:J',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            data.personName,
            data.company,
            data.position,
            data.startDate,
            data.previousCompany || '',
            data.linkedinProfile || '',
            data.source,
            data.confidenceScore,
            data.foundDate,
            data.verified || 'No'
          ]]
        }
      });
      logger.info(`New hire added to sheets: ${data.personName}`);
    } catch (error) {
      logger.error('New hire update failed:', error);
    }
  }

  async updateJobPostings(data: any): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Job Postings!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            data.company,
            data.jobTitle,
            data.location,
            data.department,
            data.date,
            data.time,
            data.jobUrl,
            data.confidenceScore
          ]]
        }
      });
      logger.info(`New job added to sheets: ${data.jobTitle}`);
    } catch (error) {
      logger.error('Job posting update failed:', error);
    }
  }

  async updateAnalytics(data: any): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Analytics!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            data.date,
            data.totalCompanies,
            data.activeCompanies,
            data.jobsFound,
            data.hiresFound,
            data.successfulScans,
            data.failedScans,
            data.avgResponseTime
          ]]
        }
      });
    } catch (error) {
      logger.error('Analytics update failed:', error);
    }
  }

  async updateActivityLog(data: any): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Activity Log!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            data.timestamp,
            data.type,
            data.action,
            data.details,
            data.status,
            data.user || 'System'
          ]]
        }
      });
    } catch (error) {
      logger.error('Activity log update failed:', error);
    }
  }
}