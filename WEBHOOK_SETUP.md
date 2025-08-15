# LinkedIn Webhook Setup Guide

## Current Issue
Your ngrok tunnel is working, but the local server isn't running. LinkedIn webhook setup requires:

1. **Running local server**
2. **Proper environment variables**
3. **Webhook secret configuration**

## Quick Fix Steps

### 1. Start Your Server
```bash
npm run dev
```
This will start your server on localhost:3000

### 2. Set Environment Variables
Add to your `.env` file or environment:
```env
# LinkedIn Webhook Configuration
LINKEDIN_WEBHOOK_SECRET=your-webhook-secret-here
NODE_ENV=development
```

### 3. Test the Webhook Endpoint
Once your server is running, test these URLs:

**Test endpoint:**
```
https://75500a3cac59.ngrok-free.app/api/linkedin/webhook/test
```

**Webhook validation (GET):**
```
https://75500a3cac59.ngrok-free.app/api/linkedin/webhook?challenge=test123
```

### 4. LinkedIn Developer Console Setup
1. Go to LinkedIn Developer Console
2. Create/select your app
3. Navigate to "Products" → "Share on LinkedIn"
4. Add webhook URL: `https://75500a3cac59.ngrok-free.app/api/linkedin/webhook`
5. Set webhook events you want to track

## Webhook Events Supported
- `ORGANIZATION_SOCIAL_ACTION` - Company posts/announcements
- `MEMBER_PROFILE_UPDATE` - Employee job changes

## Troubleshooting

### Server Not Running
```bash
# Check if server is running
curl http://localhost:3000/api/linkedin/webhook/test

# If not running, start it
npm run dev
```

### Ngrok Issues
```bash
# Restart ngrok if needed
ngrok http 3000
```

### Webhook Secret Missing
The webhook will work in development mode without signature verification, but for production you need:
```env
LINKEDIN_WEBHOOK_SECRET=your-actual-secret-from-linkedin
NODE_ENV=production
```

## Testing Commands
```bash
# Test local server
curl http://localhost:3000/api/linkedin/webhook/test

# Test through ngrok
curl https://75500a3cac59.ngrok-free.app/api/linkedin/webhook/test

# Test webhook validation
curl "https://75500a3cac59.ngrok-free.app/api/linkedin/webhook?challenge=test123"
```

## Next Steps
1. Start server: `npm run dev`
2. Test endpoints above
3. Configure LinkedIn webhook in developer console
4. Monitor server logs for webhook events