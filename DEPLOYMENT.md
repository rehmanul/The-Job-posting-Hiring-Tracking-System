# Deployment Guide

## Render.com Deployment

### 1. Connect Repository
1. Go to [render.com](https://render.com)
2. Connect your GitHub account
3. Select repository: `rehmanul/The-Job-posting-Hiring-Tracking-System`

### 2. Environment Variables (Required)
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=your_neon_postgres_url
GOOGLE_SHEETS_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=#job-alerts
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
OPENAI_API_KEY=sk-your-openai-api-key
```

### 3. Build Settings
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Node Version: 18+

## DigitalOcean Droplet (Production)

### 1. Server Setup
```bash
# Create droplet (Ubuntu 22.04)
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt update
sudo apt install nginx
```

### 2. Application Deployment
```bash
# Clone repository
git clone https://github.com/rehmanul/The-Job-posting-Hiring-Tracking-System.git
cd The-Job-posting-Hiring-Tracking-System

# Install dependencies
npm install

# Build application
npm run build

# Start with PM2
pm2 start npm --name "jobtracker" -- start
pm2 startup
pm2 save
```

### 3. Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. SSL Certificate
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Webhook URLs
- **Render**: `https://your-app.onrender.com/webhook/*`
- **DigitalOcean**: `https://your-domain.com/webhook/*`