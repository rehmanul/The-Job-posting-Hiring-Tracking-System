import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { SchedulerService } from "./scheduler";
import { insertCompanySchema } from "@shared/schema";

let schedulerService: SchedulerService | null = null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize scheduler service
  schedulerService = new SchedulerService();
  await schedulerService.initialize();
  await schedulerService.start();

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

      const stats = {
        companiesTracked: companies.length,
        newJobsToday: todayJobs.length,
        newHiresToday: todayHires.length,
        successRate: 96.8, // TODO: Calculate from actual metrics
        lastScanTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
      };

      res.json(stats);
    } catch (error) {
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
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // Companies endpoints
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.json(company);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error resuming system:", error);
      res.status(500).json({ error: "Failed to resume system" });
    }
  });

  app.get("/api/system/status", async (req, res) => {
    try {
      const status = schedulerService ? schedulerService.getStatus() : { isRunning: false };
      res.json(status);
    } catch (error) {
      console.error("Error getting system status:", error);
      res.status(500).json({ error: "Failed to get system status" });
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
