import crypto from 'crypto';
import { storage } from '../storage';
import type { InsertNewHire } from '@shared/schema';

interface LinkedInNotification {
  notificationId: number;
  organizationalEntity: string;
  action: 'LIKE' | 'COMMENT' | 'SHARE' | 'SHARE_MENTION' | 'ADMIN_COMMENT';
  sourcePost: string;
  decoratedSourcePost?: {
    entity: string;
    owner: string;
    text: string;
    title?: string;
    description?: string;
  };
  lastModifiedAt: number;
  generatedActivity?: string;
  decoratedGeneratedActivity?: {
    share?: { entity: string; owner: string; text: string; };
    comment?: { entity: string; owner: string; text: string; };
  };
  subscriber: string;
}

interface WebhookPayload {
  type: 'ORGANIZATION_SOCIAL_ACTION_NOTIFICATIONS';
  notifications: LinkedInNotification[];
}

export class ProfessionalLinkedInWebhook {
  private processedNotifications = new Set<number>();
  private hirePatterns = [
    // Executive appointments
    /(?:pleased|excited|proud)\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+as\s+(?:our\s+new\s+)?(CEO|CTO|CFO|COO|VP|President|Director|Head\s+of|Chief)/i,
    
    // Team joins
    /(?:welcome|introducing)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:to\s+(?:our\s+)?team|who\s+(?:has\s+)?joined\s+us)\s+as\s+(?:our\s+new\s+)?([\w\s]+?)(?:\.|!|$)/i,
    
    // New hire announcements
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:has\s+)?joined\s+(?:us|our\s+team|the\s+company)\s+as\s+(?:our\s+new\s+)?([\w\s]+?)(?:\.|!|$)/i,
    
    // Appointment announcements
    /(?:we're\s+)?(?:thrilled|delighted|happy)\s+to\s+announce\s+(?:that\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:has\s+been\s+)?(?:appointed|named)\s+as\s+(?:our\s+new\s+)?([\w\s]+?)(?:\.|!|$)/i,
    
    // Starting position
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:will\s+be\s+)?(?:starting|begins)\s+(?:as\s+)?(?:our\s+new\s+)?([\w\s]+?)(?:\s+on|\s+this|\.|!|$)/i
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

    console.log('✅ LinkedIn webhook challenge validated professionally');

    return { challengeCode, challengeResponse };
  }

  async handleNotification(body: string, signature: string): Promise<void> {
    if (!this.verifySignature(body, signature)) {
      console.error('❌ Invalid LinkedIn webhook signature - security breach attempt');
      return;
    }

    try {
      const payload: WebhookPayload = JSON.parse(body);
      
      if (payload.type !== 'ORGANIZATION_SOCIAL_ACTION_NOTIFICATIONS') {
        return;
      }

      console.log(`📨 Processing ${payload.notifications.length} LinkedIn notifications professionally`);

      for (const notification of payload.notifications) {
        await this.processNotificationProfessionally(notification);
      }

    } catch (error) {
      console.error('❌ Professional webhook processing error:', error);
    }
  }

  private verifySignature(body: string, signature: string): boolean {
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    
    if (!clientSecret || !signature) return false;

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

  private async processNotificationProfessionally(notification: LinkedInNotification): Promise<void> {
    // Professional deduplication
    if (this.processedNotifications.has(notification.notificationId)) {
      return;
    }

    this.processedNotifications.add(notification.notificationId);

    // Only process hire-relevant actions
    if (!['SHARE', 'ADMIN_COMMENT'].includes(notification.action)) {
      return;
    }

    // Filter by date - only NEW hires from Aug 8th
    const notificationDate = new Date(notification.lastModifiedAt);
    const startDate = new Date('2025-08-08');
    
    if (notificationDate < startDate) {
      return;
    }

    try {
      const hire = await this.extractProfessionalHire(notification);
      
      if (hire && this.validateHireQuality(hire)) {
        await this.saveProfessionalHire(hire);
        console.log(`✅ Professional hire detected: ${hire.personName} as ${hire.position} at ${hire.company}`);
      }

    } catch (error) {
      console.error(`❌ Error processing notification ${notification.notificationId}:`, error);
    }
  }

  private async extractProfessionalHire(notification: LinkedInNotification): Promise<InsertNewHire | null> {
    try {
      const company = await this.getCompanyFromUrn(notification.organizationalEntity);
      if (!company) return null;

      let postText = '';
      
      // Extract text from various sources
      if (notification.decoratedSourcePost?.text) {
        postText = notification.decoratedSourcePost.text;
      } else if (notification.decoratedGeneratedActivity?.share?.text) {
        postText = notification.decoratedGeneratedActivity.share.text;
      } else if (notification.decoratedGeneratedActivity?.comment?.text) {
        postText = notification.decoratedGeneratedActivity.comment.text;
      }

      if (!postText) return null;

      // Professional hire extraction
      const hireInfo = this.extractHireInfoProfessionally(postText);
      
      if (!hireInfo.personName || !hireInfo.position) {
        return null;
      }

      // Calculate confidence score based on extraction quality
      const confidenceScore = this.calculateConfidenceScore(hireInfo, postText);

      return {
        personName: hireInfo.personName,
        company: company.name,
        position: hireInfo.position,
        startDate: hireInfo.startDate,
        previousCompany: hireInfo.previousCompany,
        linkedinProfile: hireInfo.linkedinProfile,
        source: 'linkedin_webhook',
        confidenceScore,
        foundDate: new Date(),
        verified: false,
        department: hireInfo.department,
        location: hireInfo.location
      };

    } catch (error) {
      console.error('Professional hire extraction error:', error);
      return null;
    }
  }

  private extractHireInfoProfessionally(text: string): {
    personName?: string;
    position?: string;
    startDate?: string;
    previousCompany?: string;
    linkedinProfile?: string;
    department?: string;
    location?: string;
  } {
    const info: any = {};

    // Use professional patterns for extraction
    for (const pattern of this.hirePatterns) {
      const match = text.match(pattern);
      if (match) {
        info.personName = this.cleanPersonName(match[1]);
        info.position = this.cleanPosition(match[2]);
        break;
      }
    }

    // Extract previous company
    const prevCompanyPatterns = [
      /(?:formerly|previously)\s+(?:at|with)\s+([A-Z][a-zA-Z\s&]+?)(?:\.|,|$)/i,
      /(?:coming\s+from|joins\s+us\s+from)\s+([A-Z][a-zA-Z\s&]+?)(?:\.|,|$)/i
    ];
    
    for (const pattern of prevCompanyPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.previousCompany = match[1].trim();
        break;
      }
    }

    // Extract start date
    const datePatterns = [
      /(?:starting|begins|joined)\s+(?:on\s+)?([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?)/i,
      /(?:effective|as\s+of)\s+([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?)/i
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        info.startDate = match[1].trim();
        break;
      }
    }

    // Extract department
    const deptPatterns = [
      /(?:in|to)\s+(?:our\s+)?(engineering|marketing|sales|finance|hr|human\s+resources|operations|product|design|legal|compliance|technology|data|analytics)\s+(?:team|department)/i
    ];
    
    for (const pattern of deptPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.department = match[1].trim();
        break;
      }
    }

    return info;
  }

  private cleanPersonName(name: string): string {
    return name
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private cleanPosition(position: string): string {
    return position
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateConfidenceScore(hireInfo: any, text: string): number {
    let score = 50; // Base score

    // Name quality
    if (hireInfo.personName && hireInfo.personName.split(' ').length >= 2) {
      score += 20;
    }

    // Position quality
    if (hireInfo.position && hireInfo.position.length > 3) {
      score += 15;
    }

    // Executive positions get higher confidence
    if (/CEO|CTO|CFO|COO|VP|President|Director/i.test(hireInfo.position)) {
      score += 10;
    }

    // Previous company mentioned
    if (hireInfo.previousCompany) {
      score += 5;
    }

    // Start date mentioned
    if (hireInfo.startDate) {
      score += 5;
    }

    // Professional language indicators
    if (/pleased|excited|thrilled|delighted|proud/i.test(text)) {
      score += 5;
    }

    return Math.min(score, 97); // Cap at 97% for webhook source
  }

  private validateHireQuality(hire: InsertNewHire): boolean {
    // Professional validation rules
    if (!hire.personName || hire.personName.length < 3) return false;
    if (!hire.position || hire.position.length < 2) return false;
    if (hire.confidenceScore < 70) return false;
    
    // Reject obvious non-names
    const invalidNames = [
      'team', 'company', 'organization', 'group', 'department',
      'basketball', 'football', 'sports', 'star', 'player'
    ];
    
    const lowerName = hire.personName.toLowerCase();
    if (invalidNames.some(invalid => lowerName.includes(invalid))) {
      return false;
    }

    return true;
  }

  private async getCompanyFromUrn(orgUrn: string): Promise<{ name: string } | null> {
    try {
      const orgId = orgUrn.split(':').pop();
      const companies = await storage.getCompanies();
      
      for (const company of companies) {
        if (company.linkedinUrl && company.linkedinUrl.includes(orgId || '')) {
          return { name: company.name };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting company from URN:', error);
      return null;
    }
  }

  private async saveProfessionalHire(hire: InsertNewHire): Promise<void> {
    try {
      // Professional deduplication
      const existingHires = await storage.getNewHires();
      const isDuplicate = existingHires.some(existing => 
        existing.personName === hire.personName && 
        existing.company === hire.company &&
        existing.position === hire.position
      );

      if (isDuplicate) {
        console.log(`🔄 Professional deduplication: ${hire.personName} at ${hire.company}`);
        return;
      }

      await storage.createNewHire(hire);
      
      // Send professional notifications
      const { SlackService } = await import('./slackService');
      const { EmailService } = await import('./emailService');
      
      const slackService = new SlackService();
      const emailService = new EmailService();
      
      await slackService.sendHireAlert(hire);
      await emailService.sendHireAlert(hire);
      
    } catch (error) {
      console.error('Professional hire save error:', error);
    }
  }

  // Professional cleanup
  cleanupProcessedNotifications(): void {
    if (this.processedNotifications.size > 500) {
      const notificationArray = Array.from(this.processedNotifications);
      const toKeep = notificationArray.slice(-250);
      this.processedNotifications.clear();
      toKeep.forEach(id => this.processedNotifications.add(id));
    }
  }
}