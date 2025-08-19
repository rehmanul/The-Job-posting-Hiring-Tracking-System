@echo off
echo 🔄 Restarting Job Tracker with Cron-based Scheduling...
echo.

echo 📦 Installing dependencies...
call npm install

echo.
echo 🏗️ Building application...
call npm run build

echo.
echo 🚀 Starting server with new cron scheduling...
echo.
echo ✅ Schedule Configuration:
echo    📅 Jobs: Every 4 hours (12AM, 4AM, 8AM, 12PM, 4PM, 8PM)
echo    👥 Hires: Every 6 hours (12AM, 6AM, 12PM, 6PM) 
echo    📊 Summary: Daily at 9:00 AM
echo    🔄 Analytics: Every 2 hours
echo    🔗 Real-time: LinkedIn webhooks processed immediately
echo.
echo 🌐 Dashboard: https://boostkit-jobtracker.duckdns.org/
echo 📊 Schedule Status: https://boostkit-jobtracker.duckdns.org/api/system/schedule
echo.

call npm start