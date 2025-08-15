#!/bin/bash

# DigitalOcean Deployment Script
echo "🚀 Starting JobTracker Expert deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 and Nginx
sudo npm install -g pm2
sudo apt install nginx -y

# Clone and setup application
git clone https://github.com/rehmanul/The-Job-posting-Hiring-Tracking-System.git /var/www/jobtracker
cd /var/www/jobtracker

# Install dependencies and build
npm install
npm run build

# Setup PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Configure Nginx
sudo cp nginx.conf /etc/nginx/sites-available/jobtracker
sudo ln -s /etc/nginx/sites-available/jobtracker /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Setup firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Deployment complete!"
echo "🌐 Application running on http://your-server-ip"