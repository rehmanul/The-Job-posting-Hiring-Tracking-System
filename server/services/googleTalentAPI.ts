import { GoogleAuth } from 'google-auth-library';
import type { Company, InsertNewHire, InsertJobPosting } from '@shared/schema';
import { storage } from '../storage';

export class GoogleTalentAPIService {
  private auth: GoogleAuth;
  private projectId: string;
  private tenantId: string;
  private baseUrl = 'https://jobs.googleapis.com/v4';

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'dwg-analyzer-464720';
    this.tenantId = process.env.GOOGLE_TALENT_TENANT_ID || 'default';
    
    this.auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/jobs']
    });
  }

  async trackCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const logMessage = `🔍 Google Talent API job tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'google_talent_api', logMessage);

    try {
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();
      
      // Search for jobs by company name
      const searchUrl = `${this.baseUrl}/projects/${this.projectId}/tenants/${this.tenantId}/jobs:search`;
      
      const searchBody = {
        requestMetadata: {
          userId: 'jobtracker-system',
          sessionId: Date.now().toString(),
          domain: 'jobtracker.com'
        },
        jobQuery: {
          query: company.name,
          companyNames: [company.name],
          locationFilters: []
        },
        searchMode: 'JOB_SEARCH',
        pageSize: 50
      };

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchBody)
      });

      if (!response.ok) {
        throw new Error(`Google Talent API error: ${response.status}`);
      }

      const data = await response.json();
      const jobs = data.matchingJobs || [];
      
      const jobPostings: InsertJobPosting[] = jobs.map((item: any) => {
        const job = item.job;
        return {
          jobTitle: job.title || 'Untitled Position',
          company: company.name,
          location: job.addresses?.[0] || 'Not specified',
          jobType: job.employmentTypes?.[0] || 'FULL_TIME',
          description: job.description || '',
          requirements: job.qualifications || '',
          salary: job.compensationInfo?.entries?.[0]?.amount?.currencyCode ? 
            `${job.compensationInfo.entries[0].amount.currencyCode} ${job.compensationInfo.entries[0].amount.units}` : null,
          postedDate: job.postingCreateTime ? new Date(job.postingCreateTime) : new Date(),
          applicationUrl: job.applicationInfo?.uris?.[0] || '',
          source: 'google_talent_api',
          foundDate: new Date()
        };
      });

      const resultMessage = `✅ Google Talent API found ${jobPostings.length} jobs for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'google_talent_api', resultMessage);

      return jobPostings;

    } catch (error) {
      const errorMessage = `❌ Google Talent API error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'google_talent_api', errorMessage);
      return [];
    }
  }

  async trackCompanyHires(company: Company): Promise<InsertNewHire[]> {
    const logMessage = `👥 Google Talent API hire tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'google_talent_api', logMessage);

    try {
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();
      
      // Search for HIRED events
      const eventsUrl = `${this.baseUrl}/projects/${this.projectId}/tenants/${this.tenantId}/clientEvents`;
      
      const eventBody = {
        eventType: 'HIRED',
        requestId: Date.now().toString(),
        eventId: `hire-search-${company.name}-${Date.now()}`,
        eventTimestampMillis: Date.now().toString(),
        relatedJobNames: [],
        details: {
          companyName: company.name,
          searchType: 'hire_tracking'
        }
      };

      // Note: This creates an event to track hires, but Google Talent API 
      // doesn't directly provide hire data - it's for job platforms
      // We'll use web search as fallback
      const hires = await this.searchWebForHires(company);
      
      const resultMessage = `✅ Google search found ${hires.length} potential hires for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'google_talent_api', resultMessage);

      return hires;

    } catch (error) {
      const errorMessage = `❌ Google Talent hire tracking error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'google_talent_api', errorMessage);
      return [];
    }
  }

  private async searchWebForHires(company: Company): Promise<InsertNewHire[]> {
    if (!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || !process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
      return [];
    }

    try {
      const searchQuery = `"${company.name}" "joined" OR "hired" OR "welcome" OR "new employee" site:linkedin.com OR site:twitter.com`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_CUSTOM_SEARCH_API_KEY}&cx=${process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}&num=10`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      const hires: InsertNewHire[] = [];
      
      if (data.items) {
        for (const item of data.items) {
          const hire = this.extractHireFromSearchResult(item, company);
          if (hire) hires.push(hire);
        }
      }
      
      return hires;
    } catch (error) {
      console.error('Web search for hires failed:', error);
      return [];
    }
  }

  private extractHireFromSearchResult(item: any, company: Company): InsertNewHire | null {
    const text = `${item.title} ${item.snippet}`;
    
    // Professional hire patterns
    const patterns = [
      /(?:welcome|pleased to announce|excited to welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:to|as|who)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has\s+)?joined\s+(?:us|our team|the company)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has been|was)\s+(?:hired|appointed|named)\s+as/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = match[1].trim();
        
        if (this.validateHireName(personName)) {
          return {
            personName,
            company: company.name,
            position: this.extractPosition(text) || 'New Employee',
            source: 'google_search',
            confidenceScore: '85',
            foundDate: new Date(),
            verified: false
          };
        }
      }
    }

    return null;
  }

  private validateHireName(name: string): boolean {
    if (!name || name.split(' ').length < 2) return false;
    
    const invalidTerms = ['basketball', 'football', 'sports', 'star', 'player'];
    return !invalidTerms.some(term => name.toLowerCase().includes(term));
  }

  private extractPosition(text: string): string | null {
    const positionMatch = text.match(/as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,|$)/i);
    return positionMatch ? positionMatch[1].trim() : null;
  }

  private async logToDatabase(level: string, service: string, message: string): Promise<void> {
    try {
      await storage.createSystemLog({
        level,
        service,
        message,
        metadata: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      // Ignore database logging errors
    }
  }
}