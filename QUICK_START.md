# 🚀 Quick Start - 3 Commands Only

## 1️⃣ Connect to Droplet
```bash
ssh root@YOUR_DROPLET_IP
```
*Or use "Access console" button in DigitalOcean dashboard*

## 2️⃣ Deploy Application
```bash
curl -sSL https://raw.githubusercontent.com/rehmanul/The-Job-posting-Hiring-Tracking-System/main/deploy-digitalocean.sh | bash
```

## 3️⃣ Add Your Credentials
```bash
nano /var/www/jobtracker/.env
```
*Edit the file with your actual API keys and database URL*

```bash
pm2 restart all
```

## ✅ Done!
- **App**: `http://YOUR_DROPLET_IP`
- **Webhook**: `http://YOUR_DROPLET_IP/api/linkedin/webhook`

**Total time: 5 minutes**