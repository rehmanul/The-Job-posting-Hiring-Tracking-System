import type { Company, InsertNewHire, InsertJobPosting } from '@shared/schema';
import { storage } from '../storage';

export class LinkedInOnlyTracker {
  private accessToken: string;
  private baseUrl = 'https://api.linkedin.com/rest';

  constructor() {
    this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || '';
    if (!this.accessToken) {
      throw new Error('LinkedIn access token required');
    }
  }

  async trackCompanyHires(company: Company): Promise<InsertNewHire[]> {
    const logMessage = `🎯 LinkedIn-only hire tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'linkedin_tracker', logMessage);

    const hires: InsertNewHire[] = [];
    const orgId = this.extractOrgId(company.linkedinUrl);
    
    if (!orgId) {
      console.warn(`⚠️ No LinkedIn URL for ${company.name}`);
      return [];
    }

    try {
      // 1. UGC Posts - Company announcements
      const posts = await this.getUGCPosts(orgId);
      const postHires = this.extractHiresFromPosts(posts, company);
      hires.push(...postHires);

      // 2. Organization Notifications - Real-time updates
      const notifications = await this.getOrganizationNotifications(orgId);
      const notificationHires = this.extractHiresFromNotifications(notifications, company);
      hires.push(...notificationHires);

      // 3. Organization ACLs - Member changes
      const memberChanges = await this.getOrganizationACLs(orgId);
      const memberHires = await this.extractHiresFromMemberChanges(memberChanges, company);
      hires.push(...memberHires);

      const uniqueHires = this.deduplicateHires(hires);
      const resultMessage = `✅ LinkedIn API found ${uniqueHires.length} hires for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'linkedin_tracker', resultMessage);

      return uniqueHires;

    } catch (error) {
      const errorMessage = `❌ LinkedIn API error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'linkedin_tracker', errorMessage);
      return [];
    }
  }

  async trackCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const logMessage = `🔍 LinkedIn-only job tracking for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'linkedin_tracker', logMessage);

    const jobs: InsertJobPosting[] = [];
    const orgId = this.extractOrgId(company.linkedinUrl);
    
    if (!orgId) {
      console.warn(`⚠️ No LinkedIn URL for ${company.name}`);
      return [];
    }

    try {
      // 1. Job Postings API - Direct job data
      const jobPostings = await this.getJobPostings(orgId);
      jobs.push(...jobPostings);

      // 2. Jobs Search API - Additional job search
      const searchJobs = await this.searchJobs(company.name);
      jobs.push(...searchJobs);

      const uniqueJobs = this.deduplicateJobs(jobs);
      const resultMessage = `✅ LinkedIn API found ${uniqueJobs.length} jobs for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'linkedin_tracker', resultMessage);

      return uniqueJobs;

    } catch (error) {
      const errorMessage = `❌ LinkedIn job API error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'linkedin_tracker', errorMessage);
      return [];
    }
  }

  // Marketing Developer Platform - UGC Posts
  private async getUGCPosts(orgId: string): Promise<any[]> {
    const url = `${this.baseUrl}/ugcPosts`;
    const params = new URLSearchParams({
      q: 'authors',
      authors: `List(urn:li:organization:${orgId})`,
      sortBy: 'LAST_MODIFIED',
      count: '50'
    });

    const response = await this.makeRequest(`${url}?${params}`);
    return response.elements || [];
  }

  // Marketing Developer Platform - Organization Notifications
  private async getOrganizationNotifications(orgId: string): Promise<any[]> {
    const url = `${this.baseUrl}/organizationalEntityNotifications`;
    const params = new URLSearchParams({
      q: 'criteria',
      organizationalEntity: `urn:li:organization:${orgId}`,
      actions: 'List(SHARE,ADMIN_COMMENT)',
      count: '50'
    });

    const response = await this.makeRequest(`${url}?${params}`);
    return response.elements || [];
  }

  // People API - Organization ACLs
  private async getOrganizationACLs(orgId: string): Promise<any[]> {
    const url = `${this.baseUrl}/organizationAcls`;
    const params = new URLSearchParams({
      q: 'roleAssignee',
      organizationalTarget: `urn:li:organization:${orgId}`,
      count: '50'
    });

    const response = await this.makeRequest(`${url}?${params}`);
    return response.elements || [];
  }

  // Talent Solutions API - Job Postings
  private async getJobPostings(orgId: string): Promise<InsertJobPosting[]> {
    const url = `${this.baseUrl}/jobPostings`;
    const params = new URLSearchParams({
      q: 'criteria',
      companyId: orgId,
      count: '50'
    });

    const response = await this.makeRequest(`${url}?${params}`);
    const jobs = response.elements || [];
    
    return jobs.map((job: any) => ({
      jobTitle: job.title || 'Untitled Position',
      company: job.companyDetails?.displayName || 'Unknown Company',
      location: job.location?.displayName || 'Not specified',
      jobType: job.employmentType || 'Full-time',
      description: job.description || '',
      requirements: job.qualifications || '',
      salary: job.compensation?.baseSalary || null,
      postedDate: job.listedAt ? new Date(job.listedAt) : new Date(),
      applicationUrl: job.applyMethod?.companyApplyUrl || '',
      source: 'linkedin_job_api',
      foundDate: new Date()
    }));
  }

  // Talent Solutions API - Jobs Search
  private async searchJobs(companyName: string): Promise<InsertJobPosting[]> {
    const url = `${this.baseUrl}/jobs`;
    const params = new URLSearchParams({
      q: 'byCompany',
      company: companyName,
      count: '25'
    });

    const response = await this.makeRequest(`${url}?${params}`);
    const jobs = response.elements || [];
    
    return jobs.map((job: any) => ({
      jobTitle: job.title || 'Untitled Position',
      company: companyName,
      location: job.formattedLocation || 'Not specified',
      jobType: job.workplaceTypes?.[0] || 'Full-time',
      description: job.description?.text || '',
      requirements: '',
      salary: null,
      postedDate: job.listedAt ? new Date(job.listedAt) : new Date(),
      applicationUrl: job.dashEntityUrn || '',
      source: 'linkedin_search_api',
      foundDate: new Date()
    }));
  }

  // Extract hires from UGC posts
  private extractHiresFromPosts(posts: any[], company: Company): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    
    for (const post of posts) {
      const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
      if (text) {
        const hire = this.extractHireFromText(text, company, 'linkedin_posts');
        if (hire) hires.push(hire);
      }
    }
    
    return hires;
  }

  // Extract hires from notifications
  private extractHiresFromNotifications(notifications: any[], company: Company): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    
    for (const notification of notifications) {
      const text = notification.decoratedSourcePost?.text || 
                   notification.decoratedGeneratedActivity?.share?.text || '';
      if (text) {
        const hire = this.extractHireFromText(text, company, 'linkedin_notifications');
        if (hire) hires.push(hire);
      }
    }
    
    return hires;
  }

  // Extract hires from member changes
  private async extractHiresFromMemberChanges(changes: any[], company: Company): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    
    for (const change of changes) {
      if (change.role && change.roleAssignee) {
        const personId = change.roleAssignee.replace('urn:li:person:', '');
        const position = change.role.displayName || 'New Position';
        
        try {
          const person = await this.getPersonDetails(personId);
          if (person && this.validateHire(person.firstName + ' ' + person.lastName, position)) {
            hires.push({
              personName: `${person.firstName} ${person.lastName}`,
              company: company.name,
              position,
              source: 'linkedin_member_changes',
              confidenceScore: '92',
              foundDate: new Date(),
              linkedinProfile: `https://linkedin.com/in/${personId}`,
              verified: true
            });
          }
        } catch (error) {
          console.warn(`Failed to get person details for ${personId}`);
        }
      }
    }
    
    return hires;
  }

  // People API - Get person details
  private async getPersonDetails(personId: string): Promise<any> {
    const url = `${this.baseUrl}/people/${personId}`;
    const params = new URLSearchParams({
      projection: '(firstName,lastName,headline)'
    });

    const response = await this.makeRequest(`${url}?${params}`);
    return response;
  }

  // Professional hire extraction patterns
  private extractHireFromText(text: string, company: Company, source: string): InsertNewHire | null {
    const patterns = [
      // Executive appointments
      /(?:pleased|excited|proud)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+as\s+(?:our\s+new\s+)?(CEO|CTO|CFO|COO|VP|President|Director|Head\s+of\s+[\w\s]+)/i,
      
      // Team joins
      /(?:welcome|introducing)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:to\s+(?:our\s+)?team|who\s+(?:has\s+)?joined\s+us)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i,
      
      // New hire announcements
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has\s+)?joined\s+(?:us|our\s+team|the\s+company)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i,
      
      // Appointment announcements
      /(?:thrilled|delighted|happy)\s+to\s+announce\s+(?:that\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has\s+been\s+)?(?:appointed|named)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const personName = this.cleanPersonName(match[1]);
        const position = this.cleanPosition(match[2]);
        
        if (this.validateHire(personName, position)) {
          return {
            personName,
            company: company.name,
            position,
            source,
            confidenceScore: this.calculateConfidenceScore(text, personName, position),
            foundDate: new Date(),
            verified: false
          };
        }
      }
    }

    return null;
  }

  // Professional validation
  private validateHire(name: string, position: string): boolean {
    if (!name || !position) return false;
    if (name.split(' ').length < 2) return false;
    
    // Reject sports/garbage terms
    const invalidTerms = [
      'basketball', 'football', 'sports', 'star', 'player', 'striker',
      'midfielder', 'defender', 'goalkeeper', 'tennis', 'soccer',
      'wrexham', 'evolution', 'tennessee', 'eagles', 'content', 'market'
    ];
    
    const lowerName = name.toLowerCase();
    if (invalidTerms.some(term => lowerName.includes(term))) {
      return false;
    }

    // Must be business position
    const businessKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'director', 'manager', 'head',
      'vice president', 'vp', 'president', 'senior', 'lead', 'officer',
      'executive', 'principal', 'analyst', 'specialist', 'coordinator'
    ];
    
    const posLower = position.toLowerCase();
    return businessKeywords.some(keyword => posLower.includes(keyword));
  }

  private calculateConfidenceScore(text: string, personName: string, position: string): string {
    let score = 70; // Base score for LinkedIn API

    // Executive positions
    if (/CEO|CTO|CFO|COO|VP|President|Director|Head\s+of/i.test(position)) {
      score += 15;
    }

    // Professional language
    if (/pleased|excited|thrilled|proud|delighted/i.test(text)) {
      score += 10;
    }

    // Full name
    if (personName.split(' ').length >= 2) {
      score += 5;
    }

    return Math.min(score, 97).toString();
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

  private cleanPosition(position: string): string {
    return position
      .replace(/[^a-zA-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^(our|the|a|as)\s+/i, '')
      .trim();
  }

  private deduplicateHires(hires: InsertNewHire[]): InsertNewHire[] {
    const seen = new Map<string, InsertNewHire>();
    
    for (const hire of hires) {
      const key = `${hire.personName.toLowerCase()}-${hire.company.toLowerCase()}`;
      
      if (!seen.has(key) || (seen.get(key)!.confidenceScore < hire.confidenceScore)) {
        seen.set(key, hire);
      }
    }
    
    return Array.from(seen.values());
  }

  private deduplicateJobs(jobs: InsertJobPosting[]): InsertJobPosting[] {
    const seen = new Set<string>();
    return jobs.filter(job => {
      const key = `${job.jobTitle.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private extractOrgId(linkedinUrl?: string): string | null {
    if (!linkedinUrl) return null;
    const match = linkedinUrl.match(/company\/(\d+)/);
    return match ? match[1] : null;
  }

  private async makeRequest(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status} - ${await response.text()}`);
    }

    return response.json();
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