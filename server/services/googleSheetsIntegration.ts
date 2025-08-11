import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { InsertCompany, InsertJobPosting, InsertNewHire } from '../../shared/schema';

export class GoogleSheetsIntegrationService {
  private doc: GoogleSpreadsheet | null = null;
  private isEnabled: boolean;
  private serviceAccountAuth: JWT | null = null;

  constructor() {
    this.isEnabled = !!(
      process.env.GOOGLE_SHEETS_ID && 
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
      process.env.GOOGLE_PRIVATE_KEY
    );

    if (this.isEnabled) {
      this.initializeAuth();
      console.log('📊 Google Sheets Integration initialized');
    } else {
      console.warn('⚠️ Google Sheets Integration disabled - missing credentials');
    }
  }

  private async initializeAuth(): Promise<void> {
    try {
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Service Account credentials');
      }

      // Clean and format the private key
      const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

      this.serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID!, this.serviceAccountAuth);
      await this.doc.loadInfo();
      
      console.log(`✅ Connected to Google Sheet: "${this.doc.title}"`);
      
      // Ensure required worksheets exist
      await this.ensureWorksheets();
      
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets auth:', (error as Error).message);
      this.isEnabled = false;
    }
  }

  private async ensureWorksheets(): Promise<void> {
    if (!this.doc) return;

    const requiredSheets = [
      { title: 'Companies', headers: ['Name', 'Website', 'LinkedIn URL', 'Industry', 'Size', 'Status', 'Last Checked'] },
      { title: 'Jobs', headers: ['Job Title', 'Company', 'Location', 'Posted Date', 'URL', 'Department', 'Source', 'Confidence Score', 'Status'] },
      { title: 'Hires', headers: ['Person Name', 'Position', 'Company', 'Start Date', 'LinkedIn Profile', 'Source', 'Confidence Score', 'Department'] },
      { title: 'Analytics', headers: ['Date', 'Total Jobs', 'New Jobs', 'Total Hires', 'New Hires', 'Companies Tracked', 'System Health'] }
    ];

    for (const sheetConfig of requiredSheets) {
      let sheet = this.doc.sheetsByTitle[sheetConfig.title];
      
      if (!sheet) {
        console.log(`📝 Creating new worksheet: ${sheetConfig.title}`);
        sheet = await this.doc.addSheet({
          title: sheetConfig.title,
          headerValues: sheetConfig.headers
        });
      } else {
        // Ensure headers are set correctly
        await sheet.loadHeaderRow();
        if (sheet.headerValues.length === 0) {
          await sheet.setHeaderRow(sheetConfig.headers);
        }
      }
    }
  }

  async loadCompaniesFromSheet(): Promise<InsertCompany[]> {
    if (!this.isEnabled || !this.doc) {
      console.warn('⚠️ Google Sheets not available for company loading');
      return [];
    }

    try {
      const companiesSheet = this.doc.sheetsByTitle['Companies'];
      if (!companiesSheet) {
        console.warn('⚠️ Companies sheet not found');
        return [];
      }

      await companiesSheet.loadHeaderRow();
      const rows = await companiesSheet.getRows();
      
      const companies: InsertCompany[] = [];
      
      for (const row of rows) {
        const name = row.get('Name')?.trim();
        const website = row.get('Website')?.trim();
        
        if (name && website) {
          companies.push({
            name,
            website,
            linkedinUrl: row.get('LinkedIn URL')?.trim() || '',
            industry: row.get('Industry')?.trim() || '',
            size: row.get('Size')?.trim() || '',
            status: row.get('Status')?.trim() || 'active'
          });
        }
      }
      
      console.log(`✅ Loaded ${companies.length} companies from Google Sheets`);
      return companies;
      
    } catch (error) {
      console.error('❌ Failed to load companies from sheet:', (error as Error).message);
      return [];
    }
  }

  async syncJobsToSheet(jobs: InsertJobPosting[]): Promise<void> {
    if (!this.isEnabled || !this.doc || jobs.length === 0) return;

    try {
      const jobsSheet = this.doc.sheetsByTitle['Jobs'];
      if (!jobsSheet) return;

      // Clear existing data (keep headers)
      await jobsSheet.loadCells();
      if (jobsSheet.rowCount > 1) {
        await jobsSheet.deleteRows(2, jobsSheet.rowCount);
      }

      // Add new jobs data
      const rowsData = jobs.map(job => ({
        'Job Title': job.jobTitle || '',
        'Company': job.company || '',
        'Location': job.location || '',
        'Posted Date': job.postedDate || '',
        'URL': job.url || '',
        'Department': job.department || '',
        'Source': job.source || '',
        'Confidence Score': job.confidenceScore || '',
        'Status': 'active'
      }));

      if (rowsData.length > 0) {
        await jobsSheet.addRows(rowsData);
        console.log(`✅ Synced ${rowsData.length} jobs to Google Sheets`);
      }

    } catch (error) {
      console.error('❌ Failed to sync jobs to sheet:', (error as Error).message);
    }
  }

  async syncHiresToSheet(hires: InsertNewHire[]): Promise<void> {
    if (!this.isEnabled || !this.doc || hires.length === 0) return;

    try {
      const hiresSheet = this.doc.sheetsByTitle['Hires'];
      if (!hiresSheet) return;

      // Clear existing data (keep headers)
      await hiresSheet.loadCells();
      if (hiresSheet.rowCount > 1) {
        await hiresSheet.deleteRows(2, hiresSheet.rowCount);
      }

      // Add new hires data
      const rowsData = hires.map(hire => ({
        'Person Name': hire.personName || '',
        'Position': hire.position || '',
        'Company': hire.company || '',
        'Start Date': hire.startDate || '',
        'LinkedIn Profile': hire.linkedinProfile || '',
        'Source': hire.source || '',
        'Confidence Score': hire.confidenceScore || '',
        'Department': hire.department || ''
      }));

      if (rowsData.length > 0) {
        await hiresSheet.addRows(rowsData);
        console.log(`✅ Synced ${rowsData.length} hires to Google Sheets`);
      }

    } catch (error) {
      console.error('❌ Failed to sync hires to sheet:', (error as Error).message);
    }
  }

  async updateAnalytics(data: {
    totalJobs: number;
    newJobs: number;
    totalHires: number;
    newHires: number;
    companiesTracked: number;
    systemHealth: string;
  }): Promise<void> {
    if (!this.isEnabled || !this.doc) return;

    try {
      const analyticsSheet = this.doc.sheetsByTitle['Analytics'];
      if (!analyticsSheet) return;

      const today = new Date().toISOString().split('T')[0];
      
      // Add daily analytics row
      await analyticsSheet.addRow({
        'Date': today,
        'Total Jobs': data.totalJobs,
        'New Jobs': data.newJobs,
        'Total Hires': data.totalHires,
        'New Hires': data.newHires,
        'Companies Tracked': data.companiesTracked,
        'System Health': data.systemHealth
      });

      console.log(`✅ Updated analytics in Google Sheets for ${today}`);

    } catch (error) {
      console.error('❌ Failed to update analytics in sheet:', (error as Error).message);
    }
  }

  async exportBackup(): Promise<void> {
    if (!this.isEnabled || !this.doc) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create backup sheet
      const backupSheet = await this.doc.addSheet({
        title: `Backup_${timestamp}`,
        headerValues: ['Type', 'Data', 'Timestamp']
      });

      // Add backup timestamp
      await backupSheet.addRow({
        'Type': 'backup_info',
        'Data': `System backup created at ${new Date().toISOString()}`,
        'Timestamp': new Date().toISOString()
      });

      console.log(`✅ Created backup sheet: Backup_${timestamp}`);

    } catch (error) {
      console.error('❌ Failed to create backup:', (error as Error).message);
    }
  }

  getConnectionStatus(): { connected: boolean; sheetTitle?: string; lastSync?: string } {
    return {
      connected: this.isEnabled && !!this.doc,
      sheetTitle: this.doc?.title,
      lastSync: new Date().toISOString()
    };
  }
}