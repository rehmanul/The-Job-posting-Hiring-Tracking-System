# Step-by-Step DigitalOcean Deployment

## 🔗 Step 1: Connect to Your Droplet

### Option A: Using DigitalOcean Console (Easiest)
1. Go to your DigitalOcean dashboard
2. Click on your droplet name
3. Click **"Access console"** button
4. Wait for console to load
5. Login as `root` (password sent to your email)

### Option B: Using SSH (Recommended)
1. Open terminal/command prompt
2. Connect to your droplet:
```bash
ssh root@YOUR_DROPLET_IP
```
3. Enter password when prompted

## 🚀 Step 2: Deploy from GitHub

### Copy and paste this ONE command:
```bash
curl -sSL https://raw.githubusercontent.com/rehmanul/The-Job-posting-Hiring-Tracking-System/main/deploy-digitalocean.sh | bash
```

**What this does:**
- Updates Ubuntu 25.04
- Installs Node.js 20
- Installs PM2 (process manager)
- Installs Nginx (web server)
- Downloads your code from GitHub
- Builds the application
- Configures everything automatically

## ⚙️ Step 3: Configure Your Credentials

### Edit environment file:
```bash
nano /var/www/jobtracker/.env
```

### Replace these with YOUR actual values:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@host:port/database
GOOGLE_SHEETS_ID=your_actual_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
your_actual_private_key_here
-----END PRIVATE KEY-----"
SLACK_BOT_TOKEN=xoxb-your-actual-slack-token
SLACK_CHANNEL=#job-alerts
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
OPENAI_API_KEY=sk-your-actual-openai-key
```

### Save and exit:
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

## 🔄 Step 4: Start the Application

```bash
cd /var/www/jobtracker
pm2 restart all
```

## ✅ Step 5: Verify Everything Works

### Check if app is running:
```bash
pm2 status
```

### Test your application:
```bash
curl http://localhost:3000
```

### Check logs if there are issues:
```bash
pm2 logs
```

## 🌐 Step 6: Get Your URLs

### Find your droplet IP:
```bash
curl ifconfig.me
```

### Your application URLs:
- **Main App**: `http://YOUR_DROPLET_IP`
- **Webhook**: `http://YOUR_DROPLET_IP/api/linkedin/webhook`

## 🔧 Step 7: Test Webhook

```bash
curl "http://YOUR_DROPLET_IP/api/linkedin/webhook?challenge=test123"
```
Should return: `test123`

## 📱 Step 8: Access Your App

1. Open browser
2. Go to `http://YOUR_DROPLET_IP`
3. You should see your JobTracker dashboard!

## 🚨 Troubleshooting

### If deployment fails:
```bash
cd /var/www/jobtracker
npm install
npm run build
pm2 restart all
```

### If app won't start:
```bash
pm2 logs --lines 50
```

### If webhook doesn't work:
```bash
sudo systemctl status nginx
sudo nginx -t
```

## 🔄 Future Updates

### To update your app with new code:
```bash
cd /var/www/jobtracker
git pull origin main
npm run build
pm2 restart all
```

---

## 📋 Quick Reference Commands

```bash
# Check app status
pm2 status

# View logs
pm2 logs

# Restart app
pm2 restart all

# Check system resources
htop

# Check disk space
df -h
```

**Total time: 5-10 minutes**
**Your app will be live at: http://YOUR_DROPLET_IP**