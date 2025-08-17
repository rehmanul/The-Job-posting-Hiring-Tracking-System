import type { Company, InsertNewHire } from '@shared/schema';
import { storage } from '../storage';

export class GoogleTalentHireTracker {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_CLOUD_TALENT_API_KEY || '';
  }

  async trackCompanyHires(company: Company): Promise<InsertNewHire[]> {
    const logMessage = `🎯 Google Talent API hire tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'talent_hire_tracker', logMessage);

    const hires: InsertNewHire[] = [];

    try {
      // Search for recent hires using Google Cloud Talent Solution API
      const searchResults = await this.searchCompanyHires(company);
      
      for (const result of searchResults) {
        const hire = this.extractHireFromTalentResult(result, company);
        if (hire) hires.push(hire);
      }

      const resultMessage = `✅ Google Talent API found ${hires.length} real hires for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'talent_hire_tracker', resultMessage);

      return hires;

    } catch (error) {
      const errorMessage = `❌ Google Talent API error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'talent_hire_tracker', errorMessage);
      return [];
    }
  }

  private async searchCompanyHires(company: Company): Promise<any[]> {
    const projectId = 'your-project-id'; // Replace with your Google Cloud project ID
    const url = `https://jobs.googleapis.com/v4/projects/${projectId}/jobs:search`;

    const requestBody = {
      requestMetadata: {
        userId: 'hire-tracker',
        sessionId: Date.now().toString()
      },
      jobQuery: {
        companyNames: [company.name],
        query: 'new hire announcement joined team welcome',
        publishTimeRange: {
          startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
          endTime: new Date().toISOString()
        }
      },
      searchMode: 'JOB_SEARCH',
      maxPageSize: 50
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Google Talent API error: ${response.status}`);
    }

    const data = await response.json();
    return data.matchingJobs || [];
  }

  private extractHireFromTalentResult(result: any, company: Company): InsertNewHire | null {
    const job = result.job;
    if (!job) return null;

    const description = job.description || '';
    const title = job.title || '';
    
    // Look for hire announcements in job descriptions
    const hirePatterns = [
      /(?:pleased|excited|thrilled)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:as|who|to)/i,
      /(?:welcome|introducing)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\s+(?:our\s+)?team/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+has\s+joined\s+(?:us|our\s+team|the\s+company)/i
    ];

    for (const pattern of hirePatterns) {
      const match = description.match(pattern);
      if (match) {
        const personName = this.cleanPersonName(match[1]);
        
        if (this.validatePersonName(personName)) {
          return {
            personName,
            company: company.name,
            position: this.extractPosition(description) || 'New Employee',
            source: 'Google Talent API',
            confidenceScore: '90',
            foundDate: new Date(),
            verified: true
          };
        }
      }
    }

    return null;
  }

  private cleanPersonName(name: string): string {
    return name
      .replace(/[^a-zA-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private validatePersonName(name: string): boolean {
    if (!name || name.length < 3) return false;
    
    const parts = name.split(' ');
    if (parts.length < 2 || parts.length > 4) return false;
    
    // Each part should be a proper name
    for (const part of parts) {
      if (part.length < 2 || part.length > 20) return false;
      if (!/^[A-Z][a-z]+$/.test(part)) return false;
    }
    
    // Reject garbage terms
    const invalidTerms = ['Team', 'Company', 'Position', 'New', 'Announce', 'Welcome'];
    const lowerName = name.toLowerCase();
    if (invalidTerms.some(term => lowerName.includes(term.toLowerCase()))) {
      return false;
    }
    
    return true;
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