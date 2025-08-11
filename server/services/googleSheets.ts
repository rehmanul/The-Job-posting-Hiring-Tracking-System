import { GoogleSpreadsheet } from 'google-spreadsheet';
import { randomUUID } from 'crypto';
import type { Company, JobPosting, NewHire, Analytics, HealthMetric } from '@shared/schema';

export class GoogleSheetsService {
  private doc: GoogleSpreadsheet | null = null;
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

      // Use service account authentication
      await this.doc.useServiceAccountAuth({
        client_email: serviceAccountEmail,
        private_key: privateKey,
      });

      await this.doc.loadInfo();
      
      // Ensure required sheets exist
      await this.ensureSheets();
      
      this.isInitialized = true;
      console.log('✅ Google Sheets service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets service:', error);
      // Don't throw - let system continue without Google Sheets
      this.isInitialized = false;
    }
  }

  private async ensureSheets(): Promise<void> {
    if (!this.doc) return;
    
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
        return ['Name', 'Website', 'Career Page URL', 'LinkedIn URL', 'Industry', 'Location', 'Is Active', 'Notes'];
      case 'Job Postings':
        return ['Company', 'Job Title', 'Location', 'Department', 'Posted Date', 'Found Date', 'URL', 'Confidence Score', 'Source'];
      case 'New Hires':
        return ['Person Name', 'Company', 'Position', 'Start Date', 'LinkedIn Profile', 'Source', 'Confidence Score', 'Found Date'];
      case 'Analytics':
        return ['Date', 'Total Companies', 'Active Companies', 'Jobs Found', 'Hires Found', 'Successful Scans', 'Failed Scans', 'Avg Response Time'];
      case 'Health Metrics':
        return ['Timestamp', 'Service', 'Status', 'Response Time', 'Error Message'];
      default:
        return ['Data'];
    }
  }

  async getCompanies(): Promise<Company[]> {
    if (!this.doc || !this.isInitialized) {
      console.warn('⚠️ Google Sheets not initialized - returning empty companies list');
      return [];
    }

    try {
      const sheet = this.doc.sheetsByTitle['Company Data'];
      if (!sheet) {
        console.warn('⚠️ Company Data sheet not found');
        return [];
      }

      const rows = await sheet.getRows();
      const companies: Company[] = [];

      for (const row of rows) {
        try {
          const company: Company = {
            id: randomUUID(),
            name: row.get('Name') || row.get('Company Name') || '',
            website: row.get('Website') || '',
            careerPageUrl: row.get('Career Page URL') || row.get('Careers URL') || '',
            linkedinUrl: row.get('LinkedIn URL') || '',
            industry: row.get('Industry') || '',
            location: row.get('Location') || '',
            isActive: this.parseBoolean(row.get('Is Active') || row.get('Active')),
            notes: row.get('Notes') || '',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          if (company.name) {
            companies.push(company);
          }
        } catch (rowError) {
          console.warn('⚠️ Failed to parse company row:', rowError);
        }
      }

      console.log(`✅ Loaded ${companies.length} companies from Google Sheets`);
      return companies;

    } catch (error) {
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
      
      await sheet.addRow({
        'Name': company.name,
        'Website': company.website || '',
        'Career Page URL': company.careerPageUrl || '',
        'LinkedIn URL': company.linkedinUrl || '',
        'Industry': company.industry || '',
        'Location': company.location || '',
        'Is Active': company.isActive ? 'TRUE' : 'FALSE',
        'Notes': company.notes || ''
      });
    } catch (error) {
      console.error('❌ Failed to sync company to Google Sheets:', error);
    }
  }

  async syncJobPosting(job: JobPosting): Promise<void> {
    if (!this.doc || !this.isInitialized) return;
    
    try {
      const sheet = this.doc.sheetsByTitle['Job Postings'];
      if (!sheet) return;
      
      await sheet.addRow({
        'Company': job.company,
        'Job Title': job.jobTitle,
        'Location': job.location || '',
        'Department': job.department || '',
        'Posted Date': job.postedDate ? job.postedDate.toISOString().split('T')[0] : '',
        'Found Date': job.foundDate ? job.foundDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        'URL': job.url || '',
        'Confidence Score': job.confidenceScore || '',
        'Source': job.source,
      });
    } catch (error) {
      console.error('❌ Failed to sync job posting to Google Sheets:', error);
    }
  }

  async syncNewHire(hire: NewHire): Promise<void> {
    if (!this.doc || !this.isInitialized) return;
    
    try {
      const sheet = this.doc.sheetsByTitle['New Hires'];
      if (!sheet) return;
      
      await sheet.addRow({
        'Person Name': hire.personName,
        'Company': hire.company,
        'Position': hire.position,
        'Start Date': hire.startDate ? hire.startDate.toISOString().split('T')[0] : '',
        'LinkedIn Profile': hire.linkedinProfile || '',
        'Source': hire.source,
        'Confidence Score': hire.confidenceScore || '',
        'Found Date': hire.foundDate ? hire.foundDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('❌ Failed to sync new hire to Google Sheets:', error);
    }
  }

  async syncAnalytics(analytics: Analytics): Promise<void> {
    if (!this.doc || !this.isInitialized) return;
    
    try {
      const sheet = this.doc.sheetsByTitle['Analytics'];
      if (!sheet) return;
      
      await sheet.addRow({
        'Date': analytics.date ? analytics.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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
    if (!this.doc || !this.isInitialized) return;
    
    try {
      const sheet = this.doc.sheetsByTitle['Health Metrics'];
      if (!sheet) return;
      
      await sheet.addRow({
        'Timestamp': metric.timestamp ? metric.timestamp.toISOString() : new Date().toISOString(),
        'Service': metric.service,
        'Status': metric.status,
        'Response Time': metric.responseTime?.toString() || '',
        'Error Message': metric.errorMessage || '',
      });
    } catch (error) {
      console.error('❌ Failed to sync health metric to Google Sheets:', error);
    }
  }
}