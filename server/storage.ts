import { 
  type Company, type InsertCompany,
  type JobPosting, type InsertJobPosting, 
  type NewHire, type InsertNewHire,
  type Analytics, type InsertAnalytics,
  type HealthMetric, type InsertHealthMetric,
  type SystemLog, type InsertSystemLog,
  type LinkedInToken, type InsertLinkedInToken
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  addCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
  clearSampleCompanies(): Promise<void>;
  syncCompaniesFromGoogleSheets(companiesData: any[]): Promise<void>;

  // Job Postings
  getJobPostings(limit?: number): Promise<JobPosting[]>;
  getJobPosting(id: string): Promise<JobPosting | undefined>;
  createJobPosting(job: InsertJobPosting): Promise<JobPosting>;
  updateJobPosting(id: string, updates: Partial<InsertJobPosting>): Promise<JobPosting | undefined>;
  getNewJobPostings(): Promise<JobPosting[]>;
  markJobPostingsAsNotified(ids: string[]): Promise<void>;

  // New Hires
  getNewHires(limit?: number): Promise<NewHire[]>;
  getNewHire(id: string): Promise<NewHire | undefined>;
  createNewHire(hire: InsertNewHire): Promise<NewHire>;
  updateNewHire(id: string, updates: Partial<InsertNewHire>): Promise<NewHire | undefined>;
  getNewNewHires(): Promise<NewHire[]>;
  markNewHiresAsNotified(ids: string[]): Promise<void>;

  // Analytics
  getAnalytics(days?: number): Promise<Analytics[]>;
  createAnalytics(analytics: InsertAnalytics): Promise<Analytics>;
  getLatestAnalytics(): Promise<Analytics | undefined>;

  // Health Metrics
  getHealthMetrics(service?: string, hours?: number): Promise<HealthMetric[]>;
  createHealthMetric(metric: InsertHealthMetric): Promise<HealthMetric>;

  // System Logs
  getSystemLogs(service?: string, level?: string, limit?: number): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;

  // LinkedIn Tokens
  storeLinkedInToken(token: InsertLinkedInToken): Promise<LinkedInToken>;
  getActiveLinkedInToken(): Promise<LinkedInToken | null>;
}

export class MemStorage implements IStorage {
  private companies: Map<string, Company> = new Map();
  private jobPostings: Map<string, JobPosting> = new Map();
  private newHires: Map<string, NewHire> = new Map();
  private analytics: Map<string, Analytics> = new Map();
  private healthMetrics: Map<string, HealthMetric> = new Map();
  private systemLogs: Map<string, SystemLog> = new Map();
  private linkedinTokens: Map<string, LinkedInToken> = new Map();

  constructor() {
    // Production storage - no sample data
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = randomUUID();
    const company: Company = { 
      id,
      name: insertCompany.name,
      website: insertCompany.website ?? null,
      linkedinUrl: insertCompany.linkedinUrl ?? null,
      careerPageUrl: insertCompany.careerPageUrl ?? null,
      isActive: insertCompany.isActive ?? true,
      createdAt: new Date(),
      lastScanned: null,
    };
    this.companies.set(id, company);
    return company;
  }

  async addCompany(insertCompany: InsertCompany): Promise<Company> {
    return this.createCompany(insertCompany);
  }

  async updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;

    const updatedCompany = { ...company, ...updates };
    this.companies.set(id, updatedCompany);
    return updatedCompany;
  }

  async deleteCompany(id: string): Promise<boolean> {
    return this.companies.delete(id);
  }

  async clearSampleCompanies(): Promise<void> {
    this.companies.clear();
    console.log('✅ Cleared all sample companies');
  }

  async syncCompaniesFromGoogleSheets(companiesData: any[]): Promise<void> {
    try {
      if (!companiesData || companiesData.length === 0) {
        console.warn('⚠️ No companies data provided for sync');
        return;
      }

      for (const companyData of companiesData) {
        await this.createCompany({
          name: companyData.name || '',
          website: companyData.website || '',
          linkedinUrl: companyData.linkedinUrl || '',
          careerPageUrl: companyData.careerPageUrl || '',
          isActive: companyData.isActive !== false,
        });
      }

      console.log(`✅ Synced ${companiesData.length} companies from Google Sheets`);
    } catch (error: any) {
      console.error('❌ Failed to sync companies from Google Sheets:', error);
    }
  }

  // Job Postings
  async getJobPostings(limit?: number): Promise<JobPosting[]> {
    const jobs = Array.from(this.jobPostings.values())
      .sort((a, b) => (b.foundDate?.getTime() || 0) - (a.foundDate?.getTime() || 0));
    return limit ? jobs.slice(0, limit) : jobs;
  }

  async getJobPosting(id: string): Promise<JobPosting | undefined> {
    return this.jobPostings.get(id);
  }

  async createJobPosting(insertJob: InsertJobPosting): Promise<JobPosting> {
    // Check for duplicates before creating
    const existingJobs = Array.from(this.jobPostings.values());
    const isDuplicate = existingJobs.some(existing => 
      existing.jobTitle.toLowerCase() === insertJob.jobTitle.toLowerCase() &&
      existing.company.toLowerCase() === insertJob.company.toLowerCase() &&
      (existing.location?.toLowerCase() || '') === (insertJob.location?.toLowerCase() || '')
    );
    
    if (isDuplicate) {
      console.log(`🚫 Blocked duplicate job: ${insertJob.jobTitle} at ${insertJob.company}`);
      throw new Error('Duplicate job detected');
    }
    
    const id = randomUUID();
    const job: JobPosting = { 
      id,
      company: insertJob.company,
      jobTitle: insertJob.jobTitle,
      location: insertJob.location ?? null,
      department: insertJob.department ?? null,
      postedDate: insertJob.postedDate ?? null,
      url: insertJob.url ?? null,
      confidenceScore: insertJob.confidenceScore ?? null,
      source: insertJob.source,
      foundDate: new Date(),
      isNew: true,
      notificationSent: false,
    };
    this.jobPostings.set(id, job);
    console.log(`✅ Created new job: ${job.jobTitle} at ${job.company}`);
    return job;
  }

  async updateJobPosting(id: string, updates: Partial<InsertJobPosting>): Promise<JobPosting | undefined> {
    const job = this.jobPostings.get(id);
    if (!job) return undefined;

    const updatedJob = { ...job, ...updates };
    this.jobPostings.set(id, updatedJob);
    return updatedJob;
  }

  async getNewJobPostings(): Promise<JobPosting[]> {
    return Array.from(this.jobPostings.values()).filter(job => job.isNew && !job.notificationSent);
  }

  async markJobPostingsAsNotified(ids: string[]): Promise<void> {
    ids.forEach(id => {
      const job = this.jobPostings.get(id);
      if (job) {
        this.jobPostings.set(id, { ...job, notificationSent: true });
      }
    });
  }

  // New Hires
  async getNewHires(limit?: number): Promise<NewHire[]> {
    const hires = Array.from(this.newHires.values())
      .sort((a, b) => (b.foundDate?.getTime() || 0) - (a.foundDate?.getTime() || 0));
    return limit ? hires.slice(0, limit) : hires;
  }

  async getNewHire(id: string): Promise<NewHire | undefined> {
    return this.newHires.get(id);
  }

  async createNewHire(insertHire: InsertNewHire): Promise<NewHire> {
    // Check for duplicates before creating
    const existingHires = Array.from(this.newHires.values());
    const isDuplicate = existingHires.some(existing => 
      existing.personName.toLowerCase() === insertHire.personName.toLowerCase() &&
      existing.company.toLowerCase() === insertHire.company.toLowerCase() &&
      existing.position.toLowerCase() === insertHire.position.toLowerCase()
    );
    
    if (isDuplicate) {
      console.log(`🚫 Blocked duplicate hire: ${insertHire.personName} at ${insertHire.company}`);
      throw new Error('Duplicate hire detected');
    }
    
    const id = randomUUID();
    const hire: NewHire = { 
      id,
      personName: insertHire.personName,
      company: insertHire.company,
      position: insertHire.position,
      startDate: insertHire.startDate ?? null,
      linkedinProfile: insertHire.linkedinProfile ?? null,
      source: insertHire.source,
      confidenceScore: insertHire.confidenceScore ?? null,
      foundDate: new Date(),
      isNew: true,
      notificationSent: false,
    };
    this.newHires.set(id, hire);
    console.log(`✅ Created new hire: ${hire.personName} as ${hire.position} at ${hire.company}`);
    return hire;
  }

  async updateNewHire(id: string, updates: Partial<InsertNewHire>): Promise<NewHire | undefined> {
    const hire = this.newHires.get(id);
    if (!hire) return undefined;

    const updatedHire = { ...hire, ...updates };
    this.newHires.set(id, updatedHire);
    return updatedHire;
  }

  async getNewNewHires(): Promise<NewHire[]>{
    return Array.from(this.newHires.values()).filter(hire => hire.isNew && !hire.notificationSent);
  }

  async markNewHiresAsNotified(ids: string[]): Promise<void> {
    ids.forEach(id => {
      const hire = this.newHires.get(id);
      if (hire) {
        this.newHires.set(id, { ...hire, notificationSent: true });
      }
    });
  }

  // Analytics
  async getAnalytics(days?: number): Promise<Analytics[]> {
    let analytics = Array.from(this.analytics.values())
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    if (days) {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      analytics = analytics.filter(a => (a.date?.getTime() || 0) >= cutoffDate.getTime());
    }

    return analytics;
  }

  async createAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    const id = randomUUID();
    const analytics: Analytics = { 
      id,
      date: new Date(),
      totalCompanies: insertAnalytics.totalCompanies ?? null,
      activeCompanies: insertAnalytics.activeCompanies ?? null,
      jobsFound: insertAnalytics.jobsFound ?? null,
      hiresFound: insertAnalytics.hiresFound ?? null,
      successfulScans: insertAnalytics.successfulScans ?? null,
      failedScans: insertAnalytics.failedScans ?? null,
      avgResponseTime: insertAnalytics.avgResponseTime ?? null,
      metadata: insertAnalytics.metadata ?? null,
    };
    this.analytics.set(id, analytics);
    return analytics;
  }

  async getLatestAnalytics(): Promise<Analytics | undefined> {
    const analytics = Array.from(this.analytics.values())
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    return analytics[0];
  }

  // Health Metrics
  async getHealthMetrics(service?: string, hours?: number): Promise<HealthMetric[]> {
    let metrics = Array.from(this.healthMetrics.values());

    if (service) {
      metrics = metrics.filter(m => m.service === service);
    }

    if (hours) {
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
      metrics = metrics.filter(m => (m.timestamp?.getTime() || 0) >= cutoffDate.getTime());
    }

    return metrics.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
  }

  async createHealthMetric(insertMetric: InsertHealthMetric): Promise<HealthMetric> {
    const id = randomUUID();
    const metric: HealthMetric = { 
      id,
      timestamp: new Date(),
      service: insertMetric.service,
      status: insertMetric.status,
      responseTime: insertMetric.responseTime ?? null,
      errorMessage: insertMetric.errorMessage ?? null,
      metadata: insertMetric.metadata ?? null,
    };
    this.healthMetrics.set(id, metric);
    return metric;
  }

  // System Logs
  async getSystemLogs(service?: string, level?: string, limit?: number): Promise<SystemLog[]> {
    let logs = Array.from(this.systemLogs.values());

    if (service) {
      logs = logs.filter(l => l.service === service);
    }

    if (level) {
      logs = logs.filter(l => l.level === level);
    }

    logs = logs.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));

    return limit ? logs.slice(0, limit) : logs;
  }

  async createSystemLog(insertLog: InsertSystemLog): Promise<SystemLog> {
    const id = randomUUID();
    const log: SystemLog = { 
      id,
      timestamp: new Date(),
      level: insertLog.level,
      service: insertLog.service,
      message: insertLog.message,
      metadata: insertLog.metadata ?? null,
    };
    this.systemLogs.set(id, log);
    return log;
  }

  // LinkedIn Tokens
  async storeLinkedInToken(insertToken: InsertLinkedInToken): Promise<LinkedInToken> {
    // Deactivate existing tokens
    for (const [id, token] of this.linkedinTokens.entries()) {
      this.linkedinTokens.set(id, { ...token, isActive: false });
    }
    
    // Create new token
    const id = randomUUID();
    const token: LinkedInToken = {
      id,
      accessToken: insertToken.accessToken,
      refreshToken: insertToken.refreshToken ?? null,
      expiresAt: insertToken.expiresAt ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.linkedinTokens.set(id, token);
    return token;
  }

  async getActiveLinkedInToken(): Promise<LinkedInToken | null> {
    for (const token of this.linkedinTokens.values()) {
      if (token.isActive) {
        return token;
      }
    }
    return null;
  }
}

export const storage = new MemStorage();
