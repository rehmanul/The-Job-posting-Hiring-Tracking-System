/**
 * Production Environment Validation
 * Enterprise-grade environment configuration validation
 */

import os from 'os';

export const PRODUCTION_CONFIG = {
  // Environment validation
  environment: {
    required: [
      'DATABASE_URL',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_SHEETS_ID',
      'SLACK_WEBHOOK_URL',
      'EMAIL_USER',
      'EMAIL_PASS',
      'LINKEDIN_USERNAME',
      'LINKEDIN_PASSWORD'
    ],
    optional: [
      'PORT',
      'WEB_CONCURRENCY',
      'MAX_MEMORY'
    ]
  },

  // Security configuration
  security: {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
    }
  },

  // Performance configuration
  performance: {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
    }
  },

  // Monitoring configuration
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

  // Scaling configuration
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
