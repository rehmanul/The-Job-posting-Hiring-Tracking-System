import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { randomUUID } from 'crypto';
import type { Company, JobPosting, NewHire, Analytics, HealthMetric } from '@shared/schema';

export class GoogleSheetsService {
  private doc: GoogleSpreadsheet | null = null;
  private isInitialized = false;
  private serviceAccountAuth: JWT | null = null;

  constructor() {
    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetsId) {
      console.warn('⚠️ GOOGLE_SHEETS_ID not provided - Google Sheets integration disabled');
      return;
    }
    // Don't initialize doc here, do it in initialize() method
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Google Sheets service...');

      const sheetsId = process.env.GOOGLE_SHEETS_ID;
      if (!sheetsId) {
        console.error('❌ GOOGLE_SHEETS_ID environment variable not set');
        console.log('📝 Available environment variables:', Object.keys(process.env).filter(key => key.includes('GOOGLE')));
        throw new Error('Google Sheets ID not configured');
      }

      console.log('🔑 Setting up Google Sheets authentication...');
      
      // Set up service account authentication
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.warn('⚠️ Missing Google Service Account credentials - Google Sheets will be disabled');
        return; // Don't throw error, just disable Google Sheets
      }

      // Clean up the private key format
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;
      console.log('🔍 Private key first 50 chars:', privateKey.substring(0, 50));
      
      // Handle different possible formats
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
        console.log('🔧 Converted \\n to actual newlines');
      }
      
      // Handle JSON escaped format
      try {
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = JSON.parse(privateKey);
          console.log('🔧 Parsed JSON-escaped private key');
        }
      } catch (e) {
        console.log('🔍 Private key is not JSON-escaped');
      }
      
      // Ensure proper PEM format
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') && !privateKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        console.error('❌ Private key must be in PEM format starting with -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----');
        console.error('🔍 Current key starts with:', privateKey.substring(0, 100));
        console.error('💡 Make sure to copy the entire private key including the BEGIN and END lines');
        return;
      }
      
      console.log('✅ Private key format looks correct');

      try {
        this.serviceAccountAuth = new JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: privateKey,
          scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
          ],
        });
      } catch (keyError: any) {
        console.error('❌ Failed to create JWT with private key:', keyError.message);
        console.error('💡 Make sure your GOOGLE_PRIVATE_KEY is in proper PEM format');
        return;
      }

      // Initialize the document
      this.doc = new GoogleSpreadsheet(sheetsId, this.serviceAccountAuth);
      await this.doc.loadInfo();
      
      console.log(`✅ Connected to Google Sheet: "${this.doc.title}"`);
      
      // Skip sheet creation - sheets already exist
      console.log('📋 Using existing Google Sheets structure');
      
      // Test reading companies
      console.log('📋 Testing companies data retrieval...');
      const companies = await this.getCompanies();
      console.log(`📊 Found ${companies.length} companies in sheet`);

      this.isInitialized = true;
    } catch (error: any) {
      console.warn('⚠️ Failed to initialize Google Sheets:', error.message);
      console.log('💡 Google Sheets integration will be disabled. To enable, set GOOGLE_SHEETS_ID and credentials in Secrets.');
      this.isInitialized = false;
    }
  }

  private async ensureSheets(): Promise<void> {
    if (!this.doc) return;

    const requiredSheets = [
      'Company Data',
      'Job Postings',
      'New Hires',
      'Activity Log',
      'Health Metrics',
      'Summary',
      'Analytics'
    ];

    const existingTitles = this.doc.sheetsByIndex.map(sheet => sheet.title);

    for (const sheetTitle of requiredSheets) {
      if (!existingTitles.includes(sheetTitle)) {
        try {
          await this.doc.addSheet({ 
            title: sheetTitle,
            headerValues: this.getHeadersForSheet(sheetTitle)
          });
          console.log(`✅ Created sheet "${sheetTitle}" with headers`);
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            console.log(`📄 Sheet "${sheetTitle}" already exists, skipping creation.`);
          } else {
            throw error;
          }
        }
      } else {
        // Ensure headers exist in existing sheets
        try {
          const sheet = this.doc.sheetsByTitle[sheetTitle];
          await sheet.loadHeaderRow();
          
          // If no headers or empty, add them
          if (!sheet.headerValues || sheet.headerValues.length === 0) {
            const headers = this.getHeadersForSheet(sheetTitle);
            await sheet.setHeaderRow(headers);
            console.log(`✅ Added headers to existing sheet "${sheetTitle}"`);
          }
        } catch (error: any) {
          console.log(`⚠️ Could not update headers for "${sheetTitle}": ${error.message}`);
        }
      }
    }
  }

  private getHeadersForSheet(sheetTitle: string): string[] {
    switch (sheetTitle) {
      case 'Company Data':
        return ['Name', 'Website', 'Career Page URL', 'LinkedIn URL', 'Industry', 'Location', 'Is Active', 'Notes'];
      case 'Job Postings':
        return ['Company', 'Job Title', 'Location', 'Department', 'Date', 'Time', 'Job URL', 'Confidence Score'];
      case 'New Hires':
        return ['Person Name', 'Company', 'Position', 'Start Date', 'Previous Company', 'LinkedIn Profile', 'Source', 'Confidence Score', 'Found Date', 'Verified'];
      case 'Activity Log':
        return ['Timestamp', 'Type', 'Company', 'Details', 'Status', 'Source'];
      case 'Health Metrics':
        return ['Timestamp', 'Service', 'Status', 'Response Time', 'Error Message', 'CPU Usage', 'Memory Usage', 'Details'];
      case 'Summary':
        return ['Report Type', 'Report Date', 'Period', 'Total Jobs', 'Total Hires', 'Active Companies', 'Growth Rate %', 'Top Company', 'Top Company Jobs', 'Remote Jobs', 'Most Active Day'];
      case 'Analytics':
        return ['Timestamp', 'Total Companies', 'Active Companies', 'Jobs Found Today', 'Hires Found Today', 'Successful Scans', 'Failed Scans', 'Avg Response Time', 'Details'];
      default:
        return ['Data'];
    }
  }

  async getCompanies(): Promise<Company[]> {
    if (!this.doc) {
      console.warn('⚠️ Google Sheets document not available - returning empty companies list');
      return [];
    }

    try {
      // Force reload document info to ensure we have latest data
      await this.doc.loadInfo();
      
      const sheet = this.doc.sheetsByTitle['Company Data'];
      if (!sheet) {
        console.warn('⚠️ Company Data sheet not found. Available sheets:', Object.keys(this.doc.sheetsByTitle));
        return [];
      }

      // Load header row first
      await sheet.loadHeaderRow();
      console.log('📋 Sheet headers:', sheet.headerValues);
      
      const rows = await sheet.getRows();
      console.log(`📊 Found ${rows.length} rows in Company Data sheet`);
      
      const companies: Company[] = [];

      for (const row of rows) {
        try {
          // Process row data

          const company: Company = {
            id: randomUUID(),
            name: row.get('Company Name') || row.get('Name') || '',
            website: row.get('Website') || '',
            careerPageUrl: row.get('Career Page URL') || row.get('Careers URL') || '',
            linkedinUrl: row.get('LinkedIn URL') || '',
            industry: row.get('Industry') || null,
            location: row.get('Location') || null,
            isActive: this.parseBoolean(row.get('Is Active') || row.get('Active')),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastScanned: null,
          };

          if (company.name && company.name.trim()) {
            companies.push(company);
          }
        } catch (rowError) {
          console.warn('⚠️ Failed to parse company row:', rowError);
        }
      }

      console.log(`✅ Successfully loaded ${companies.length} companies from Google Sheets`);
      this.isInitialized = true;
      return companies;

    } catch (error: any) {
      console.error('❌ Failed to load companies from Google Sheets:', error);
      return [];
    }
  }

  private parseBoolean(value: string | undefined): boolean {
    if (!value) return true; // Default to active
    const lowerValue = value.toLowerCase().trim();
    return lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1' || lowerValue === 'active';
  }

  async syncCompany(company: Company): Promise<void> {
    if (!this.doc || !this.isInitialized) return;

    try {
      const sheet = this.doc.sheetsByTitle['Company Data'];
      if (!sheet) return;

      // Only add data row - preserve all formatting
      await sheet.addRow({
        'Name': company.name,
        'Website': company.website || '',
        'Career Page URL': company.careerPageUrl || '',
        'LinkedIn URL': company.linkedinUrl || '',
        'Is Active': company.isActive ? 'TRUE' : 'FALSE',
      });
    } catch (error: any) {
      console.error('❌ Failed to sync company to Google Sheets:', error);
    }
  }

  async syncJobPosting(job: JobPosting): Promise<void> {
    if (!this.doc || !this.isInitialized) return;

    try {
      const sheet = this.doc.sheetsByTitle['Job Postings'];
      if (!sheet) return;

      // Check for duplicates in Google Sheets
      const rows = await sheet.getRows();
      const isDuplicate = rows.some(row => 
        row.get('Company')?.toLowerCase() === job.company.toLowerCase() &&
        row.get('Job Title')?.toLowerCase() === job.jobTitle.toLowerCase() &&
        row.get('Date') === (job.postedDate ? job.postedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
      );

      if (isDuplicate) {
        console.log(`🚫 Skipping duplicate job in Google Sheets: ${job.jobTitle} at ${job.company}`);
        return;
      }

      const now = new Date();
      const utcDate = now.toISOString().split('T')[0];
      const utcTime = now.toISOString().split('T')[1].split('.')[0];

      await sheet.addRow({
        'Company': job.company || '',
        'Job Title': job.jobTitle || '',
        'Location': job.location || 'Remote/Not specified',
        'Department': job.department || 'General',
        'Date': job.postedDate ? job.postedDate.toISOString().split('T')[0] : utcDate,
        'Time': job.foundDate ? job.foundDate.toISOString().split('T')[1].split('.')[0] : utcTime,
        'Job URL': job.url || '',
        'Confidence Score': job.confidenceScore || '90'
      });
      
      await this.logActivity('Job Found', job.company, `New job: ${job.jobTitle}`, 'Success');
      
    } catch (error: any) {
      console.error('❌ Failed to sync job posting to Google Sheets:', error);
    }
  }

  async syncNewHire(hire: NewHire): Promise<void> {
    if (!this.doc || !this.isInitialized) return;

    try {
      const sheet = this.doc.sheetsByTitle['New Hires'];
      if (!sheet) return;

      // Check for duplicates in Google Sheets
      const rows = await sheet.getRows();
      const isDuplicate = rows.some(row => 
        row.get('Person Name')?.toLowerCase() === hire.personName.toLowerCase() &&
        row.get('Company')?.toLowerCase() === hire.company.toLowerCase() &&
        row.get('Position')?.toLowerCase() === hire.position.toLowerCase()
      );

      if (isDuplicate) {
        console.log(`🚫 Skipping duplicate hire in Google Sheets: ${hire.personName} at ${hire.company}`);
        return;
      }

      const utcDate = new Date().toISOString().split('T')[0];

      await sheet.addRow({
        'Person Name': hire.personName || '',
        'Company': hire.company || '',
        'Position': hire.position || '',
        'Start Date': hire.startDate ? hire.startDate.toISOString().split('T')[0] : utcDate,
        'Previous Company': hire.previousCompany || '',
        'LinkedIn Profile': hire.linkedinProfile || '',
        'Source': hire.source || 'LinkedIn',
        'Confidence Score': hire.confidenceScore || '85',
        'Found Date': hire.foundDate ? hire.foundDate.toISOString().split('T')[0] : utcDate,
        'Verified': 'No'
      });
      
      await this.logActivity('Hire Detected', hire.company, `New hire: ${hire.personName} as ${hire.position}`, 'Success');
      
    } catch (error: any) {
      console.error('❌ Failed to sync new hire to Google Sheets:', error);
    }
  }

  private async logActivity(type: string, company: string, details: string, status: string): Promise<void> {
    if (!this.doc || !this.isInitialized) return;

    try {
      const sheet = this.doc.sheetsByTitle['Activity Log'];
      if (!sheet) return;

      const utcTimestamp = new Date().toISOString().replace('T', ' ').split('.')[0] + ' UTC';

      await sheet.addRow({
        'Timestamp': utcTimestamp,
        'Type': type,
        'Company': company,
        'Details': details,
        'Status': status,
        'Source': 'Job Tracker'
      });
    } catch (error: any) {
      console.error('❌ Failed to log activity:', error);
    }
  }

  async syncSystemStatus(status: string, details: string): Promise<void> {
    if (!this.doc || !this.isInitialized) return;

    try {
      await this.logActivity('System Status', 'System', details, status);
    } catch (error: any) {
      console.error('❌ Failed to sync system status:', error);
    }
  }

  async syncHealthMetric(metric: HealthMetric): Promise<void> {
    if (!this.doc || !this.isInitialized) return;

    try {
      const sheet = this.doc.sheetsByTitle['Health Metrics'];
      if (!sheet) return;

      const utcTimestamp = new Date().toISOString().replace('T', ' ').split('.')[0] + ' UTC';

      await sheet.addRow({
        'Timestamp': utcTimestamp,
        'Service': metric.service,
        'Status': metric.status,
        'Response Time': metric.responseTime ? `${metric.responseTime}ms` : '',
        'Error Message': metric.errorMessage || '',
        'CPU Usage': '',
        'Memory Usage': '',
        'Details': metric.metadata ? JSON.stringify(metric.metadata) : ''
      });
    } catch (error: any) {
      console.error('❌ Failed to sync health metric:', error);
    }
  }

  async syncAnalytics(analytics: Analytics): Promise<void> {
    if (!this.doc || !this.isInitialized) return;

    try {
      const sheet = this.doc.sheetsByTitle['Analytics'];
      if (!sheet) return;

      const utcTimestamp = new Date().toISOString().replace('T', ' ').split('.')[0] + ' UTC';

      await sheet.addRow({
        'Timestamp': utcTimestamp,
        'Total Companies': analytics.totalCompanies ?? 0,
        'Active Companies': analytics.activeCompanies ?? 0,
        'Jobs Found Today': analytics.jobsFound ?? 0,
        'Hires Found Today': analytics.hiresFound ?? 0,
        'Successful Scans': analytics.successfulScans ?? 0,
        'Failed Scans': analytics.failedScans ?? 0,
        'Avg Response Time': analytics.avgResponseTime ?? '',
        'Details': analytics.metadata ? JSON.stringify(analytics.metadata) : ''
      });
    } catch (error: any) {
      console.error('❌ Failed to sync analytics:', error);
    }
  }

  async syncSummaryReport(reportData: {
    type: 'Daily' | 'Weekly' | 'Monthly';
    totalJobs: number;
    totalHires: number;
    activeCompanies: number;
    growthRate: number;
    topCompany: string;
    topCompanyJobs: number;
    remoteJobs: number;
    mostActiveDay: string;
  }): Promise<void> {
    if (!this.doc || !this.isInitialized) return;

    try {
      const sheet = this.doc.sheetsByTitle['Summary'];
      if (!sheet) return;

      const now = new Date();
      const reportDate = now.toISOString().split('T')[0];
      let period = '';
      
      if (reportData.type === 'Daily') {
        period = reportDate;
      } else if (reportData.type === 'Weekly') {
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        const weekEnd = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        period = `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`;
      } else {
        period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      await sheet.addRow({
        'Report Type': reportData.type,
        'Report Date': reportDate,
        'Period': period,
        'Total Jobs': reportData.totalJobs,
        'Total Hires': reportData.totalHires,
        'Active Companies': reportData.activeCompanies,
        'Growth Rate %': `${reportData.growthRate.toFixed(1)}%`,
        'Top Company': reportData.topCompany,
        'Top Company Jobs': reportData.topCompanyJobs,
        'Remote Jobs': reportData.remoteJobs,
        'Most Active Day': reportData.mostActiveDay
      });
      
      console.log(`✅ ${reportData.type} summary report synced to Google Sheets`);
    } catch (error: any) {
      console.error('❌ Failed to sync summary report:', error);
    }
  }
}