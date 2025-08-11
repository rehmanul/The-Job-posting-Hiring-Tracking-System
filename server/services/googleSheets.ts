import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Company, JobPosting, NewHire, Analytics, HealthMetric } from '@shared/schema';

export class GoogleSheetsService {
  private doc: GoogleSpreadsheet;
  private isInitialized = false;

  constructor() {
    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetsId) {
      console.warn('⚠️ GOOGLE_SHEETS_ID not provided - Google Sheets integration disabled');
      return;
    }
    this.doc = new GoogleSpreadsheet(sheetsId);
  }

  async initialize(): Promise<void> {
    if (!this.doc) {
      console.warn('⚠️ Google Sheets service disabled - skipping initialization');
      return;
    }
    
    try {
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!serviceAccountEmail || !privateKey) {
        console.warn('⚠️ Google Sheets credentials not provided - service disabled');
        return;
      }

      const auth = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.doc.useServiceAccountAuth(auth);
      await this.doc.loadInfo();
      
      // Ensure required sheets exist
      await this.ensureSheets();
      
      this.isInitialized = true;
      console.log('✅ Google Sheets service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets service:', error);
      throw error;
    }
  }

  private async ensureSheets(): Promise<void> {
    const requiredSheets = [
      'Company Data',
      'Job Postings', 
      'New Hires',
      'Analytics',
      'Health Metrics'
    ];

    const existingTitles = this.doc.sheetsByIndex.map(sheet => sheet.title);
    
    for (const sheetTitle of requiredSheets) {
      if (!existingTitles.includes(sheetTitle)) {
        await this.doc.addSheet({ 
          title: sheetTitle,
          headerValues: this.getHeadersForSheet(sheetTitle)
        });
      }
    }
  }

  private getHeadersForSheet(sheetTitle: string): string[] {
    switch (sheetTitle) {
      case 'Company Data':
        return ['Company Name', 'Website', 'LinkedIn URL', 'LinkedIn Career Page URL', 'Is Active', 'Last Scanned'];
      case 'Job Postings':
        return ['Company', 'Job Title', 'Location', 'Department', 'Posted Date', 'Found Date', 'URL', 'Confidence Score', 'Source'];
      case 'New Hires':
        return ['Person Name', 'Company', 'Position', 'Start Date', 'LinkedIn Profile', 'Source', 'Confidence Score', 'Found Date'];
      case 'Analytics':
        return ['Date', 'Total Companies', 'Active Companies', 'Jobs Found', 'Hires Found', 'Successful Scans', 'Failed Scans', 'Avg Response Time'];
      case 'Health Metrics':
        return ['Timestamp', 'Service', 'Status', 'Response Time', 'Error Message'];
      default:
        return [];
    }
  }

  async getCompanies(): Promise<Company[]> {
    if (!this.doc) return [];
    if (!this.isInitialized) await this.initialize();
    
    try {
      const sheet = this.doc.sheetsByTitle['Company Data'];
      const rows = await sheet.getRows();
      
      return rows.map(row => ({
        id: row.get('ID') || '',
        name: row.get('Company Name') || '',
        website: row.get('Website') || '',
        linkedinUrl: row.get('LinkedIn URL') || '',
        careerPageUrl: row.get('LinkedIn Career Page URL') || '',
        isActive: row.get('Is Active') === 'TRUE',
        lastScanned: row.get('Last Scanned') ? new Date(row.get('Last Scanned')) : null,
        createdAt: new Date(),
      }));
    } catch (error) {
      console.error('❌ Failed to get companies from Google Sheets:', error);
      return [];
    }
  }

  async syncJobPosting(job: JobPosting): Promise<void> {
    if (!this.doc) return;
    if (!this.isInitialized) await this.initialize();
    
    try {
      const sheet = this.doc.sheetsByTitle['Job Postings'];
      await sheet.addRow({
        'Company': job.company,
        'Job Title': job.jobTitle,
        'Location': job.location || '',
        'Department': job.department || '',
        'Posted Date': job.postedDate ? job.postedDate.toISOString().split('T')[0] : '',
        'Found Date': job.foundDate ? job.foundDate.toISOString().split('T')[0] : '',
        'URL': job.url || '',
        'Confidence Score': job.confidenceScore || '',
        'Source': job.source,
      });
    } catch (error) {
      console.error('❌ Failed to sync job posting to Google Sheets:', error);
    }
  }

  async syncNewHire(hire: NewHire): Promise<void> {
    if (!this.doc) return;
    if (!this.isInitialized) await this.initialize();
    
    try {
      const sheet = this.doc.sheetsByTitle['New Hires'];
      await sheet.addRow({
        'Person Name': hire.personName,
        'Company': hire.company,
        'Position': hire.position,
        'Start Date': hire.startDate ? hire.startDate.toISOString().split('T')[0] : '',
        'LinkedIn Profile': hire.linkedinProfile || '',
        'Source': hire.source,
        'Confidence Score': hire.confidenceScore || '',
        'Found Date': hire.foundDate ? hire.foundDate.toISOString().split('T')[0] : '',
      });
    } catch (error) {
      console.error('❌ Failed to sync new hire to Google Sheets:', error);
    }
  }

  async syncAnalytics(analytics: Analytics): Promise<void> {
    if (!this.doc) return;
    if (!this.isInitialized) await this.initialize();
    
    try {
      const sheet = this.doc.sheetsByTitle['Analytics'];
      await sheet.addRow({
        'Date': analytics.date ? analytics.date.toISOString().split('T')[0] : '',
        'Total Companies': analytics.totalCompanies || 0,
        'Active Companies': analytics.activeCompanies || 0,
        'Jobs Found': analytics.jobsFound || 0,
        'Hires Found': analytics.hiresFound || 0,
        'Successful Scans': analytics.successfulScans || 0,
        'Failed Scans': analytics.failedScans || 0,
        'Avg Response Time': analytics.avgResponseTime || 0,
      });
    } catch (error) {
      console.error('❌ Failed to sync analytics to Google Sheets:', error);
    }
  }

  async syncHealthMetric(metric: HealthMetric): Promise<void> {
    if (!this.doc) return;
    if (!this.isInitialized) await this.initialize();
    
    try {
      const sheet = this.doc.sheetsByTitle['Health Metrics'];
      await sheet.addRow({
        'Timestamp': metric.timestamp ? metric.timestamp.toISOString() : '',
        'Service': metric.service,
        'Status': metric.status,
        'Response Time': metric.responseTime || '',
        'Error Message': metric.errorMessage || '',
      });
    } catch (error) {
      console.error('❌ Failed to sync health metric to Google Sheets:', error);
    }
  }
}
