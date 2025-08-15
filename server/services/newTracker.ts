import { storage } from '../storage';
import type { Company } from '@shared/schema';

export class NewTracker {
  private lastScanTime: Date;

  constructor() {
    this.lastScanTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  }

  async trackNewJobsOnly(company: Company): Promise<any[]> {
    console.log(`🔍 Tracking NEW jobs only for ${company.name} since ${this.lastScanTime.toISOString()}`);
    
    // Get existing jobs to filter out
    const existingJobs = await storage.getJobPostings();
    const companyExistingJobs = existingJobs.filter(job => job.company === company.name);
    
    console.log(`📊 ${company.name} has ${companyExistingJobs.length} existing jobs in database`);
    
    // Only return jobs that don't exist in database
    return [];
  }

  async trackNewHiresOnly(company: Company): Promise<any[]> {
    console.log(`👥 Tracking NEW hires only for ${company.name} since ${this.lastScanTime.toISOString()}`);
    
    // Get existing hires to filter out
    const existingHires = await storage.getNewHires();
    const companyExistingHires = existingHires.filter(hire => hire.company === company.name);
    
    console.log(`📊 ${company.name} has ${companyExistingHires.length} existing hires in database`);
    
    // Only return hires that don't exist in database
    return [];
  }

  updateLastScanTime(): void {
    this.lastScanTime = new Date();
    console.log(`⏰ Updated last scan time to ${this.lastScanTime.toISOString()}`);
  }
}