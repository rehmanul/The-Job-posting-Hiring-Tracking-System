# Webhook Setup Guide

## GitHub Authentication & Push

### 1. Authenticate with GitHub
```bash
# Option 1: Use GitHub CLI (recommended)
gh auth login

# Option 2: Use personal access token
git remote set-url origin https://YOUR_TOKEN@github.com/Shojol-R7/JobTracker-Expert.git
git push -u origin main
```

### 2. Generate Personal Access Token
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token with `repo` permissions
3. Replace YOUR_TOKEN in the command above

## Webhook Configuration

### 1. LinkedIn Webhook Endpoint
```typescript
// server/routes.ts - Add this endpoint
app.post('/webhook/linkedin', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'hire_announcement') {
      await processHireAnnouncement(data);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
```

### 2. GitHub Webhook (for CI/CD)
```typescript
app.post('/webhook/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  if (signature === `sha256=${expectedSignature}`) {
    // Process deployment
    await deployApplication();
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid signature' });
  }
});
```

### 3. Environment Variables
Add to your `.env`:
```env
GITHUB_WEBHOOK_SECRET=your_webhook_secret
WEBHOOK_URL=https://your-domain.com/webhook
```

### 4. Ngrok for Local Testing
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the https URL for webhook endpoints
```

## Production Deployment

### 1. Render.com Setup
```yaml
# render.yaml
services:
  - type: web
    name: jobtracker-expert
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

### 2. Webhook URLs
- Development: `https://your-ngrok-url.ngrok.io/webhook/linkedin`
- Production: `https://your-app.onrender.com/webhook/linkedin`

## Testing Webhooks

### 1. Test LinkedIn Webhook
```bash
curl -X POST https://your-domain.com/webhook/linkedin \
  -H "Content-Type: application/json" \
  -d '{"event":"hire_announcement","data":{"company":"Test Corp","position":"Developer"}}'
```

### 2. Monitor Webhook Logs
```typescript
// Add to your webhook handlers
console.log('Webhook received:', {
  timestamp: new Date().toISOString(),
  event: req.body.event,
  data: req.body.data
});
```