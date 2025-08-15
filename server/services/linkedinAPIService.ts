import type { Company, InsertNewHire, InsertJobPosting } from '@shared/schema';
import { storage } from '../storage';

interface LinkedInAPIConfig {
  baseUrl: string;
  accessToken: string;
  version: string;
}

export class LinkedInAPIService {
  private config: LinkedInAPIConfig;
  private rateLimits = {
    organizationsLookup: { limit: 50000, used: 0 },
    ugcPosts: { limit: 20000, used: 0 },
    organizationalEntityNotifications: { limit: 500, used: 0 },
    people: { limit: 10000, used: 0 }
  };

  constructor() {
    this.config = {
      baseUrl: 'https://api.linkedin.com/rest',
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN || '',
      version: '2.0.0'
    };
  }

  async trackNewHires(): Promise<InsertNewHire[]> {
    console.log('🔍 LinkedIn API: Tracking new hires...');
    
    const companies = await storage.getCompanies();
    const activeCompanies = companies.filter(c => c.isActive);
    const newHires: InsertNewHire[] = [];

    for (const company of activeCompanies) {
      try {
        // Priority 1: Get organization notifications (most accurate for hires)
        const notifications = await this.getOrganizationNotifications(company);
        const notificationHires = this.parseHiresFromNotifications(notifications, company);
        
        // Priority 2: Get UGC posts (company posts that might announce hires)
        const posts = await this.getOrganizationPosts(company);
        const postHires = this.parseHiresFromPosts(posts, company);
        
        // Combine and filter for NEW hires only (from Aug 8th)
        const allHires = [...notificationHires, ...postHires];
        const newHiresOnly = allHires.filter(hire => this.isNewHire(hire));
        
        newHires.push(...newHiresOnly);
        
        console.log(`✅ LinkedIn API found ${newHiresOnly.length} new hires for ${company.name}`);
        
        // Respect rate limits
        await this.delay(1000);
        
      } catch (error) {
        console.error(`❌ LinkedIn API error for ${company.name}:`, error);
      }
    }

    return this.deduplicateHires(newHires);
  }

  private async getOrganizationNotifications(company: Company): Promise<any[]> {
    if (!company.linkedinUrl) return [];
    
    try {
      const orgId = this.extractOrgIdFromUrl(company.linkedinUrl);
      if (!orgId) return [];

      // Check rate limit
      if (this.rateLimits.organizationalEntityNotifications.used >= this.rateLimits.organizationalEntityNotifications.limit) {
        console.warn('⚠️ LinkedIn API rate limit reached for notifications');
        return [];
      }

      const url = `${this.config.baseUrl}/organizationalEntityNotifications`;
      const params = new URLSearchParams({
        q: 'criteria',
        organizationalEntity: `urn:li:organization:${orgId}`,
        actions: 'List(SHARE,COMMENT,ADMIN_COMMENT)',
        'timeRange.start': new Date('2025-08-08').getTime().toString(),
        'timeRange.end': new Date().getTime().toString()
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-Restli-Protocol-Version': this.config.version,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.rateLimits.organizationalEntityNotifications.used++;
      
      return data.elements || [];

    } catch (error) {
      console.error('Error fetching organization notifications:', error);
      return [];
    }
  }

  private async getOrganizationPosts(company: Company): Promise<any[]> {
    if (!company.linkedinUrl) return [];
    
    try {
      const orgId = this.extractOrgIdFromUrl(company.linkedinUrl);
      if (!orgId) return [];

      // Check rate limit
      if (this.rateLimits.ugcPosts.used >= this.rateLimits.ugcPosts.limit) {
        console.warn('⚠️ LinkedIn API rate limit reached for UGC posts');
        return [];
      }

      const url = `${this.config.baseUrl}/ugcPosts`;
      const params = new URLSearchParams({
        q: 'authors',
        authors: `List(urn:li:organization:${orgId})`,
        sortBy: 'LAST_MODIFIED',
        count: '50'
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'X-Restli-Protocol-Version': this.config.version,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.rateLimits.ugcPosts.used++;
      
      return data.elements || [];

    } catch (error) {
      console.error('Error fetching organization posts:', error);
      return [];
    }
  }

  private parseHiresFromNotifications(notifications: any[], company: Company): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    
    for (const notification of notifications) {
      try {
        // Skip if not recent enough
        const notificationDate = new Date(notification.lastModifiedAt);
        if (notificationDate < new Date('2025-08-08')) continue;

        // Only process relevant actions
        if (!['SHARE', 'COMMENT', 'ADMIN_COMMENT'].includes(notification.action)) continue;

        // Extract hire information from the notification
        const hire = this.extractHireFromNotificationData(notification, company);
        if (hire) {
          hires.push(hire);
        }

      } catch (error) {
        console.error('Error parsing hire from notification:', error);
      }
    }

    return hires;
  }

  private parseHiresFromPosts(posts: any[], company: Company): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    
    for (const post of posts) {
      try {
        // Skip if not recent enough
        const postDate = new Date(post.lastModifiedAt || post.createdAt);
        if (postDate < new Date('2025-08-08')) continue;

        // Extract text content
        let text = '';
        if (post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text) {
          text = post.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text;
        }

        if (!text) continue;

        // Check for hire keywords
        const hireKeywords = [
          'welcome', 'joined', 'joins', 'new hire', 'appointed', 'announces',
          'pleased to announce', 'excited to welcome', 'team member', 'new addition'
        ];

        const containsHireKeyword = hireKeywords.some(keyword => 
          text.toLowerCase().includes(keyword.toLowerCase())
        );

        if (!containsHireKeyword) continue;

        // Extract hire information
        const hire = this.extractHireFromText(text, company, postDate);
        if (hire) {
          hires.push(hire);
        }

      } catch (error) {
        console.error('Error parsing hire from post:', error);
      }
    }

    return hires;
  }

  private extractHireFromNotificationData(notification: any, company: Company): InsertNewHire | null {
    // This would be similar to the webhook handler's extraction logic
    // but adapted for the notification API response format
    return null; // Placeholder - implement based on actual API response structure
  }

  private extractHireFromText(text: string, company: Company, foundDate: Date): InsertNewHire | null {
    // Extract person name and position using regex patterns
    const patterns = [
      /welcome\s+([A-Z][a-z]+\s+[A-Z][a-z]+).*?(?:as|to).*?(CEO|CTO|CFO|VP|Director|Manager|Lead|Senior|Junior|Analyst|Specialist)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+).*?joins.*?(?:as|our).*?(CEO|CTO|CFO|VP|Director|Manager|Lead|Senior|Junior|Analyst|Specialist)/i,
      /(?:pleased|excited).*?(?:announce|welcome).*?([A-Z][a-z]+\s+[A-Z][a-z]+).*?(?:as|to).*?(CEO|CTO|CFO|VP|Director|Manager|Lead|Senior|Junior|Analyst|Specialist)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          personName: match[1].trim(),
          company: company.name,
          position: match[2].trim(),
          source: 'linkedin_api',
          foundDate,
          startDate: foundDate.toISOString().split('T')[0] // Use found date as start date
        };
      }
    }

    return null;
  }

  private extractOrgIdFromUrl(linkedinUrl: string): string | null {
    // Extract organization ID from LinkedIn URL
    // e.g., "https://www.linkedin.com/company/12345/" -> "12345"
    const match = linkedinUrl.match(/\/company\/(\d+)/);
    return match ? match[1] : null;
  }

  private isNewHire(hire: InsertNewHire): boolean {
    if (!hire.foundDate) return false;
    const startDate = new Date('2025-08-08');
    return hire.foundDate >= startDate;
  }

  private deduplicateHires(hires: InsertNewHire[]): InsertNewHire[] {
    const seen = new Set<string>();
    return hires.filter(hire => {
      const key = `${hire.personName}-${hire.company}-${hire.position}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get current rate limit status
  getRateLimitStatus() {
    return {
      organizationsLookup: `${this.rateLimits.organizationsLookup.used}/${this.rateLimits.organizationsLookup.limit}`,
      ugcPosts: `${this.rateLimits.ugcPosts.used}/${this.rateLimits.ugcPosts.limit}`,
      organizationalEntityNotifications: `${this.rateLimits.organizationalEntityNotifications.used}/${this.rateLimits.organizationalEntityNotifications.limit}`,
      people: `${this.rateLimits.people.used}/${this.rateLimits.people.limit}`
    };
  }
}