/**
 * Production Middleware Stack
 * Enterprise-grade middleware for security, performance, and monitoring
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

export const productionMiddleware = {
  // Security middleware
  security: {
    helmet: helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "https://media.licdn.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", "https://api.linkedin.com", "https://www.linkedin.com"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }),

    rateLimit: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP',
        retryAfter: 15 * 60
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),

    cors: (req: any, res: any, next: any) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
      const origin = req.headers.origin;
      
      if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    }
  },

  // Performance middleware
  performance: {
    compression: compression({
      level: 6,
      threshold: 100 * 1024, // compress responses over 100KB
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }),

    caching: (req: any, res: any, next: any) => {
      // Cache static assets for 1 year
      if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      
      // Cache API responses for 5 minutes
      if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'public, max-age=300');
      }
      
      next();
    },

    requestId: (req: any, res: any, next: any) => {
      req.id = uuidv4();
      res.setHeader('X-Request-ID', req.id);
      next();
    }
  },

  // Logging middleware
  logging: {
    access: morgan('combined', {
      skip: (req) => req.path === '/health' || req.path === '/metrics'
    }),

    error: (err: any, req: any, res: any, next: any) => {
      console.error({
        requestId: req.id,
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      next(err);
    }
  },

  // Health check middleware
  health: {
    check: (req: any, res: any, next: any) => {
      if (req.path === '/health') {
        const health = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.env.npm_package_version || '1.0.0'
        };
        
        res.json(health);
        return;
      }
      
      next();
    }
  }
};
