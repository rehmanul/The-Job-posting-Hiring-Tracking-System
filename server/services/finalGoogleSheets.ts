import { GoogleAuth } from 'google-auth-library';
import { sheets_v4, google } from 'googleapis';
import { logger } from '../logger';
import { SHEETS } from '../config/sheets';
import type { Company, InsertNewHire, InsertJobPosting } from '@shared/schema';

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
      await this.initializeAllSheets();
    } catch (error) {
      logger.error('Google Sheets initialization failed:', error);
    }
  }

  async initializeAllSheets(): Promise<void> {
    logger.info("🏗️ Initializing all sheets...");
    try {
      await this.initializeNewHiresSheet();
      await this.initializeJobPostingsSheet();
      await this.initializeCompanyDataSheet();
      await this.initializeAnalyticsSheet();
      await this.initializeActivityLogSheet();
      await this.initializeHealthMetricsSheet();
      await this.initializeSummarySheet();
      logger.info("✅ All sheets initialized successfully");
    } catch (error) {
      logger.error('Sheet initialization failed:', error);
    }
  }

  private async getOrCreateSheet(sheetName: string): Promise<sheets_v4.Schema$Sheet> {
    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      const sheet = spreadsheet.data.sheets.find(
        (s) => s.properties.title === sheetName
      );
      if (sheet) {
        return sheet;
      }
      const newSheet = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
      logger.info(`📄 Created new sheet: ${sheetName}`);
      return newSheet.data.replies[0].addSheet;
    } catch (error) {
      logger.error(`Failed to get/create sheet ${sheetName}:`, error);
      throw new Error(`Failed to get/create sheet ${sheetName}: ${error.toString()}`);
    }
  }

  private async formatSheet(sheetId: number, columnCount: number): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.29,
                      green: 0.68,
                      blue: 0.31,
                    },
                    horizontalAlignment: "CENTER",
                    textFormat: {
                      foregroundColor: {
                        red: 1,
                        green: 1,
                        blue: 1,
                      },
                      fontSize: 10,
                      bold: true,
                    },
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      });
    } catch (error) {
      logger.error('Sheet formatting failed:', error);
    }
  }

  private async initializeNewHiresSheet(): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.NEW_HIRES);
    const headers = [
      'Person Name', 'Company', 'Position', 'Start Date', 'Previous Company',
      'LinkedIn Profile', 'Source', 'Confidence Score', 'Import Date', 'Status',
      'Notes', 'Verification Status'
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${SHEETS.NEW_HIRES}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    await this.formatSheet(sheet.properties.sheetId, headers.length);
  }

  private async initializeJobPostingsSheet(): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.JOB_POSTINGS);
    const headers = [
      'Job Title', 'Company', 'Location', 'Department', 'Job Type',
      'Experience Level', 'Posted Date', 'Application Deadline', 'Job URL',
      'Description', 'Requirements', 'Source', 'Import Date', 'Status'
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${SHEETS.JOB_POSTINGS}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    await this.formatSheet(sheet.properties.sheetId, headers.length);
  }

  private async initializeCompanyDataSheet(): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.COMPANY_DATA);
    const headers = [
      'Company Name', 'Website', 'Career Page', 'Industry',
      'Company Size', 'Priority', 'Track Hiring', 'Track Jobs'
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${SHEETS.COMPANY_DATA}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    await this.formatSheet(sheet.properties.sheetId, headers.length);
  }

  private async initializeAnalyticsSheet(): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.ANALYTICS);
    const headers = [
      'Metric', 'Value', 'Date', 'Company', 'Source', 'Details'
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${SHEETS.ANALYTICS}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    await this.formatSheet(sheet.properties.sheetId, headers.length);
  }

  private async initializeActivityLogSheet(): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.ACTIVITY_LOG);
    const headers = [
      'Timestamp', 'Action', 'Description', 'Count', 'Status', 'Duration', 'Details'
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${SHEETS.ACTIVITY_LOG}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    await this.formatSheet(sheet.properties.sheetId, headers.length);
  }

  private async initializeHealthMetricsSheet(): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.HEALTH_METRICS);
    const headers = [
      'Metric', 'Value', 'Status', 'Threshold', 'Last Updated', 'Details'
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${SHEETS.HEALTH_METRICS}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    await this.formatSheet(sheet.properties.sheetId, headers.length);
  }

  private async initializeSummarySheet(): Promise<void> {
    await this.getOrCreateSheet(SHEETS.SUMMARY);
  }

  async getSheetNames(): Promise<string[]> {
    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      return spreadsheet.data.sheets.map(s => s.properties.title);
    } catch (error) {
      logger.error('Failed to get sheet names:', error);
      return [];
    }
  }

  async getCompanyData(): Promise<Company[]> {
    try {
      const sheet = await this.getOrCreateSheet(SHEETS.COMPANY_DATA);
      if (sheet.properties.gridProperties.rowCount < 2) {
        return [];
      }
      const data = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${SHEETS.COMPANY_DATA}!A2:H`,
      });
      const rows = data.data.values;
      if (!rows) {
        return [];
      }
      return rows
        .filter(row => row[0] && row[0].toString().trim() !== '')
        .map(row => ({
          name: row[0] ? row[0].toString().trim() : '',
          website: row[1] ? row[1].toString().trim() : '',
          careerPage: row[2] ? row[2].toString().trim() : '',
          industry: row[3] ? row[3].toString().trim() : 'Unknown',
          size: row[4] ? row[4].toString().trim() : 'Unknown',
          priority: row[5] ? row[5].toString().trim() : 'Medium',
          trackHiring: row[6] !== false && row[6] !== 'FALSE' && row[6] !== 'No',
          trackJobs: row[7] !== false && row[7] !== 'FALSE' && row[7] !== 'No',
        }));
    } catch (error) {
      logger.error('Failed to load company data:', error);
      return [];
    }
  }

  async getHires(): Promise<InsertNewHire[]> {
    try {
      const sheet = await this.getOrCreateSheet(SHEETS.NEW_HIRES);
      if (sheet.properties.gridProperties.rowCount < 2) {
        return [];
      }
      const data = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${SHEETS.NEW_HIRES}!A2:L`,
      });
      const rows = data.data.values;
      if (!rows) {
        return [];
      }
      return rows.map(row => ({
        personName: row[0],
        company: row[1],
        position: row[2],
        startDate: new Date(row[3]),
        previousCompany: row[4],
        linkedinProfile: row[5],
        source: row[6],
        confidenceScore: row[7],
        importDate: new Date(row[8]),
        status: row[9],
        notes: row[10],
        verificationStatus: row[11],
      }));
    } catch (error) {
      logger.error('Failed to load hires:', error);
      return [];
    }
  }

  async getJobs(): Promise<InsertJobPosting[]> {
    try {
      const sheet = await this.getOrCreateSheet(SHEETS.JOB_POSTINGS);
      if (sheet.properties.gridProperties.rowCount < 2) {
        return [];
      }
      const data = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${SHEETS.JOB_POSTINGS}!A2:N`,
      });
      const rows = data.data.values;
      if (!rows) {
        return [];
      }
      return rows.map(row => ({
        jobTitle: row[0],
        company: row[1],
        location: row[2],
        department: row[3],
        jobType: row[4],
        experienceLevel: row[5],
        postedDate: new Date(row[6]),
        applicationDeadline: new Date(row[7]),
        jobUrl: row[8],
        description: row[9],
        requirements: row[10],
        source: row[11],
        importDate: new Date(row[12]),
        status: row[13],
      }));
    } catch (error) {
      logger.error('Failed to load jobs:', error);
      return [];
    }
  }

  async updateSummary(data: any): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: SHEETS.SUMMARY,
      });
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${SHEETS.SUMMARY}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: data
        }
      });
      logger.info('Summary updated in Google Sheets');
    } catch (error) {
      logger.error('Summary update failed:', error);
    }
  }

  async updateHealthMetrics(data: any): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: SHEETS.HEALTH_METRICS,
      });
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Health Metrics!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: data
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
        range: 'New Hires!A:L',
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
            data.status || 'Active',
            data.notes || '',
            data.verificationStatus || 'Pending'
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
        range: 'Job Postings!A:N',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            data.jobTitle,
            data.company,
            data.location,
            data.department,
            data.jobType,
            data.experienceLevel,
            data.postedDate,
            data.applicationDeadline,
            data.jobUrl,
            data.description,
            data.requirements,
            data.source,
            data.importDate,
            data.status
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
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: SHEETS.ANALYTICS,
      });
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Analytics!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: data
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
        range: 'Activity Log!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            data.timestamp,
            data.action,
            data.description,
            data.count,
            data.status,
            data.duration,
            data.details
          ]]
        }
      });
    } catch (error) {
      logger.error('Activity log update failed:', error);
    }
  }

  async checkJobExists(company: string, jobTitle: string, department: string): Promise<boolean> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Job Postings!A:N'
      });
      
      const rows = response.data.values || [];
      return rows.some(row => 
        row[1]?.toLowerCase().trim() === company.toLowerCase().trim() &&
        row[0]?.toLowerCase().trim() === jobTitle.toLowerCase().trim() &&
        row[3]?.toLowerCase().trim() === department.toLowerCase().trim()
      );
    } catch (error) {
      logger.error('Failed to check job exists:', error);
      return false;
    }
  }

  async checkHireExists(company: string, personName: string, position: string): Promise<boolean> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'New Hires!A:L'
      });
      
      const rows = response.data.values || [];
      return rows.some(row => 
        row[1]?.toLowerCase().trim() === company.toLowerCase().trim() &&
        row[0]?.toLowerCase().trim() === personName.toLowerCase().trim() &&
        row[2]?.toLowerCase().trim() === position.toLowerCase().trim()
      );
    } catch (error) {
      logger.error('Failed to check hire exists:', error);
      return false;
    }
  }

  async cleanDuplicateData(): Promise<void> {
    try {
      logger.info('Cleaning duplicate data');
      await this.removeDuplicateHires();
      await this.removeDuplicateJobs();
    } catch (error) {
      logger.error('Failed to clean duplicate data:', error);
    }
  }

  private async removeDuplicateHires(): Promise<void> {
    const hires = await this.getHires();
    const uniqueHires = [];
    const seen = new Set();
    for (const hire of hires) {
      const key = `${hire.personName.toLowerCase()}-${hire.company.toLowerCase()}`;
      if (!seen.has(key)) {
        uniqueHires.push(hire);
        seen.add(key);
      }
    }
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: SHEETS.NEW_HIRES,
    });
    await this.initializeNewHiresSheet();
    for (const hire of uniqueHires) {
      await this.updateNewHires(hire);
    }
  }

  private async removeDuplicateJobs(): Promise<void> {
    const jobs = await this.getJobs();
    const uniqueJobs = [];
    const seen = new Set();
    for (const job of jobs) {
      const key = `${job.jobTitle.toLowerCase()}-${job.company.toLowerCase()}`;
      if (!seen.has(key)) {
        uniqueJobs.push(job);
        seen.add(key);
      }
    }
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: SHEETS.JOB_POSTINGS,
    });
    await this.initializeJobPostingsSheet();
    for (const job of uniqueJobs) {
      await this.updateJobPostings(job);
    }
  }

  async exportAnalytics(): Promise<void> {
    try {
      logger.info('Exporting analytics');
      const analyticsSheet = await this.getOrCreateSheet(SHEETS.ANALYTICS);
      const healthSheet = await this.getOrCreateSheet(SHEETS.HEALTH_METRICS);
      const summarySheet = await this.getOrCreateSheet(SHEETS.SUMMARY);

      const analyticsData = (await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: SHEETS.ANALYTICS })).data.values;
      const healthData = (await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: SHEETS.HEALTH_METRICS })).data.values;
      const summaryData = (await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: SHEETS.SUMMARY })).data.values;

      const exportSheet = await this.getOrCreateSheet('Analytics Export');
      await this.sheets.spreadsheets.values.clear({ spreadsheetId: this.spreadsheetId, range: 'Analytics Export' });

      let currentRow = 1;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'Analytics Export'!A${currentRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['=== SUMMARY REPORT ===']] }
      });
      currentRow += 2;

      if (summaryData.length > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'Analytics Export'!A${currentRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: summaryData }
        });
        currentRow += summaryData.length + 3;
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'Analytics Export'!A${currentRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['=== DETAILED ANALYTICS ===']] }
      });
      currentRow += 2;

      if (analyticsData.length > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'Analytics Export'!A${currentRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: analyticsData }
        });
        currentRow += analyticsData.length + 3;
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'Analytics Export'!A${currentRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['=== HEALTH METRICS ===']] }
      });
      currentRow += 2;

      if (healthData.length > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'Analytics Export'!A${currentRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: healthData }
        });
      }

    } catch (error) {
      logger.error('Failed to export analytics:', error);
    }
  }
}