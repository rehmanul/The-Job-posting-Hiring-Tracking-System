import type { Company, InsertNewHire, InsertJobPosting } from '@shared/schema';
import { storage } from '../storage';

export class LinkedInProfessionalAPI {
  private accessToken: string;
  private baseUrl = 'https://api.linkedin.com/rest';

  constructor() {
    this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || '';
  }

  // HIRE TRACKING - Marketing Developer Platform
  async trackCompanyHires(company: Company): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    
    // 1. Get company posts for hire announcements
    const posts = await this.getCompanyPosts(company);
    const postHires = this.extractHiresFromPosts(posts, company);
    hires.push(...postHires);
    
    // 2. Get real-time notifications
    const notifications = await this.getOrganizationNotifications(company);
    const notificationHires = this.extractHiresFromNotifications(notifications, company);
    hires.push(...notificationHires);
    
    // 3. Get organization member changes
    const memberChanges = await this.getOrganizationMemberChanges(company);
    const memberHires = this.extractHiresFromMemberChanges(memberChanges, company);
    hires.push(...memberHires);
    
    return this.deduplicateHires(hires);
  }

  // JOB TRACKING - Talent Solutions API
  async trackCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const jobs: InsertJobPosting[] = [];
    
    // 1. Get job postings by company
    const jobPostings = await this.getJobPostingsByCompany(company);
    jobs.push(...jobPostings);
    
    // 2. Search jobs by company name
    const searchJobs = await this.searchJobsByCompany(company);
    jobs.push(...searchJobs);
    
    return this.deduplicateJobs(jobs);
  }

  // Marketing Developer Platform - UGC Posts
  private async getCompanyPosts(company: Company): Promise<any[]> {
    const orgId = this.extractOrgId(company.linkedinUrl);
    if (!orgId) return [];

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

  // Marketing Developer Platform - Real-time Notifications
  private async getOrganizationNotifications(company: Company): Promise<any[]> {
    const orgId = this.extractOrgId(company.linkedinUrl);
    if (!orgId) return [];

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

  // People API - Organization Member Changes
  private async getOrganizationMemberChanges(company: Company): Promise<any[]> {
    const orgId = this.extractOrgId(company.linkedinUrl);
    if (!orgId) return [];

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
  private async getJobPostingsByCompany(company: Company): Promise<InsertJobPosting[]> {
    const orgId = this.extractOrgId(company.linkedinUrl);
    if (!orgId) return [];

    const url = `${this.baseUrl}/jobPostings`;
    const params = new URLSearchParams({
      q: 'criteria',
      companyId: orgId,
      count: '50'
    });

    const response = await this.makeRequest(`${url}?${params}`);
    const jobs = response.elements || [];
    
    return jobs.map((job: any) => ({
      jobTitle: job.title,
      company: company.name,
      location: job.location?.displayName || 'Not specified',
      jobType: job.employmentType || 'Full-time',
      description: job.description || '',
      requirements: job.qualifications || '',
      salary: job.compensation?.baseSalary || null,
      postedDate: new Date(job.listedAt),
      applicationUrl: job.applyMethod?.companyApplyUrl || '',
      source: 'linkedin_api'
    }));
  }

  // Talent Solutions API - Job Search
  private async searchJobsByCompany(company: Company): Promise<InsertJobPosting[]> {
    const url = `${this.baseUrl}/jobs`;
    const params = new URLSearchParams({
      q: 'byCompany',
      company: company.name,
      count: '25'
    });

    const response = await this.makeRequest(`${url}?${params}`);
    const jobs = response.elements || [];
    
    return jobs.map((job: any) => ({
      jobTitle: job.title,
      company: company.name,
      location: job.formattedLocation || 'Not specified',
      jobType: job.workplaceTypes?.[0] || 'Full-time',
      description: job.description?.text || '',
      requirements: '',
      salary: null,
      postedDate: new Date(job.listedAt),
      applicationUrl: job.dashEntityUrn || '',
      source: 'linkedin_jobs_api'
    }));
  }

  // Extract hires from UGC posts
  private extractHiresFromPosts(posts: any[], company: Company): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    
    for (const post of posts) {
      const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
      const hire = this.extractHireFromText(text, company, 'linkedin_posts');
      if (hire) hires.push(hire);
    }
    
    return hires;
  }

  // Extract hires from notifications
  private extractHiresFromNotifications(notifications: any[], company: Company): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    
    for (const notification of notifications) {
      const text = notification.decoratedSourcePost?.text || '';
      const hire = this.extractHireFromText(text, company, 'linkedin_notifications');
      if (hire) hires.push(hire);
    }
    
    return hires;
  }

  // Extract hires from member changes
  private extractHiresFromMemberChanges(changes: any[], company: Company): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    
    for (const change of changes) {
      if (change.role && change.roleAssignee) {
        const personId = change.roleAssignee.replace('urn:li:person:', '');
        const position = change.role.displayName || 'New Position';
        
        // Get person details
        this.getPersonDetails(personId).then(person => {
          if (person) {
            hires.push({
              personName: `${person.firstName} ${person.lastName}`,
              company: company.name,
              position,
              source: 'linkedin_member_changes',
              confidenceScore: '90',
              foundDate: new Date()
            });
          }
        });
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

    try {
      const response = await this.makeRequest(`${url}?${params}`);
      return response;
    } catch (error) {
      return null;
    }
  }

  // Extract hire from text using professional patterns
  private extractHireFromText(text: string, company: Company, source: string): InsertNewHire | null {
    const patterns = [
      /(?:welcome|pleased to announce)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:has\s+)?joined\s+(?:us|our team)\s+as\s+([\w\s]+)/i,
      /excited\s+to\s+have\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+as\s+(?:our\s+new\s+)?([\w\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && this.validateHire(match[1], match[2])) {
        return {
          personName: match[1].trim(),
          company: company.name,
          position: match[2].trim(),
          source,
          confidenceScore: '95',
          foundDate: new Date()
        };
      }
    }

    return null;
  }

  // Validate hire data
  private validateHire(name: string, position: string): boolean {
    if (!name || !position) return false;
    if (name.split(' ').length < 2) return false;
    
    const invalidTerms = ['basketball', 'football', 'sports', 'star', 'player'];
    return !invalidTerms.some(term => name.toLowerCase().includes(term));
  }

  // Deduplicate hires
  private deduplicateHires(hires: InsertNewHire[]): InsertNewHire[] {
    const seen = new Set();
    return hires.filter(hire => {
      const key = `${hire.personName}-${hire.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Deduplicate jobs
  private deduplicateJobs(jobs: InsertJobPosting[]): InsertJobPosting[] {
    const seen = new Set();
    return jobs.filter(job => {
      const key = `${job.jobTitle}-${job.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Extract organization ID from LinkedIn URL
  private extractOrgId(linkedinUrl?: string): string | null {
    if (!linkedinUrl) return null;
    const match = linkedinUrl.match(/company\/(\d+)/);
    return match ? match[1] : null;
  }

  // Make authenticated request
  private async makeRequest(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`);
    }

    return response.json();
  }
}