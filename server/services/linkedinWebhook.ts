import crypto from 'crypto';
import type { Request, Response } from 'express';
import { storage } from '../storage';
import type { InsertNewHire } from '@shared/schema';

export class LinkedInWebhookService {
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.LINKEDIN_WEBHOOK_SECRET || 'your-webhook-secret';
  }

  // Verify webhook signature
  private verifySignature(payload: string, signature: string): boolean {
    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');
      // timingSafeEqual requires equal length buffers
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (err) {
      console.warn('⚠️ Signature verification failed (malformed header)');
      return false;
    }
  }

  // Handle webhook events
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-linkedin-signature'] as string;
      
      // Handle raw body from express.raw() middleware
      let payload: string;
      let event: any;
      
      if (Buffer.isBuffer(req.body)) {
        payload = req.body.toString('utf8');
        event = JSON.parse(payload);
      } else {
        payload = JSON.stringify(req.body);
        event = req.body;
      }

      console.log('📨 LinkedIn webhook received:', {
        hasSignature: !!signature,
        eventType: event?.eventType || 'unknown',
        payloadSize: payload.length
      });

      // Skip signature verification in development/testing
      if (process.env.NODE_ENV !== 'production' && !signature) {
        console.log('⚠️ Skipping signature verification in development mode');
      } else if (!this.verifySignature(payload, signature)) {
        console.warn('❌ LinkedIn webhook signature verification failed');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Process different event types
      switch (event.eventType) {
        case 'ORGANIZATION_SOCIAL_ACTION':
          await this.handleOrganizationPost(event);
          break;
        case 'MEMBER_PROFILE_UPDATE':
          await this.handleMemberUpdate(event);
          break;
        default:
          console.log(`ℹ️ Unhandled event type: ${event.eventType}`);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Handle organization posts (hire announcements)
  private async handleOrganizationPost(event: any): Promise<void> {
    try {
      const post = event.data;
      const text = post.text?.text || '';
      const companyName = post.author?.name || 'Unknown Company';

      // Extract hire information from post
      const hire = this.extractHireFromPost(text, companyName);
      
      if (hire) {
        await storage.createNewHire(hire);
        console.log(`✅ Real-time hire detected: ${hire.personName} at ${hire.company}`);
      }
    } catch (error) {
      console.error('❌ Error processing organization post:', error);
    }
  }

  // Handle member profile updates (job changes)
  private async handleMemberUpdate(event: any): Promise<void> {
    try {
      const member = event.data;
      const positions = member.positions?.values || [];
      
      for (const position of positions) {
        if (this.isRecentPosition(position)) {
          const hire: InsertNewHire = {
            personName: `${member.firstName} ${member.lastName}`,
            company: position.company?.name || 'Unknown Company',
            position: position.title || 'Unknown Position',
            startDate: position.startDate ? new Date(position.startDate) : null,
            linkedinProfile: member.publicProfileUrl,
            source: 'LinkedIn Webhook - Profile Update',
            confidenceScore: '95'
          };

          await storage.createNewHire(hire);
          console.log(`✅ Real-time job change detected: ${hire.personName} at ${hire.company}`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing member update:', error);
    }
  }

  // Extract hire from organization post
  private extractHireFromPost(text: string, companyName: string): InsertNewHire | null {
    const hirePatterns = [
      /(?:welcome|welcoming|excited to welcome|pleased to announce|thrilled to share)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:as|to)(?:\s+our)?(?:\s+new)?\s+([A-Z][a-zA-Z\s&-]+?)(?:\s+at|\s+to|\.|!|$)/gi,
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has\s+)?joined\s+(?:us\s+)?(?:as\s+)?(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+?)(?:\s+at|\.|!|$)/gi,
      /(?:announcing|excited to announce)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+as\s+(?:our\s+new\s+)?([A-Z][a-zA-Z\s&-]+?)(?:\s+at|\.|!|$)/gi
    ];

    for (const pattern of hirePatterns) {
      let match: RegExpExecArray | null;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(text)) !== null) {
        const name = match[1]?.trim();
        const position = match[2]?.trim();

        if (this.isValidHire(name, position)) {
          return {
            personName: name,
            company: companyName,
            position: this.cleanPosition(position),
            startDate: null,
            source: 'LinkedIn Webhook - Organization Post',
            confidenceScore: '95'
          };
        }
      }
    }

    return null;
  }

  // Check if position is recent (within 30 days)
  private isRecentPosition(position: any): boolean {
    if (!position.startDate) return false;
    
    const startDate = new Date(position.startDate);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return startDate >= thirtyDaysAgo;
  }

  // Validate hire information
  private isValidHire(name: string, position: string): boolean {
    if (!name || !position) return false;

    const nameWords = name.split(' ');
    if (nameWords.length < 2 || nameWords.length > 3) return false;
    if (!nameWords.every(word => /^[A-Z][a-z]{1,}$/.test(word))) return false;

    const executiveKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'chief', 'director', 'manager', 'head', 
      'vice president', 'vp', 'president', 'senior', 'lead', 'officer', 
      'executive', 'principal'
    ];
    
    const posLower = position.toLowerCase();
    return executiveKeywords.some(keyword => posLower.includes(keyword)) && 
           posLower.length >= 3 && 
           posLower.length <= 60;
  }

  // Clean position title
  private cleanPosition(position: string): string {
    return position
      .replace(/^(our|the|a)\s+/i, '')
      .replace(/\s+(team|department|at).*$/i, '')
      .trim() || 'Executive';
  }
}