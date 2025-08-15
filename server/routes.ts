import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { SchedulerService } from "./scheduler";
import { JobTrackerService } from "./services/jobTracker";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import type { Request, Response } from "express";
// Store a singleton JobTrackerService instance for cookie updates
let jobTrackerService: JobTrackerService | null = null;


// Load cookies from file if present
const cookiesPath = path.join(__dirname, "linkedin_cookies.json");
let persistedCookies: any[] | null = null;
try {
  if (fs.existsSync(cookiesPath)) {
    const raw = fs.readFileSync(cookiesPath, "utf-8");
    persistedCookies = JSON.parse(raw);
    if (Array.isArray(persistedCookies) && persistedCookies.length > 0) {
      jobTrackerService = new JobTrackerService(persistedCookies);
      console.log("✅ Loaded LinkedIn session cookies for authenticated scraping");
    }

  }
} catch (e) {
  console.warn("⚠️ Failed to load LinkedIn cookies on startup:", e);
}

import { insertCompanySchema } from "@shared/schema";
import { LinkedInOAuth } from "./services/linkedinAuth";
import { LinkedInWebhookService } from "./services/linkedinWebhook";
import { WebhookHandler } from "./services/webhookHandler";

let schedulerService: SchedulerService | null = null;

export async function registerRoutes(app: Express): Promise<Server> {
  

  // Initialize scheduler service but don't auto-start
  schedulerService = new SchedulerService();
  await schedulerService.initialize();
  // Don't auto-start - wait for user to click Start Tracking

  // API endpoint to upload LinkedIn session cookies
  app.post("/api/linkedin/session-cookies", async (req: Request, res: Response) => {
    try {
      const cookies = req.body.cookies;
      if (!Array.isArray(cookies) || cookies.length === 0) {
        return res.status(400).json({ error: "No cookies provided" });
      }
      // Persist cookies to file
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2), "utf-8");
      if (!jobTrackerService) {
        jobTrackerService = new JobTrackerService(cookies);
      } else {

        jobTrackerService.setLinkedInSessionCookies(cookies);
      }
      res.json({ success: true, message: "LinkedIn session cookies updated and persisted" });
      console.log("✅ LinkedIn session cookies uploaded and persisted for authenticated scraping");
    } catch (error) {
      console.error("Error updating LinkedIn session cookies:", error);
      res.status(500).json({ error: "Failed to update LinkedIn session cookies" });
    }
  });

  // Dashboard data endpoints
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      const jobs = await storage.getJobPostings(50);
      const hires = await storage.getNewHires(50);
      const analytics = await storage.getLatestAnalytics();

      // Get today's counts
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayJobs = jobs.filter(j => j.foundDate && j.foundDate >= today);
      const todayHires = hires.filter(h => h.foundDate && h.foundDate >= today);

      // Calculate actual success rate from recent analytics
      const recentAnalytics = await storage.getAnalytics(7); // Last 7 days
      const successRate = recentAnalytics.length > 0 
        ? recentAnalytics.reduce((sum, a) => {
            const successful = a.successfulScans || 0;
            const failed = a.failedScans || 0;
            const total = successful + failed;
            return sum + (total > 0 ? (successful / total * 100) : 100);
          }, 0) / recentAnalytics.length
        : 100;

      const stats = {
        companiesTracked: companies.length,
        newJobsToday: todayJobs.length,
        newHiresToday: todayHires.length,
        successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
        lastScanTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/activity", async (req, res) => {
    try {
      const logs = await storage.getSystemLogs(undefined, undefined, 10);
      const activities = logs.map(log => ({
        id: log.id,
        type: log.level,
        message: log.message,
        timestamp: log.timestamp,
        service: log.service,
      }));

      res.json(activities);
    } catch (error: any) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // Companies endpoints
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.json(company);
    } catch (error: any) {
      console.error("Error creating company:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid company data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create company" });
      }
    }
  });

  app.put("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const company = await storage.updateCompany(id, updates);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      res.json(company);
    } catch (error: any) {
      console.error("Error updating company:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCompany(id);

      if (!deleted) {
        return res.status(404).json({ error: "Company not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  // Job postings endpoints
  app.get("/api/jobs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const jobs = await storage.getJobPostings(limit);
      res.json(jobs);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // New hires endpoints
  app.get("/api/hires", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const hires = await storage.getNewHires(limit);
      res.json(hires);
    } catch (error: any) {
      console.error("Error fetching hires:", error);
      res.status(500).json({ error: "Failed to fetch hires" });
    }
  });

  // Analytics endpoints
  app.get("/api/analytics", async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const analytics = await storage.getAnalytics(days);
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Health endpoints
  app.get("/api/health", async (req, res) => {
    try {
      const service = req.query.service as string;
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
      const metrics = await storage.getHealthMetrics(service, hours);
      res.json(metrics);
    } catch (error: any) {
      console.error("Error fetching health metrics:", error);
      res.status(500).json({ error: "Failed to fetch health metrics" });
    }
  });

  // System control endpoints
  app.post("/api/system/pause", async (req, res) => {
    try {
      if (schedulerService) {
        await schedulerService.stop();
      }
      res.json({ success: true, message: "System paused" });
    } catch (error: any) {
      console.error("Error pausing system:", error);
      res.status(500).json({ error: "Failed to pause system" });
    }
  });

  app.post("/api/system/resume", async (req, res) => {
    try {
      if (schedulerService) {
        await schedulerService.start();
      }
      res.json({ success: true, message: "System resumed" });
    } catch (error: any) {
      console.error("Error resuming system:", error);
      res.status(500).json({ error: "Failed to resume system" });
    }
  });

  // LinkedIn OAuth endpoints
  app.get("/api/linkedin/auth", async (req, res) => {
    try {
      const { LinkedInAPIService } = await import('./services/linkedinAPI');
      const linkedinAPI = new LinkedInAPIService();
      await linkedinAPI.initialize();
      
      const authUrl = linkedinAPI.getAuthorizationUrl();
      res.json({ authUrl });
    } catch (error: any) {
      console.error('Error getting LinkedIn auth URL:', error);
      res.status(500).json({ error: 'Failed to get LinkedIn auth URL' });
    }
  });

  app.get("/", async (req, res) => {
    const { code } = req.query;
    if (code) {
      try {
        const { LinkedInAPIService } = await import('./services/linkedinAPI');
        const linkedinAPI = new LinkedInAPIService();
        await linkedinAPI.initialize();
        
        const accessToken = await linkedinAPI.exchangeCodeForToken(code as string);
        if (accessToken) {
          process.env.LINKEDIN_ACCESS_TOKEN = accessToken;
          res.send('<script>alert("LinkedIn connected successfully!"); window.close();</script>');
        } else {
          res.send('<script>alert("LinkedIn authentication failed!"); window.close();</script>');
        }
      } catch (error: any) {
        console.error('Error handling LinkedIn callback:', error);
        res.send('<script>alert("LinkedIn authentication error!"); window.close();</script>');
      }
    } else {
      // Serve the main app
      res.sendFile('index.html', { root: 'dist/public' });
    }
  });

  app.get("/api/linkedin/status", async (req, res) => {
    try {
      const hasToken = !!process.env.LINKEDIN_ACCESS_TOKEN;
      const hasCredentials = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
      
      res.json({
        authenticated: hasToken,
        configured: hasCredentials,
        clientId: process.env.LINKEDIN_CLIENT_ID ? process.env.LINKEDIN_CLIENT_ID.substring(0, 8) + '...' : null
      });
    } catch (error: any) {
      console.error('Error getting LinkedIn status:', error);
      res.status(500).json({ error: 'Failed to get LinkedIn status' });
    }
  });

  app.post("/api/system/start-tracking", async (req, res) => {
    try {
      if (!schedulerService) {
        schedulerService = new SchedulerService();
        await schedulerService.initialize();
      }
      
      const status = schedulerService.getStatus();
      if (!status.isRunning) {
        await schedulerService.start();
      }
      
      res.json({ success: true, message: "Tracking started successfully" });
    } catch (error: any) {
      console.error("Error starting tracking:", error);
      res.status(500).json({ error: "Failed to start tracking" });
    }
  });

  const linkedinAuth = new LinkedInOAuth();
  const linkedinWebhook = new LinkedInWebhookService();
  const webhookHandler = WebhookHandler.getInstance();
  
  // LinkedIn webhook - Ultra simple for validation
  app.get("/api/linkedin/webhook", (req, res) => {
    const challenge = req.query.challenge;
    if (challenge) {
      res.status(200).send(challenge);
    } else {
      res.status(200).send('OK');
    }
  });
  
  app.post("/api/linkedin/webhook", (req, res) => {
    console.log('LinkedIn webhook event:', req.body);
    res.status(200).send('OK');
  });
  
  app.get("/api/linkedin/auth", (req, res) => {
    res.redirect(linkedinAuth.getAuthorizationUrl());
  });

  // TEMP: debug runtime paths to help locate persisted verification logs
  app.get('/internal/debug/cwd', (_req, res) => {
    try {
      res.json({ cwd: process.cwd(), dirname: __dirname, pid: process.pid });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/linkedin/callback", (req, res) => {
    linkedinAuth.handleCallback(req, res);
  });





  // Enhanced webhook endpoints
  app.post('/webhook/github', (req, res) => webhookHandler.handleGitHubWebhook(req, res));
  app.post('/webhook/generic', (req, res) => webhookHandler.handleGenericWebhook(req, res));
  
  // Test endpoint for webhook debugging
  app.get("/api/linkedin/webhook/test", (req, res) => {
    res.json({
      status: 'active',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      webhookSecret: process.env.LINKEDIN_WEBHOOK_SECRET ? 'configured' : 'missing'
    });
  });

  app.get("/api/system/status", async (req, res) => {
    try {
      const status = schedulerService ? schedulerService.getStatus() : { isRunning: false };
      res.json(status);
    } catch (error: any) {
      console.error("Error getting system status:", error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  // Refresh companies from Google Sheets
  app.post('/api/companies/refresh', async (req, res) => {
    try {
      console.log('🔄 Manual refresh of companies from Google Sheets requested...');

      // Clear existing companies and reload from Google Sheets
      await storage.clearSampleCompanies();

      // Import GoogleSheetsService directly
      const { GoogleSheetsService } = await import('./services/googleSheets');
      const googleSheetsService = new GoogleSheetsService();
      
      try {
        await googleSheetsService.initialize();
        await storage.syncCompaniesFromGoogleSheets(await googleSheetsService.getCompanies());
      } catch (sheetsError) {
        console.warn('⚠️ Google Sheets not available, using GoogleSheetsIntegrationService');
        const { GoogleSheetsIntegrationService } = await import('./services/googleSheetsIntegration');
        const integrationService = new GoogleSheetsIntegrationService();
        const companies = await integrationService.loadCompaniesFromSheet();
        
        for (const companyData of companies) {
          await storage.createCompany(companyData);
        }
      }

      const companies = await storage.getCompanies();

      res.json({
        success: true,
        message: `Successfully refreshed ${companies.length} companies from Google Sheets`,
        companiesCount: companies.length,
        companies: companies.map(c => ({ 
          name: c.name, 
          website: c.website, 
          isActive: c.isActive 
        }))
      });

    } catch (error: any) {
      console.error('❌ Failed to refresh companies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh companies from Google Sheets',
        details: (error as Error).message
      });
    }
  });

  // Settings endpoints
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = {
        jobCheckInterval: process.env.JOB_POSTING_CHECK_INTERVAL || '60',
        hireCheckInterval: process.env.NEW_HIRE_CHECK_INTERVAL || '15',
        analyticsInterval: process.env.TRACKING_INTERVAL_MINUTES || '15',
        slackEnabled: !!process.env.SLACK_BOT_TOKEN,
        emailEnabled: !!process.env.GMAIL_USER,
        maxRetries: process.env.MAX_RETRIES || '3',
        requestTimeout: process.env.REQUEST_TIMEOUT || '30000',
        maxConcurrent: process.env.MAX_CONCURRENT_REQUESTS || '5',
        stealthMode: process.env.USE_STEALTH_MODE === 'true',
        minDelay: process.env.MIN_DELAY_MS || '2000',
        maxDelay: process.env.MAX_DELAY_MS || '8000',
        linkedinEmail: process.env.LINKEDIN_EMAIL || '',
        slackChannel: process.env.SLACK_CHANNEL || '#job-alerts',
        emailRecipients: process.env.EMAIL_RECIPIENTS || '',
        googleSheetsId: process.env.GOOGLE_SHEETS_ID || '',
      };
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const settings = req.body;
      
      // Update environment variables (in memory)
      process.env.JOB_POSTING_CHECK_INTERVAL = settings.jobCheckInterval;
      process.env.NEW_HIRE_CHECK_INTERVAL = settings.hireCheckInterval;
      process.env.TRACKING_INTERVAL_MINUTES = settings.analyticsInterval;
      process.env.MAX_RETRIES = settings.maxRetries;
      process.env.REQUEST_TIMEOUT = settings.requestTimeout;
      process.env.MAX_CONCURRENT_REQUESTS = settings.maxConcurrent;
      process.env.USE_STEALTH_MODE = settings.stealthMode.toString();
      process.env.MIN_DELAY_MS = settings.minDelay;
      process.env.MAX_DELAY_MS = settings.maxDelay;
      process.env.LINKEDIN_EMAIL = settings.linkedinEmail;
      process.env.SLACK_CHANNEL = settings.slackChannel;
      process.env.EMAIL_RECIPIENTS = settings.emailRecipients;
      process.env.GOOGLE_SHEETS_ID = settings.googleSheetsId;
      
      console.log('✅ Settings updated successfully');
      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // Graceful shutdown handler
  const httpServer = createServer(app);

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    if (schedulerService) {
      await schedulerService.cleanup();
    }
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    if (schedulerService) {
      await schedulerService.cleanup();
    }
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });

  return httpServer;
}
