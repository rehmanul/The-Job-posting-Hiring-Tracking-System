import axios from 'axios';
import type { InsertNewHire } from '@shared/schema';

export class LinkedInHireAPI {
  private accessToken: string;
  private baseURL = 'https://api.linkedin.com/v2';

  constructor() {
    this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || '';
  }

  async initialize(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('LinkedIn access token required');
    }
    console.log('✅ LinkedIn Hire API initialized');
  }

  async getCompanyHires(companyId: string, companyName: string): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];

    try {
      // Method 1: Company Updates/Posts
      const posts = await this.getCompanyPosts(companyId);
      hires.push(...this.extractHiresFromPosts(posts, companyName));

      // Method 2: Employee Changes
      const employees = await this.getCompanyEmployees(companyId);
      hires.push(...this.extractNewHires(employees, companyName));

      console.log(`🎯 LinkedIn API found ${hires.length} hires for ${companyName}`);
      return this.deduplicateHires(hires);

    } catch (error) {
      console.error(`❌ LinkedIn API error for ${companyName}:`, error);
      return [];
    }
  }

  private async getCompanyPosts(companyId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseURL}/shares`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
        params: {
          q: 'owners',
          owners: `urn:li:organization:${companyId}`,
          count: 50,
          sortBy: 'CREATED_TIME'
        }
      });

      return response.data.elements || [];
    } catch (error) {
      console.error('Error fetching company posts:', error);
      return [];
    }
  }

  private async getCompanyEmployees(companyId: string): Promise<any[]> {
    try {
      // Use People Search API to find recent employees
      const response = await axios.get(`${this.baseURL}/people`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
        params: {
          q: 'companyId',
          companyId: companyId,
          count: 100,
          start: 0
        }
      });

      return response.data.elements || [];
    } catch (error) {
      console.error('Error fetching company employees:', error);
      return [];
    }
  }

  private extractHiresFromPosts(posts: any[], companyName: string): InsertNewHire[] {
    const hires: InsertNewHire[] = [];

    for (const post of posts) {
      try {
        const text = post.text?.text || '';
        
        // Enhanced hire detection patterns
        const hirePatterns = [
          /(?:welcome|welcoming|excited to welcome|pleased to announce|thrilled to share)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:as|to)(?:\s+our)?(?:\s+new)?\s+([A-Z][a-zA-Z\s&-]+?)(?:\s+at|\s+to|\.|!|$)/gi,
          /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has\s+)?joined\s+(?:us\s+)?(?:as\s+)?(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+?)(?:\s+at|\.|!|$)/gi,
          /(?:announcing|excited to announce)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+?)(?:\s+at|\.|!|$)/gi
        ];

        for (const pattern of hirePatterns) {
          const matches = [...text.matchAll(pattern)];
          
          for (const match of matches) {
            const name = match[1]?.trim();
            const position = match[2]?.trim();
            
            if (this.isValidHire(name, position)) {
              hires.push({
                personName: name,
                company: companyName,
                position: this.cleanPosition(position),
                startDate: null,
                source: 'LinkedIn API Posts',
                confidenceScore: '95'
              });
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    return hires;
  }

  private extractNewHires(employees: any[], companyName: string): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    const recentThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

    for (const employee of employees) {
      try {
        // Check if employee started recently
        const positions = employee.positions?.values || [];
        
        for (const position of positions) {
          if (position.company?.name === companyName) {
            const startDate = position.startDate;
            
            if (startDate && new Date(startDate) >= recentThreshold) {
              const name = `${employee.firstName} ${employee.lastName}`;
              
              if (this.isValidHire(name, position.title)) {
                hires.push({
                  personName: name,
                  company: companyName,
                  position: position.title,
                  startDate: new Date(startDate),
                  linkedinProfile: employee.publicProfileUrl,
                  source: 'LinkedIn API Employees',
                  confidenceScore: '90'
                });
              }
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    return hires;
  }

  private isValidHire(name: string, position: string): boolean {
    if (!name || !position) return false;

    // Validate name
    const nameWords = name.split(' ');
    if (nameWords.length < 2 || nameWords.length > 3) return false;
    if (!nameWords.every(word => /^[A-Z][a-z]{1,}$/.test(word))) return false;

    // Validate position - focus on executive/senior roles
    const executiveKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'chief', 'director', 'manager', 'head', 
      'vice president', 'vp', 'president', 'senior', 'lead', 'officer', 
      'executive', 'principal', 'associate'
    ];
    
    const posLower = position.toLowerCase();
    return executiveKeywords.some(keyword => posLower.includes(keyword)) && 
           posLower.length >= 3 && 
           posLower.length <= 60;
  }

  private cleanPosition(position: string): string {
    return position
      .replace(/^(our|the|a)\s+/i, '')
      .replace(/\s+(team|department|at).*$/i, '')
      .trim() || 'Executive';
  }

  private deduplicateHires(hires: InsertNewHire[]): InsertNewHire[] {
    const seen = new Set();
    return hires.filter(hire => {
      const key = `${hire.personName.toLowerCase()}-${hire.company.toLowerCase()}-${hire.position.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async searchCompanyByName(companyName: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.baseURL}/companies`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
        params: {
          q: 'name',
          name: companyName,
          count: 1
        }
      });

      const companies = response.data.elements || [];
      return companies.length > 0 ? companies[0].id : null;
    } catch (error) {
      console.error(`Error searching for company ${companyName}:`, error);
      return null;
    }
  }
}