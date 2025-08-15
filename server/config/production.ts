/**
 * Production Configuration
 * Enterprise-grade settings for production deployment
 */

import os from 'os';

export const PRODUCTION_CONFIG = {
  // Security
  security: {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "https://api.linkedin.com"]
        }
      }
    }
  },

  // Performance
  performance: {
    compression: true,
    caching: {
      static: '1y',
      api: '5m',
      jobs: '1h'
    },
    database: {
      pool: {
        min: 2,
        max: 20,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      }
    }
  },

  // Monitoring
  monitoring: {
    healthCheck: {
      interval: 30000, // 30 seconds
      timeout: 5000,
      retries: 3
    },
    metrics: {
      enabled: true,
      endpoint: '/metrics',
      retention: '7d'
    },
    alerting: {
      enabled: true,
      channels: ['email', 'slack'],
      thresholds: {
        errorRate: 0.05,
        responseTime: 2000,
        memoryUsage: 0.8
      }
    }
  },

  // Scaling
  scaling: {
    workers: process.env.WEB_CONCURRENCY || os.cpus().length,
    maxMemory: process.env.MAX_MEMORY || '512MB',
    gracefulShutdown: {
      timeout: 30000,
      signals: ['SIGTERM', 'SIGINT']
    }
  }
} as const;

// Environment validation
export function validateProductionEnv() {
  const required = [
    'DATABASE_URL',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_SHEETS_ID',
    'SLACK_WEBHOOK_URL',
    'EMAIL_USER',
    'EMAIL_PASS',
    'LINKEDIN_USERNAME',
    'LINKEDIN_PASSWORD'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ All required environment variables are configured');
}
