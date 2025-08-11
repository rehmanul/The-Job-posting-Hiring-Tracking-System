import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

import { JobTrackerService } from './services/jobTracker';
import { HealthMonitorService } from './services/healthMonitor';
import { SchedulerService } from './scheduler';
import { storage } from './storage';

const jobTracker = new JobTrackerService();
const healthMonitor = new HealthMonitorService();
const scheduler = new SchedulerService();


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

async function startServer() {
  try {
    console.log('🚀 Starting Job Tracker Application...');

    // Validate Google Sheets configuration
    if (!process.env.GOOGLE_SHEETS_ID) {
      console.warn('⚠️ GOOGLE_SHEETS_ID not found - Google Sheets integration will be disabled');
    } else if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.warn('⚠️ Google Service Account credentials missing - Google Sheets integration will be disabled');
      console.log('📋 To enable Google Sheets: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in Secrets');
    } else {
      console.log('✅ Google Sheets credentials found');
    }

    // Initialize services with error handling
    let serviceErrors = [];

    try {
      await jobTracker.initialize();
      console.log('✅ Job Tracker Service initialized');
    } catch (error) {
      console.error('⚠️ Job Tracker Service failed to initialize:', error.message);
      console.log('💡 This is likely due to Google Sheets credentials. The app will continue without Google Sheets integration.');
      serviceErrors.push('JobTracker');
    }

    try {
      await healthMonitor.initialize();
      console.log('✅ Health Monitor Service initialized');
    } catch (error) {
      console.error('⚠️ Health Monitor Service failed to initialize:', error);
      serviceErrors.push('HealthMonitor');
    }

    try {
      await scheduler.initialize();
      scheduler.start();
      console.log('✅ Scheduler Service initialized and started');
    } catch (error) {
      console.error('⚠️ Scheduler Service failed to initialize:', error.message);
      console.log('💡 This is likely due to Google Sheets credentials. The app will continue without scheduled tasks.');
      serviceErrors.push('Scheduler');
    }

    if (serviceErrors.length > 0) {
      console.warn(`⚠️ Some services failed to initialize: ${serviceErrors.join(', ')}`);
      console.warn('🔧 System will continue running with available services');
    }

    console.log('✅ Application started successfully');

    // Try to verify companies were loaded
    try {
      const companies = await storage.getCompanies();
      console.log(`📊 System configured with ${companies.length} companies for tracking`);
    } catch (error) {
      console.warn('⚠️ Could not verify company configuration:', error);
    }

  } catch (error) {
    console.error('❌ Critical failure during application startup:', error);
    console.warn('🔧 Attempting to start web server anyway...');
    // Don't exit, let the web server start so users can access the dashboard
  }
}


(async () => {
  await startServer(); // Call the new startServer function
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();