# DigitalOcean Deployment Guide

## 🚀 One-Shot Deployment

### 1. Create Droplet
- **OS**: Ubuntu 22.04 LTS
- **Size**: Basic $6/month (1GB RAM, 1 vCPU)
- **Region**: Choose closest to your users
- **Authentication**: SSH Key (recommended)

### 2. Deploy Application
```bash
# SSH into your droplet
ssh root@your_droplet_ip

# Run one-shot deployment script
curl -sSL https://raw.githubusercontent.com/rehmanul/The-Job-posting-Hiring-Tracking-System/main/deploy-digitalocean.sh | bash
```

### 3. Configure Environment
```bash
# Edit environment variables
nano /var/www/jobtracker/.env

# Add your actual credentials:
DATABASE_URL=postgresql://username:password@host:port/database
GOOGLE_SHEETS_ID=your_actual_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_actual_private_key\n-----END PRIVATE KEY-----\n"
SLACK_BOT_TOKEN=xoxb-your-actual-slack-token
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
OPENAI_API_KEY=sk-your-actual-openai-key
```

### 4. Restart Application
```bash
cd /var/www/jobtracker
pm2 restart all
pm2 logs --lines 50
```

### 5. Setup Domain (Optional)
```bash
# Point your domain to droplet IP
# Install SSL certificate
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Update Nginx config for domain
sudo nano /etc/nginx/sites-available/jobtracker
# Change server_name _ to server_name your-domain.com;
sudo nginx -t && sudo systemctl reload nginx
```

## 🔗 URLs After Deployment

- **Application**: `http://your_droplet_ip`
- **Webhook**: `http://your_droplet_ip/api/linkedin/webhook`
- **With Domain**: `https://your-domain.com/api/linkedin/webhook`

## 📊 Management Commands

```bash
# Check application status
pm2 status
pm2 logs jobtracker-expert

# Restart application
pm2 restart jobtracker-expert

# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# View logs
tail -f /var/log/pm2/jobtracker.log
tail -f /var/log/nginx/access.log

# Update application
cd /var/www/jobtracker
git pull origin main
npm run build
pm2 restart all
```

## 🔧 Troubleshooting

### Application Won't Start
```bash
cd /var/www/jobtracker
npm run build
pm2 restart all
pm2 logs --lines 100
```

### Webhook Not Working
```bash
# Test webhook endpoint
curl http://your_droplet_ip/api/linkedin/webhook?challenge=test123

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Database Connection Issues
```bash
# Verify environment variables
cat /var/www/jobtracker/.env
pm2 restart all
```

## 🛡️ Security Checklist

- ✅ Firewall configured (UFW)
- ✅ SSH key authentication
- ✅ Nginx security headers
- ✅ SSL certificate (if domain used)
- ✅ Environment variables secured

## 📈 Monitoring

```bash
# System resources
htop
df -h
free -h

# Application metrics
pm2 monit

# Nginx status
sudo systemctl status nginx
```

## 🔄 Backup Strategy

```bash
# Backup database (if using local PostgreSQL)
pg_dump your_database > backup_$(date +%Y%m%d).sql

# Backup application files
tar -czf jobtracker_backup_$(date +%Y%m%d).tar.gz /var/www/jobtracker
```

---

**Total deployment time: ~5 minutes**
**Monthly cost: $6 (Basic Droplet)**