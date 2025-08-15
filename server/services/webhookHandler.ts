import crypto from 'crypto';
import type { Request, Response } from 'express';
import { storage } from '../storage';

export class WebhookHandler {
  private static instance: WebhookHandler;
  
  static getInstance(): WebhookHandler {
    if (!WebhookHandler.instance) {
      WebhookHandler.instance = new WebhookHandler();
    }
    return WebhookHandler.instance;
  }

  // LinkedIn webhook handler
  async handleLinkedInWebhook(req: Request, res: Response) {
    try {
      console.log('📨 LinkedIn webhook received:', {
        method: req.method,
        query: req.query,
        body: req.body,
        timestamp: new Date().toISOString()
      });

      // Handle challenge validation
      if (req.query.challenge) {
        console.log('✅ Challenge validation:', req.query.challenge);
        return res.status(200).type('text/plain').send(String(req.query.challenge));
      }

      // Process webhook events
      if (req.method === 'POST' && req.body) {
        await this.processLinkedInEvent(req.body);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ LinkedIn webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // GitHub webhook handler with signature verification
  async handleGitHubWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const payload = JSON.stringify(req.body);
      
      if (!this.verifyGitHubSignature(payload, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = req.headers['x-github-event'] as string;
      console.log('📨 GitHub webhook event:', event);

      switch (event) {
        case 'push':
          await this.handlePushEvent(req.body);
          break;
        case 'pull_request':
          await this.handlePullRequestEvent(req.body);
          break;
        default:
          console.log('ℹ️ Unhandled GitHub event:', event);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ GitHub webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Generic webhook handler
  async handleGenericWebhook(req: Request, res: Response) {
    try {
      console.log('📨 Generic webhook received:', {
        method: req.method,
        headers: req.headers,
        body: req.body,
        timestamp: new Date().toISOString()
      });

      // Log webhook event
      await storage.logSystemEvent('webhook', 'info', 'Generic webhook received', {
        method: req.method,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      res.status(200).json({ 
        success: true, 
        message: 'Webhook received',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Generic webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  private async processLinkedInEvent(data: any) {
    try {
      if (data.event === 'hire_announcement') {
        console.log('👥 Processing hire announcement:', data.data);
        
        // Store hire data
        await storage.createNewHire({
          companyId: data.data.companyId || 'unknown',
          employeeName: data.data.employeeName,
          position: data.data.position,
          department: data.data.department,
          startDate: data.data.startDate ? new Date(data.data.startDate) : new Date(),
          linkedinUrl: data.data.linkedinUrl,
          source: 'linkedin_webhook'
        });

        console.log('✅ Hire announcement processed successfully');
      }
    } catch (error) {
      console.error('❌ Error processing LinkedIn event:', error);
      throw error;
    }
  }

  private async handlePushEvent(data: any) {
    console.log('🔄 Processing push event to:', data.ref);
    
    if (data.ref === 'refs/heads/main') {
      console.log('🚀 Main branch updated, triggering deployment...');
      // Add deployment logic here
    }
  }

  private async handlePullRequestEvent(data: any) {
    console.log('🔀 Processing pull request:', data.action);
    // Add PR processing logic here
  }

  private verifyGitHubSignature(payload: string, signature: string): boolean {
    if (!process.env.GITHUB_WEBHOOK_SECRET) {
      console.warn('⚠️ GitHub webhook secret not configured');
      return true; // Allow in development
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }
}