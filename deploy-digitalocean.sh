#!/bin/bash

# DigitalOcean One-Shot Deployment Script
echo "🚀 Starting JobTracker Expert deployment on DigitalOcean..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Create app directory
sudo mkdir -p /var/www/jobtracker
sudo chown -R $USER:$USER /var/www/jobtracker

# Clone repository
cd /var/www
git clone https://github.com/rehmanul/The-Job-posting-Hiring-Tracking-System.git jobtracker
cd jobtracker

# Install dependencies
npm install

# Build application
npm run build

# Create environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=your_neon_postgres_url
GOOGLE_SHEETS_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=#job-alerts
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
OPENAI_API_KEY=sk-your-openai-api-key
EOF

echo "⚠️  IMPORTANT: Edit /var/www/jobtracker/.env with your actual credentials"

# Start with PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Configure Nginx
sudo cp nginx.conf /etc/nginx/sites-available/jobtracker
sudo ln -sf /etc/nginx/sites-available/jobtracker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Start services
sudo systemctl restart nginx
sudo systemctl enable nginx

# Setup firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Deployment complete!"
echo "🌐 Your app is running at: http://$(curl -s ifconfig.me)"
echo "🔗 Webhook URL: http://$(curl -s ifconfig.me)/api/linkedin/webhook"
echo ""
echo "📝 Next steps:"
echo "1. Edit /var/www/jobtracker/.env with your credentials"
echo "2. Run: pm2 restart all"
echo "3. Setup SSL: sudo certbot --nginx -d your-domain.com"