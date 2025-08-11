
# Job Tracker Pro

A comprehensive job tracking and hiring analytics system that automatically monitors job postings and tracks new hires across multiple companies. Built with React, TypeScript, Node.js, and PostgreSQL.

![Job Tracker Dashboard](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Features

### Core Functionality
- **Automated Job Tracking**: Scrapes job postings from company career pages
- **Hire Monitoring**: Tracks new employee announcements and LinkedIn updates
- **Real-time Analytics**: Comprehensive dashboards with hiring trends and insights
- **ML-Powered Detection**: AI-enhanced job classification and candidate analysis
- **Multi-Platform Integration**: Google Sheets, Slack, Email notifications

### Advanced Capabilities
- **Smart Scheduling**: Configurable scraping intervals with intelligent rate limiting
- **Anti-Detection**: Proxy rotation and stealth browsing for reliable data collection
- **Health Monitoring**: System status tracking with performance metrics
- **Mobile PWA**: Progressive Web App with offline capabilities
- **Data Export**: CSV/Excel export and Google Sheets synchronization

## 🏗️ Architecture

### Frontend (Client)
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Shadcn/ui** component library
- **React Query** for data fetching
- **Wouter** for lightweight routing
- **PWA** support with service workers

### Backend (Server)
- **Express.js** with TypeScript
- **PostgreSQL** with Drizzle ORM
- **Puppeteer** for web scraping
- **Winston** for logging
- **Node-cron** for scheduling

### External Integrations
- **Google Sheets API** - Data backup and manual access
- **Slack Web API** - Team notifications
- **Gmail SMTP** - Email alerts
- **OpenAI API** - ML-powered job analysis
- **LinkedIn** - Professional network scraping

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database (Neon recommended)
- Google Service Account (for Sheets integration)
- Slack Bot Token (for notifications)
- OpenAI API Key (for ML features)

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file or use Replit Secrets:

```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Google Sheets Integration
GOOGLE_SHEETS_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=#job-alerts

# Email Notifications
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password

# AI Features
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Proxy Configuration
PROXY_LIST=proxy1:port,proxy2:port
```

### 2. Installation

```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Start development server
npm run dev
```

### 3. Production Deployment

```bash
# Build application
npm run build

# Start production server
npm start
```

## 📊 Usage

### Dashboard Overview
- **System Status**: Real-time health monitoring
- **Job Statistics**: Latest postings and hiring trends
- **Company Metrics**: Tracking performance per organization
- **Recent Activity**: Live feed of new jobs and hires

### Managing Companies
1. Navigate to **Companies** page
2. Add companies via Google Sheets or manual entry
3. Configure tracking settings and scraping intervals
4. Monitor company-specific analytics

### Job Tracking
- Automatic detection of new job postings
- ML-powered job classification (title, department, seniority)
- Duplicate detection and content analysis
- Export capabilities for further analysis

### Hire Monitoring
- LinkedIn announcement tracking
- New employee detection
- Executive hire notifications
- Team growth analytics

## 🔧 Configuration

### Google Sheets Setup
1. Create a Google Service Account
2. Generate and download private key
3. Share your tracking sheet with the service account email
4. Set up columns: Company Name, Industry, Size, Location, Website, LinkedIn URL

### Slack Integration
1. Create a Slack app at api.slack.com
2. Add bot token scopes: `chat:write`, `channels:read`
3. Install app to workspace
4. Configure channel for notifications

### Email Notifications
1. Enable 2FA on Gmail account
2. Generate app-specific password
3. Configure SMTP settings in environment

## 📱 Mobile App (PWA)

Access the mobile-optimized interface at `/mobile`:
- **Offline Support**: View cached data without internet
- **Push Notifications**: Real-time job and hire alerts
- **Quick Actions**: Fast refresh and basic filtering
- **Touch-Friendly**: Optimized for mobile interaction

## 🔒 Security Features

- **Environment Variable Protection**: Sensitive data in secure storage
- **Rate Limiting**: Prevents API abuse and detection
- **Proxy Rotation**: Distributed scraping for anonymity
- **Session Management**: Secure user authentication
- **HTTPS Enforcement**: Encrypted data transmission

## 📈 Analytics & Reporting

### Available Metrics
- Job posting frequency and trends
- Hiring velocity by company/department
- Market competitiveness analysis
- Skill demand patterns
- Geographic hiring distribution

### Export Options
- CSV/Excel downloads
- Google Sheets synchronization
- Slack report summaries
- Email digest reports

## 🛠️ Development

### Project Structure
```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and config
├── server/                 # Node.js backend
│   ├── services/           # Business logic services
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database operations
│   └── scheduler.ts        # Cron job management
├── shared/                 # Shared TypeScript schemas
└── public/                 # Static assets
```

### Available Scripts
```bash
npm run dev         # Development server with hot reload
npm run build       # Production build
npm run start       # Production server
npm run check       # TypeScript type checking
npm run db:push     # Database schema migration
```

### API Endpoints
```
GET  /api/dashboard/stats     # Dashboard statistics
GET  /api/companies          # Company list
GET  /api/jobs               # Job postings
GET  /api/hires              # Hire announcements
GET  /api/system/status      # System health
POST /api/companies          # Add new company
```

## 🔧 Troubleshooting

### Common Issues

**Browser Launch Failure (Puppeteer)**
```bash
# Install required system libraries
sudo apt-get install -y libcups2-dev libdrm2 libxss1 libgconf-2-4
```

**Database Connection Issues**
- Verify DATABASE_URL format
- Check Neon database status
- Ensure network connectivity

**Google Sheets Integration**
- Verify service account permissions
- Check sheet sharing settings
- Validate private key format

**Slack Notifications**
- Confirm bot token permissions
- Verify channel access
- Check app installation status

### Performance Optimization
- Adjust scraping intervals based on company size
- Enable proxy rotation for large-scale operations
- Configure caching for frequently accessed data
- Monitor system resources and scale accordingly

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Check the troubleshooting guide
- Review the API documentation

## 🚀 Roadmap

- [ ] Enhanced ML job classification
- [ ] Integration with more job boards
- [ ] Advanced analytics dashboards
- [ ] Team collaboration features
- [ ] Mobile native app
- [ ] API rate limiting improvements

---

**Built with ❤️ for modern recruitment teams**

*Last updated: January 2024*
