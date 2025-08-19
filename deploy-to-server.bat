@echo off
echo 🚀 Deploying to GitHub and DigitalOcean Droplet...

git add .
git commit -m "Fixed cron-based scheduling - Jobs every 4hrs, Hires every 6hrs, Summary daily 9AM"
git push origin main

echo ✅ Pushed to GitHub
echo 🔄 Now SSH to your droplet and run:
echo    cd /path/to/your/app
echo    git pull origin main
echo    npm install
echo    pm2 restart all
echo.
echo 📅 Schedule will auto-start:
echo    Jobs: 12AM, 4AM, 8AM, 12PM, 4PM, 8PM
echo    Hires: 12AM, 6AM, 12PM, 6PM  
echo    Summary: 9AM daily