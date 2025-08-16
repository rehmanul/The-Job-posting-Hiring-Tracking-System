#!/bin/bash
# JobTracker Expert - Server Deployment Commands

echo "🚀 JobTracker Expert Deployment Script"
echo "======================================="

# 1. System Update
echo "📦 Updating system..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 4. Install build essentials
echo "📦 Installing build tools..."
sudo apt-get install -y build-essential

# 5. Clone and setup project
echo "📁 Setting up project..."
git clone https://github.com/rehmanul/The-Job-posting-Hiring-Tracking-System.git jobtracker
cd jobtracker

# 6. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 7. Setup environment
echo "🔧 Setting up environment..."
cp .env.example .env
echo "⚠️  IMPORTANT: Edit .env file with your API credentials!"
echo "nano .env"

# 8. Build project
echo "🔨 Building project..."
npm run build

# 9. Start with PM2
echo "🚀 Starting application..."
pm2 start dist/index.js --name "jobtracker"
pm2 startup
pm2 save

# 10. Install and configure Nginx
echo "🌐 Setting up Nginx..."
sudo apt install nginx -y

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/jobtracker > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:54112;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/jobtracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 11. Setup SSL (Let's Encrypt)
echo "🔒 Setting up SSL..."
sudo apt install certbot python3-certbot-nginx -y
echo "⚠️  Run: sudo certbot --nginx -d your-domain.com"

# 12. Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file: nano .env"
echo "2. Replace 'your-domain.com' in Nginx config"
echo "3. Get SSL certificate: sudo certbot --nginx -d your-domain.com"
echo "4. Check status: pm2 status"
echo "5. View logs: pm2 logs jobtracker"
echo ""
echo "🌐 Access your application at: http://your-domain.com"