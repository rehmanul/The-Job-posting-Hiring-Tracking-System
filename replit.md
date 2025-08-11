# Job Tracker System

## Overview

This is a comprehensive job tracking and new hire monitoring system that automatically scrapes job postings and tracks new hires across multiple companies. The system integrates with LinkedIn, Google Sheets, Slack, and email to provide real-time notifications and analytics. It features a modern web dashboard built with React and TypeScript for monitoring system health, viewing analytics, and managing tracked companies.

## Current Status (August 11, 2025)

✅ **Application is running successfully on port 5000**
✅ **Backend services initialized with graceful handling of missing credentials**
✅ **Frontend dashboard fully functional with real-time updates**
✅ **Scheduled tasks running (jobs every 15 min, hires every 60 min)**
✅ **Slack integration connected (needs proper bot scope permissions)**
✅ **All API endpoints responding correctly**
✅ **Fixed DOM nesting warnings in sidebar navigation**

**Ready for external API configuration**: Google Sheets, LinkedIn credentials, Gmail SMTP

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Components**: Radix UI primitives with shadcn/ui design system for consistent, accessible components
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Charts**: Recharts for data visualization and analytics dashboards

### Backend Architecture
- **Framework**: Express.js with TypeScript for API endpoints and middleware
- **Build System**: esbuild for production bundling and tsx for development
- **Database ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations
- **Scheduled Tasks**: node-cron for managing recurring scraping and monitoring tasks
- **Web Scraping**: Puppeteer with stealth plugins for LinkedIn and website scraping

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon Database serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema synchronization
- **Backup Storage**: Google Sheets integration for data backup and manual access
- **Session Storage**: connect-pg-simple for PostgreSQL-backed session management

### Authentication and Authorization
- **LinkedIn Authentication**: Credential-based login for LinkedIn scraping access
- **Service Account Authentication**: Google Service Account for Sheets API access
- **Session Management**: Express sessions with PostgreSQL storage
- **API Security**: Environment variable-based configuration for sensitive credentials

### External Service Integrations
- **LinkedIn Scraping**: Automated job posting and new hire detection using Puppeteer
- **Google Sheets**: Bidirectional data synchronization for backup and manual data access
- **Slack Integration**: Real-time notifications for new jobs and hires via Slack Web API
- **Email Notifications**: Gmail SMTP integration for email alerts and reports
- **Anti-Detection**: Stealth mode browsing with randomized delays and user agent rotation

### Monitoring and Health Systems
- **Health Monitoring**: Service health tracking with response time monitoring
- **System Analytics**: Performance metrics and success rate tracking
- **Error Handling**: Comprehensive logging with Winston and error recovery mechanisms
- **Real-time Updates**: WebSocket-style polling for live dashboard updates

## External Dependencies

### Third-Party Services
- **Neon Database**: PostgreSQL hosting for primary data storage
- **Google Sheets API**: Data backup and manual access interface
- **Slack Web API**: Team notifications and alerts
- **Gmail SMTP**: Email notification delivery
- **LinkedIn**: Job posting and hiring activity scraping (requires credentials)

### Key NPM Packages
- **Database**: `@neondatabase/serverless`, `drizzle-orm`, `drizzle-zod`
- **Web Scraping**: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`
- **Notifications**: `@slack/web-api`, `nodemailer`
- **Google Services**: `googleapis`
- **Scheduling**: `node-cron`
- **UI Framework**: `@radix-ui/*`, `@tanstack/react-query`
- **Styling**: `tailwindcss`, `class-variance-authority`
- **Development**: `vite`, `tsx`, `typescript`

### Environment Configuration
The system requires configuration for LinkedIn credentials, Google Service Account, Slack bot token, Gmail credentials, database URL, and Google Sheets ID. All sensitive data is managed through environment variables with validation checks during initialization.