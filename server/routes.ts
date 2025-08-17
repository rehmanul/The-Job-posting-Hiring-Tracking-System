import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "./storage";
import { SchedulerService } from "./scheduler";
import { JobTrackerService } from "./services/jobTracker";
import { ScheduledTracker } from "./services/scheduledTracker";

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
let enhancedTracker: any = null; // Professional tracker instance

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

  // Manual health check trigger
  app.post("/api/health/check", async (req, res) => {
    try {
      if (schedulerService) {
        const { HealthMonitorService } = await import('./services/healthMonitor');
        const healthMonitor = new HealthMonitorService();
        await healthMonitor.initialize();
        await healthMonitor.performHealthChecks();
        
        const health = await healthMonitor.getSystemHealth();
        res.json({ success: true, health });
      } else {
        res.status(500).json({ error: "Scheduler service not available" });
      }
    } catch (error: any) {
      console.error("Error performing health check:", error);
      res.status(500).json({ error: "Failed to perform health check" });
    }
  });

  // Get system health status
  app.get("/api/health/status", async (req, res) => {
    try {
      const { HealthMonitorService } = await import('./services/healthMonitor');
      const healthMonitor = new HealthMonitorService();
      await healthMonitor.initialize();
      
      const health = await healthMonitor.getSystemHealth();
      res.json(health);
    } catch (error: any) {
      console.error("Error getting health status:", error);
      res.status(500).json({ error: "Failed to get health status" });
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
      if (schedulerService) {
        await schedulerService.start();
      }
      
      res.json({ 
        success: true, 
        message: "Real tracking started with working services",
        config: {
          mode: "Production",
          services: ["AggressiveHireTracker", "WebsiteScraper", "LinkedInScraper"],
          frequency: "Continuous"
        }
      });
    } catch (error: any) {
      console.error("Error starting tracking:", error);
      res.status(500).json({ error: "Failed to start tracking" });
    }
  });

  app.post("/api/system/stop-tracking", async (req, res) => {
    try {
      if (schedulerService) {
        await schedulerService.stop();
      }
      
      res.json({ 
        success: true, 
        message: "Tracking stopped successfully"
      });
    } catch (error: any) {
      console.error("Error stopping tracking:", error);
      res.status(500).json({ error: "Failed to stop tracking" });
    }
  });

  const linkedinAuth = new LinkedInOAuth();
  const linkedinWebhook = new LinkedInWebhookService();
  const webhookHandler = WebhookHandler.getInstance();
  
  // Professional LinkedIn webhook with advanced processing
  app.get("/webhook", async (req, res) => {
    const { challengeCode } = req.query;
    
    if (challengeCode) {
      try {
        const { ProfessionalLinkedInWebhook } = await import('./services/professionalLinkedInWebhook');
        const webhookHandler = new ProfessionalLinkedInWebhook();
        const response = await webhookHandler.handleChallenge(challengeCode as string);
        
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(response);
      } catch (error) {
        console.error('Professional webhook challenge error:', error);
        return res.status(500).json({ error: 'Challenge validation failed' });
      }
    }
    
    res.status(200).send('OK');
  });
  
  app.post("/webhook", async (req, res) => {
    try {
      const signature = req.headers['x-li-signature'] as string;
      const body = JSON.stringify(req.body);
      
      const { ProfessionalLinkedInWebhook } = await import('./services/professionalLinkedInWebhook');
      const webhookHandler = new ProfessionalLinkedInWebhook();
      
      await webhookHandler.handleNotification(body, signature);
      res.status(200).send('OK');
      
    } catch (error) {
      console.error('Professional webhook processing error:', error);
      res.status(500).send('Error');
    }
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
      const status = {
        isRunning: schedulerService ? true : false,
        mode: 'Production',
        services: ['AggressiveHireTracker', 'WebsiteScraper', 'LinkedInScraper']
      };
      res.json(status);
    } catch (error: any) {
      console.error("Error getting system status:", error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  app.get("/api/google-talent/test", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_CLOUD_TALENT_API_KEY;
      const customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      
      // Test Google Custom Search API (which we actually use)
      let customSearchWorking = false;
      if (customSearchKey) {
        try {
          const testUrl = `https://www.googleapis.com/customsearch/v1?key=${customSearchKey}&cx=${process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID}&q=test&num=1`;
          const response = await fetch(testUrl);
          customSearchWorking = response.ok;
        } catch (e) {
          customSearchWorking = false;
        }
      }
      
      res.json({ 
        googleTalentAPI: {
          configured: !!apiKey,
          apiKey: apiKey ? apiKey.substring(0, 10) + '...' : 'missing'
        },
        googleCustomSearch: {
          configured: !!customSearchKey,
          working: customSearchWorking,
          apiKey: customSearchKey ? customSearchKey.substring(0, 10) + '...' : 'missing'
        },
        geminiAPI: {
          configured: !!geminiKey,
          apiKey: geminiKey ? geminiKey.substring(0, 10) + '...' : 'missing'
        },
        recommendation: customSearchWorking ? 'Google Custom Search is working - system will find real names' : 'APIs not properly configured'
      });
    } catch (error: any) {
      res.json({ connected: false, error: error.message });
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
          linkedinUrl: c.linkedinUrl,
          careerPageUrl: c.careerPageUrl,
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
      const { EnvironmentService } = await import('./services/environmentService');
      const envService = new EnvironmentService();
      
      const envVars = await envService.getEnvironmentVariables();
      const schema = envService.getSettingsSchema();
      
      const settings: Record<string, any> = {};
      
      for (const [key, config] of Object.entries(schema)) {
        settings[key] = {
          value: envVars[key] || config.default || '',
          ...config
        };
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const settings = req.body;
      
      const { EnvironmentService } = await import('./services/environmentService');
      const envService = new EnvironmentService();
      
      // Prepare environment variables for update
      const envUpdates: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(settings)) {
        if (typeof value === 'object' && value !== null && 'value' in value) {
          envUpdates[key] = (value as any).value;
        } else {
          envUpdates[key] = String(value);
        }
      }
      
      // Update .env file and process.env
      const success = await envService.updateMultipleEnvironmentVariables(envUpdates);
      
      if (success) {
        console.log('✅ Settings updated successfully in .env file');
        res.json({ success: true, message: 'Settings updated successfully and saved to .env file' });
      } else {
        res.status(500).json({ success: false, error: 'Failed to update .env file' });
      }
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
