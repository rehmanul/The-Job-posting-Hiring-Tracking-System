# JobTracker Expert - Deployment Guide

## 🚀 Server Deployment Commands

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended)
- Domain with SSL certificate

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install build essentials
sudo apt-get install -y build-essential
```

### 2. Project Deployment
```bash
# Clone repository
git clone https://github.com/your-username/JobTracker-Expert.git
cd JobTracker-Expert

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your actual credentials
nano .env

# Build project
npm run build

# Start with PM2
pm2 start dist/index.js --name "jobtracker"
pm2 startup
pm2 save
```

### 3. Nginx Configuration
```bash
# Install Nginx
sudo apt install nginx -y

# Create site configuration
sudo nano /etc/nginx/sites-available/jobtracker
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:54112;
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

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/jobtracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 5. Firewall Setup
```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 6. Database Setup (Neon)
1. Create account at https://neon.tech
2. Create new project
3. Copy connection string to .env as DATABASE_URL

### 7. Monitoring Commands
```bash
# Check PM2 status
pm2 status
pm2 logs jobtracker

# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# Check system resources
htop
df -h
free -h

# Restart services
pm2 restart jobtracker
sudo systemctl restart nginx
```

### 8. Maintenance Commands
```bash
# Update application
git pull origin main
npm install
npm run build
pm2 restart jobtracker

# View logs
pm2 logs jobtracker --lines 100
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

### Required APIs
- **LinkedIn**: Client ID, Secret, Access Token
- **Google Sheets**: Service Account, Private Key
- **Google Search**: API Key, Search Engine ID
- **Slack**: Bot Token, Webhook URL
- **Email**: Gmail credentials

### Optional Services
- **Gemini AI**: For enhanced job classification
- **Proxy Services**: For rate limiting bypass

## 📊 Production Checklist

- [ ] All environment variables configured
- [ ] Database connection working
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] PM2 process running
- [ ] Nginx proxy working
- [ ] Google Sheets accessible
- [ ] LinkedIn API authenticated
- [ ] Slack notifications working
- [ ] Email alerts configured

## 🚨 Troubleshooting

### Common Issues
1. **Port 54112 in use**: `sudo lsof -i :54112` then kill process
2. **Build fails**: Check Node.js version (18+)
3. **Database connection**: Verify DATABASE_URL format
4. **LinkedIn API**: Check token expiration
5. **Google Sheets**: Verify service account permissions

### Log Locations
- Application: `pm2 logs jobtracker`
- Nginx: `/var/log/nginx/`
- System: `journalctl -u nginx`