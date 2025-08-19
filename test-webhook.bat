@echo off
echo Testing LinkedIn webhook...

curl -X POST https://boostkit-jobtracker.duckdns.org/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"activity\":{\"text\":\"Welcome John Smith as our new Software Engineer at TechCorp\",\"company\":\"TechCorp\",\"profileUrl\":\"https://linkedin.com/in/johnsmith\"}}"

echo.
echo Webhook test sent!