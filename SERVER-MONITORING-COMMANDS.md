# Job Tracker Server Monitoring Commands

## 🚀 PM2 Process Management

### Status & Monitoring
```bash
pm2 status                    # Check if running
pm2 list                      # List all processes
pm2 monit                     # Real-time CPU/memory monitor
pm2 info job-tracker          # Detailed process info
```

### Logs
```bash
pm2 logs job-tracker          # Live logs (Ctrl+C to exit)
pm2 logs job-tracker --lines 50   # Last 50 lines
pm2 logs job-tracker --err    # Error logs only
pm2 logs job-tracker --out    # Output logs only
pm2 flush job-tracker         # Clear logs
```

### Process Control
```bash
pm2 restart job-tracker       # Restart tracker
pm2 reload job-tracker        # Graceful reload
pm2 stop job-tracker          # Stop tracker
pm2 start job-tracker         # Start tracker
pm2 delete job-tracker        # Remove from PM2
```

### Configuration
```bash
pm2 save                      # Save current processes
pm2 resurrect                 # Restore saved processes
pm2 startup                   # Setup auto-start on boot
pm2 unstartup                 # Remove auto-start
```

## 🖥️ System Health Monitoring

### Resource Usage
```bash
htop                          # Interactive process viewer
top                           # Basic process viewer
free -h                       # Memory usage
df -h                         # Disk space
du -sh *                      # Directory sizes
```

### Network & Ports
```bash
netstat -tlnp | grep 3000     # Check port 3000
netstat -tlnp | grep nginx    # Check nginx ports
ss -tulpn                     # Modern netstat alternative
```

### Web Service Health
```bash
# Test local server
curl -I http://localhost:3000
curl http://localhost:3000/api/dashboard/stats

# Test public domain
curl -I https://boostkit-jobtracker.duckdns.org/
curl https://boostkit-jobtracker.duckdns.org/api/dashboard/stats
```

## 🌐 Nginx & SSL Management

### Nginx Control
```bash
systemctl status nginx        # Check nginx status
systemctl start nginx         # Start nginx
systemctl stop nginx          # Stop nginx
systemctl restart nginx       # Restart nginx
systemctl reload nginx        # Reload config
```

### Configuration
```bash
nginx -t                      # Test configuration
nginx -s reload               # Reload config
cat /etc/nginx/sites-available/jobtracker  # View config
nano /etc/nginx/sites-available/jobtracker # Edit config
```

### SSL Certificate
```bash
certbot certificates          # Check SSL certificates
certbot renew                 # Renew certificates
certbot --nginx -d boostkit-jobtracker.duckdns.org  # Setup SSL
```

## 🔗 Remote Access from Local Terminal

### SSH Connection
```bash
# Basic connection
ssh root@188.166.159.138

# With specific key
ssh -i /path/to/key.pem root@188.166.159.138

# With custom port (if changed)
ssh -p 2222 root@188.166.159.138
```

### Remote Commands (No SSH Session)
```bash
# Quick status check
ssh root@188.166.159.138 "pm2 status"

# View logs remotely
ssh root@188.166.159.138 "pm2 logs job-tracker --lines 20"

# Restart service remotely
ssh root@188.166.159.138 "pm2 restart job-tracker"

# Check system resources
ssh root@188.166.159.138 "free -h && df -h"

# Full health check
ssh root@188.166.159.138 "pm2 status && curl -s http://localhost:3000/api/dashboard/stats"
```

### SSH Key Setup (One-time)
```bash
# Generate SSH key on local machine
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Copy key to server
ssh-copy-id root@188.166.159.138

# Or manually copy
cat ~/.ssh/id_rsa.pub | ssh root@188.166.159.138 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

## ⚡ Quick Aliases (Add to ~/.bashrc or ~/.zshrc)

```bash
# Server connection
alias jobserver="ssh root@188.166.159.138"

# Quick monitoring
alias jobstatus="ssh root@188.166.159.138 'pm2 status'"
alias joblogs="ssh root@188.166.159.138 'pm2 logs job-tracker --lines 20'"
alias jobhealth="ssh root@188.166.159.138 'pm2 status && curl -s http://localhost:3000/api/dashboard/stats'"

# Service control
alias jobrestart="ssh root@188.166.159.138 'pm2 restart job-tracker'"
alias jobstop="ssh root@188.166.159.138 'pm2 stop job-tracker'"
alias jobstart="ssh root@188.166.159.138 'pm2 start job-tracker'"

# System monitoring
alias jobsystem="ssh root@188.166.159.138 'free -h && df -h && pm2 status'"
```

## 🔧 Troubleshooting Commands

### When Service is Down
```bash
# Check if process exists
ps aux | grep node

# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs job-tracker --err --lines 50

# Restart everything
pm2 restart job-tracker
systemctl reload nginx
```

### When Website Not Loading
```bash
# Test local server
curl -I http://localhost:3000

# Check nginx
systemctl status nginx
nginx -t

# Check firewall
ufw status

# Check SSL
curl -I https://boostkit-jobtracker.duckdns.org/
```

### Performance Issues
```bash
# Check system resources
htop
free -h
df -h

# Check PM2 memory usage
pm2 monit

# Restart if high memory usage
pm2 restart job-tracker
```

## 📊 Health Check Script

Create a quick health check:
```bash
#!/bin/bash
echo "=== Job Tracker Health Check ==="
echo "PM2 Status:"
pm2 status
echo -e "\nAPI Response:"
curl -s http://localhost:3000/api/dashboard/stats | jq .
echo -e "\nSystem Resources:"
free -h
df -h | grep -E "/$|/root"
echo -e "\nNginx Status:"
systemctl is-active nginx
```

## 🚨 Emergency Commands

### Complete Restart
```bash
pm2 restart job-tracker
systemctl reload nginx
```

### Full Reset (if everything fails)
```bash
cd ~/The-Job-posting-Hiring-Tracking-System
git pull origin main
npm run build
pm2 restart job-tracker
systemctl reload nginx
```

### Backup Important Data
```bash
# Backup PM2 config
pm2 save

# Backup nginx config
cp /etc/nginx/sites-available/jobtracker ~/jobtracker-nginx-backup.conf

# Check database (if applicable)
# Add your database backup commands here
```

---

## 📱 Access Points

- **Web Interface**: https://boostkit-jobtracker.duckdns.org/
- **Server IP**: 188.166.159.138
- **Local Port**: 3000
- **SSH**: `ssh root@188.166.159.138`

---

*Keep this file handy for 24/7 monitoring of your Job Tracker! 🎯*