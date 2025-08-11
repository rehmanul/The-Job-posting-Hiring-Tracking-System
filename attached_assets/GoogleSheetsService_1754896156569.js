const { google } = require('googleapis');
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
    new winston.transports.File({ filename: 'logs/sheets.log' })
  ]
});

class GoogleSheetsService {
  constructor() {
    this.sheetsApi = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    this.auth = null;
    this.isInitialized = false;

    // Sheet names
    this.sheets = {
      companies: 'Company Data',
      jobPostings: 'Job Postings',
      newHires: 'New Hires', 
      analytics: 'Analytics',
      healthMetrics: 'Health Metrics'
    };

    // Headers for each sheet
    this.headers = {
      companies: ['Company Name', 'Website', 'LinkedIn URL', 'LinkedIn Career Page URL'],
      jobPostings: ['Company', 'Job Title', 'Location', 'Department', 'Posted Date', 'Found Date', 'URL', 'Confidence Score'],
      newHires: ['Person Name', 'Company', 'Position', 'Start Date', 'LinkedIn Profile', 'Source', 'Confidence Score'],
      analytics: ['Timestamp', 'Scan Type', 'Processed', 'New Items', 'Errors', 'Duration (ms)', 'Success Rate'],
      healthMetrics: ['Timestamp', 'Metric Type', 'Status', 'Message', 'Response Time (ms)', 'System Load']
    };
  }

  async initialize() {
    try {
      logger.info('🔧 Initializing Google Sheets service...');

      // Setup authentication
      const credentials = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n')
      };

      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheetsApi = google.sheets({ version: 'v4', auth: this.auth });

      // Test connection and setup sheets
      await this.testConnection();
      await this.setupSheets();

      this.isInitialized = true;
      logger.info('✅ Google Sheets service initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Google Sheets service:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      logger.info(`📊 Connected to spreadsheet: "${response.data.properties.title}"`);
    } catch (error) {
      logger.error('❌ Failed to connect to Google Sheets:', error);
      throw new Error(`Google Sheets connection failed: ${error.message}`);
    }
  }

  async setupSheets() {
    try {
      logger.info('🔧 Setting up required sheets...');

      // Get existing sheets
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const existingSheets = response.data.sheets.map(sheet => sheet.properties.title);

      // Create missing sheets
      for (const [key, sheetName] of Object.entries(this.sheets)) {
        if (!existingSheets.includes(sheetName)) {
          await this.createSheet(sheetName, this.headers[key]);
          logger.info(`✅ Created sheet: ${sheetName}`);
        } else {
          // Ensure headers are correct
          await this.ensureHeaders(sheetName, this.headers[key]);
        }
      }

      logger.info('✅ All sheets are ready');

    } catch (error) {
      logger.error('❌ Failed to setup sheets:', error);
      throw error;
    }
  }

  async createSheet(sheetName, headers) {
    try {
      // Add the sheet
      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });

      // Add headers
      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      });

    } catch (error) {
      logger.error(`❌ Failed to create sheet ${sheetName}:`, error);
      throw error;
    }
  }

  async ensureHeaders(sheetName, expectedHeaders) {
    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!1:1`
      });

      const existingHeaders = response.data.values ? response.data.values[0] : [];

      // If headers don't match, update them
      if (JSON.stringify(existingHeaders) !== JSON.stringify(expectedHeaders)) {
        await this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'RAW',
          resource: {
            values: [expectedHeaders]
          }
        });
        logger.info(`✅ Updated headers for ${sheetName}`);
      }

    } catch (error) {
      logger.error(`❌ Failed to ensure headers for ${sheetName}:`, error);
    }
  }

  async getCompanyData() {
    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheets.companies}!A2:D1000`
      });

      const rows = response.data.values || [];
      const companies = rows
        .filter(row => row.length >= 2 && row[0]) // Must have at least company name and website
        .map(row => ({
          companyName: row[0],
          website: row[1],
          linkedinUrl: row[2] || '',
          linkedinCareerPageUrl: row[3] || row[1] // fallback to website if no career page
        }));

      logger.info(`📊 Loaded ${companies.length} companies from sheet`);
      return companies;

    } catch (error) {
      logger.error('❌ Failed to get companies data:', error);
      throw error;
    }
  }

  async getJobPostings() {
    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheets.jobPostings}!A2:H10000`
      });

      const rows = response.data.values || [];
      const jobPostings = rows
        .filter(row => row.length >= 3) // Must have company, job title, location
        .map(row => ({
          company: row[0],
          jobTitle: row[1],
          location: row[2],
          department: row[3] || '',
          postedDate: row[4] || '',
          foundDate: row[5] || '',
          url: row[6] || '',
          confidenceScore: parseFloat(row[7]) || 0
        }));

      return jobPostings;

    } catch (error) {
      logger.error('❌ Failed to get job postings:', error);
      return [];
    }
  }

  async getNewHires() {
    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheets.newHires}!A2:G10000`
      });

      const rows = response.data.values || [];
      const newHires = rows
        .filter(row => row.length >= 3) // Must have person name, company, position
        .map(row => ({
          personName: row[0],
          company: row[1],
          position: row[2],
          startDate: row[3] || '',
          linkedinProfile: row[4] || '',
          source: row[5] || '',
          confidenceScore: parseFloat(row[6]) || 0
        }));

      return newHires;

    } catch (error) {
      logger.error('❌ Failed to get new hires:', error);
      return [];
    }
  }


  async updateSheet(sheetName, data) {
    try {
      if (!data || data.length === 0) {
        logger.info(`No data provided to update sheet: ${sheetName}`);
        return;
      }

      const sheetExists = Object.values(this.sheets).includes(sheetName);
      if (!sheetExists) {
        throw new Error(`Sheet "${sheetName}" does not exist in the configuration.`);
      }

      logger.info(`📝 Appending ${data.length} rows to sheet: ${sheetName}...`);

      await this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: sheetName,
        valueInputOption: 'RAW',
        resource: {
          values: data
        }
      });

      logger.info(`✅ Appended ${data.length} rows to sheet: ${sheetName}`);

    } catch (error) {
      logger.error(`❌ Failed to update sheet ${sheetName}:`, error);
      throw error;
    }
  }

  async updateAnalytics(analyticsData) {
    try {
      const successRate = analyticsData.processed > 0 ? 
        ((analyticsData.processed - analyticsData.errors) / analyticsData.processed * 100).toFixed(2) : 0;

      const values = [[
        analyticsData.timestamp,
        analyticsData.scanType,
        analyticsData.processed,
        analyticsData.newItems,
        analyticsData.errors,
        analyticsData.duration,
        `${successRate}%`
      ]];

      await this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheets.analytics}!A:G`,
        valueInputOption: 'RAW',
        resource: {
          values: values
        }
      });

    } catch (error) {
      logger.error('❌ Failed to update analytics:', error);
    }
  }

  async updateHealthMetrics(metricData) {
    try {
      const values = [[
        moment().format('YYYY-MM-DD HH:mm:ss'),
        metricData.type,
        metricData.status,
        metricData.message || '',
        metricData.responseTime || 0,
        metricData.systemLoad || 0
      ]];

      await this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheets.healthMetrics}!A:F`,
        valueInputOption: 'RAW',
        resource: {
          values: values
        }
      });

    } catch (error) {
      logger.error('❌ Failed to update health metrics:', error);
    }
  }

  async getJobPostingsByDate(date) {
    try {
      const allJobs = await this.getJobPostings();
      return allJobs.filter(job => 
        job.foundDate && job.foundDate.startsWith(date)
      );
    } catch (error) {
      logger.error(`❌ Failed to get job postings by date ${date}:`, error);
      return [];
    }
  }

  async getNewHiresByDate(date) {
    try {
      const allHires = await this.getNewHires();
      return allHires.filter(hire => 
        hire.startDate && hire.startDate.startsWith(date)
      );
    } catch (error) {
      logger.error(`❌ Failed to get new hires by date ${date}:`, error);
      return [];
    }
  }

  async clearSheet(sheetName) {
    try {
      await this.sheetsApi.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A2:Z10000`
      });
      logger.info(`🧹 Cleared sheet: ${sheetName}`);
    } catch (error) {
      logger.error(`❌ Failed to clear sheet ${sheetName}:`, error);
    }
  }

  async getSheetRowCount(sheetName) {
    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:A`
      });
      return response.data.values ? response.data.values.length - 1 : 0; // -1 for header
    } catch (error) {
      logger.error(`❌ Failed to get row count for ${sheetName}:`, error);
      return 0;
    }
  }

  isInitialized() {
    return this.isInitialized;
  }
}

module.exports = { GoogleSheetsService };
