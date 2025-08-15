import crypto from 'crypto';
import { storage } from '../storage';
import type { InsertNewHire } from '@shared/schema';

interface LinkedInNotification {
  notificationId: number;
  organizationalEntity: string;
  action: 'LIKE' | 'COMMENT' | 'SHARE' | 'SHARE_MENTION' | 'ADMIN_COMMENT' | 'COMMENT_EDIT' | 'COMMENT_DELETE';
  sourcePost: string;
  decoratedSourcePost?: any;
  lastModifiedAt: number;
  generatedActivity?: string;
  decoratedGeneratedActivity?: any;
  subscriber: string;
}

interface WebhookPayload {
  type: 'ORGANIZATION_SOCIAL_ACTION_NOTIFICATIONS';
  notifications: LinkedInNotification[];
}

export class LinkedInWebhookHandler {
  private processedNotifications = new Set<number>();
  private hireKeywords = [
    'welcome', 'joined', 'joins', 'new hire', 'appointed', 'announces', 
    'pleased to announce', 'excited to welcome', 'team member', 'new addition',
    'starting today', 'joins as', 'joins our team', 'new colleague'
  ];

  async handleChallenge(challengeCode: string): Promise<{ challengeCode: string; challengeResponse: string }> {
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    
    if (!clientSecret) {
      throw new Error('LinkedIn client secret not configured');
    }

    const challengeResponse = crypto
      .createHmac('sha256', clientSecret)
      .update(challengeCode)
      .digest('hex');

    console.log('✅ LinkedIn webhook challenge validated');

    return {
      challengeCode,
      challengeResponse
    };
  }

  async handleNotification(body: string, signature: string): Promise<void> {
    // Verify signature
    if (!this.verifySignature(body, signature)) {
      console.error('❌ Invalid LinkedIn webhook signature');
      return;
    }

    try {
      const payload: WebhookPayload = JSON.parse(body);
      
      if (payload.type !== 'ORGANIZATION_SOCIAL_ACTION_NOTIFICATIONS') {
        console.log('ℹ️ Ignoring non-social-action notification');
        return;
      }

      console.log(`📨 Processing ${payload.notifications.length} LinkedIn notifications`);

      for (const notification of payload.notifications) {
        await this.processNotification(notification);
      }

    } catch (error) {
      console.error('❌ Error processing LinkedIn webhook:', error);
    }
  }

  private verifySignature(body: string, signature: string): boolean {
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    
    if (!clientSecret || !signature) {
      return false;
    }

    // Remove 'hmacsha256=' prefix if present
    const cleanSignature = signature.replace('hmacsha256=', '');
    
    const expectedSignature = crypto
      .createHmac('sha256', clientSecret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  private async processNotification(notification: LinkedInNotification): Promise<void> {
    // Deduplicate using notificationId
    if (this.processedNotifications.has(notification.notificationId)) {
      console.log(`🔄 Skipping duplicate notification ${notification.notificationId}`);
      return;
    }

    this.processedNotifications.add(notification.notificationId);

    // Only process relevant actions for hire detection
    if (!['SHARE', 'COMMENT', 'ADMIN_COMMENT'].includes(notification.action)) {
      return;
    }

    try {
      // Extract hire information from notification
      const hire = await this.extractHireFromNotification(notification);
      
      if (hire) {
        // Check if this is a NEW hire (from Aug 8th onwards)
        const hireDate = new Date(notification.lastModifiedAt);
        const startDate = new Date('2025-08-08');
        
        if (hireDate >= startDate) {
          await this.saveNewHire(hire);
          console.log(`✅ New hire detected: ${hire.personName} at ${hire.company}`);
        }
      }

    } catch (error) {
      console.error(`❌ Error processing notification ${notification.notificationId}:`, error);
    }
  }

  private async extractHireFromNotification(notification: LinkedInNotification): Promise<InsertNewHire | null> {
    try {
      // Get organization name from URN
      const orgUrn = notification.organizationalEntity;
      const company = await this.getCompanyFromUrn(orgUrn);
      
      if (!company) {
        return null;
      }

      // Extract text content from decorated post or activity
      let postText = '';
      
      if (notification.decoratedSourcePost?.text) {
        postText = notification.decoratedSourcePost.text;
      } else if (notification.decoratedGeneratedActivity?.share?.text) {
        postText = notification.decoratedGeneratedActivity.share.text;
      } else if (notification.decoratedGeneratedActivity?.comment?.text) {
        postText = notification.decoratedGeneratedActivity.comment.text;
      }

      // Check if post contains hire-related keywords
      if (!this.containsHireKeywords(postText)) {
        return null;
      }

      // Extract person name and position from text
      const hireInfo = this.parseHireInfo(postText);
      
      if (!hireInfo.personName || !hireInfo.position) {
        return null;
      }

      return {
        personName: hireInfo.personName,
        company: company.name,
        position: hireInfo.position,
        startDate: hireInfo.startDate,
        source: 'linkedin_webhook',
        foundDate: new Date(),
        linkedinUrl: hireInfo.linkedinUrl,
        department: hireInfo.department,
        location: hireInfo.location
      };

    } catch (error) {
      console.error('Error extracting hire from notification:', error);
      return null;
    }
  }

  private containsHireKeywords(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.hireKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  private parseHireInfo(text: string): {
    personName?: string;
    position?: string;
    startDate?: string;
    linkedinUrl?: string;
    department?: string;
    location?: string;
  } {
    const info: any = {};

    // Common patterns for hire announcements
    const patterns = [
      // "Welcome John Smith as our new CEO"
      /welcome\s+([A-Z][a-z]+\s+[A-Z][a-z]+).*?(?:as|to).*?(CEO|CTO|CFO|VP|Director|Manager|Lead|Senior|Junior|Analyst|Specialist|Coordinator|Associate)/i,
      
      // "John Smith joins as CEO"
      /([A-Z][a-z]+\s+[A-Z][a-z]+).*?joins.*?(?:as|our).*?(CEO|CTO|CFO|VP|Director|Manager|Lead|Senior|Junior|Analyst|Specialist|Coordinator|Associate)/i,
      
      // "Pleased to announce John Smith as CEO"
      /(?:pleased|excited).*?(?:announce|welcome).*?([A-Z][a-z]+\s+[A-Z][a-z]+).*?(?:as|to).*?(CEO|CTO|CFO|VP|Director|Manager|Lead|Senior|Junior|Analyst|Specialist|Coordinator|Associate)/i,
      
      // "John Smith has joined as CEO"
      /([A-Z][a-z]+\s+[A-Z][a-z]+).*?(?:has\s+)?joined.*?(?:as|our).*?(CEO|CTO|CFO|VP|Director|Manager|Lead|Senior|Junior|Analyst|Specialist|Coordinator|Associate)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        info.personName = match[1].trim();
        info.position = match[2].trim();
        break;
      }
    }

    // Extract department if mentioned
    const deptPatterns = [
      /(?:in|to).*?(engineering|marketing|sales|finance|hr|human resources|operations|product|design|legal|compliance)/i
    ];
    
    for (const pattern of deptPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.department = match[1].trim();
        break;
      }
    }

    // Extract location if mentioned
    const locationPatterns = [
      /(?:in|at|based in)\s+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.location = match[1].trim();
        break;
      }
    }

    return info;
  }

  private async getCompanyFromUrn(orgUrn: string): Promise<{ name: string } | null> {
    try {
      // Extract organization ID from URN (e.g., "urn:li:organization:12345" -> "12345")
      const orgId = orgUrn.split(':').pop();
      
      // Get companies from storage and match by LinkedIn URL or name
      const companies = await storage.getCompanies();
      
      // Try to match by LinkedIn URL containing the org ID
      for (const company of companies) {
        if (company.linkedinUrl && company.linkedinUrl.includes(orgId || '')) {
          return { name: company.name };
        }
      }
      
      // If no direct match, use LinkedIn API to get organization details
      // This would require implementing the organizationsLookup API call
      
      return null;
    } catch (error) {
      console.error('Error getting company from URN:', error);
      return null;
    }
  }

  private async saveNewHire(hire: InsertNewHire): Promise<void> {
    try {
      // Check for duplicates
      const existingHires = await storage.getNewHires();
      const isDuplicate = existingHires.some(existing => 
        existing.personName === hire.personName && 
        existing.company === hire.company &&
        existing.position === hire.position
      );

      if (isDuplicate) {
        console.log(`🔄 Skipping duplicate hire: ${hire.personName} at ${hire.company}`);
        return;
      }

      await storage.createNewHire(hire);
      
      // Send notifications
      const { SlackService } = await import('./slackService');
      const { EmailService } = await import('./emailService');
      
      const slackService = new SlackService();
      const emailService = new EmailService();
      
      await slackService.sendHireAlert(hire);
      await emailService.sendHireAlert(hire);
      
    } catch (error) {
      console.error('Error saving new hire:', error);
    }
  }

  // Cleanup old processed notifications (run periodically)
  cleanupProcessedNotifications(): void {
    // Keep only last 1000 notification IDs to prevent memory bloat
    if (this.processedNotifications.size > 1000) {
      const notificationArray = Array.from(this.processedNotifications);
      const toKeep = notificationArray.slice(-500); // Keep last 500
      this.processedNotifications.clear();
      toKeep.forEach(id => this.processedNotifications.add(id));
    }
  }
}