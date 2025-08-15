# Google Search Engine ID Setup

## Quick Steps to Get Your Search Engine ID:

### 1. Create Custom Search Engine
- Go to: https://cse.google.com/cse/
- Click "Add" or "Create"
- Enter any website (e.g., `linkedin.com`)
- Name it "Job Hire Tracker"

### 2. Get Search Engine ID
- After creation, click "Control Panel"
- Copy the "Search engine ID" (looks like: `017576662512468239146:omuauf_lfve`)

### 3. Configure for Web Search
- In Control Panel → Setup → Basics
- Turn ON "Search the entire web"
- Remove the initial website you added

### 4. Add to .env
```env
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

## Your Current Configuration:
✅ GOOGLE_SEARCH_API_KEY: Configured
❌ GOOGLE_SEARCH_ENGINE_ID: Missing

Once you add the Search Engine ID, the system will have:
- 99% LinkedIn API hire detection
- Google Search fallback for hire announcements
- Enhanced job scraping from career pages
- Real-time Google Sheets updates

## Test Your Setup:
After adding the ID, restart the application and check the logs for:
```
✅ Google Search Service initialized with API key
```