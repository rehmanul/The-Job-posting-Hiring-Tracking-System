import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
// import { setupVite, serveStatic, log } from "./vite";
import { serveStatic } from "./vite";

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Services initialized in routes.ts


const app = express();
// Accept plain text bodies (LinkedIn may send the verification challenge as text/plain)
app.use(express.text({ type: 'text/*', limit: '1mb' }));
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



(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  serveStatic(app);

  // Start server first
  // Support Render and other platforms that provide PORT
  const port = parseInt(process.env.PORT || process.env.SERVER_PORT || '3000', 10);
  // Bind to 0.0.0.0 so external tunnels (ngrok) and IPv6/other interfaces can reach the server
  server.listen(port, "0.0.0.0", () => {
    console.log(`\n🚀 Server running on http://localhost:${port}`);
    console.log(`📊 Dashboard: http://localhost:${port}`);
    console.log(`⚙️  Settings: http://localhost:${port}/settings`);
    log(`serving on port ${port}`);
    
    // Services already initialized in routes.ts
  });
})();
