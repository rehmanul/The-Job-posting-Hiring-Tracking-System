# Job Tracker - Optimized Tracking Strategy

## 🎯 **Tracking Approach**

### **Job Postings** 📋
- **Source**: Company career pages ONLY
- **Method**: Website scraping of career URLs
- **Why**: More reliable, no rate limits, direct from source

### **Hiring News** 👥
- **Primary**: LinkedIn company pages
- **Fallback**: Google Search API
- **Strategy**: LinkedIn first → Google search if no results

## 🔄 **Workflow**

### Job Tracking Flow
```
Company Career Page → Website Scraper → Job Postings → Slack/Email Alerts
```

### Hiring Tracking Flow
```
LinkedIn Company Page → Scraper → Found Hires? 
    ↓ YES: Process & Alert
    ↓ NO: Google Search → Extract from News → Process & Alert
```

## 🛠️ **Implementation**

### Job Postings
- ✅ Scrape only `careerPageUrl` from companies
- ✅ Parse job listings from career sites
- ✅ Extract: title, location, department, posted date
- ✅ Send alerts via Slack/Email

### Hiring News
- ✅ Try LinkedIn company people pages first
- ✅ If no hires found → Google Search fallback
- ✅ Search query: `"Company Name" (hiring OR "new hire" OR "joins" OR "appointed")`
- ✅ Extract: person name, position, start date

## 📊 **Data Sources**

### Primary Sources
1. **Career Pages**: Direct job postings
2. **LinkedIn**: Employee updates, new hires
3. **Google Search**: News articles, press releases

### Search Targets for Hiring
- LinkedIn announcements
- Business Wire press releases  
- PR Newswire articles
- Company blog posts
- Industry news sites

## ⚙️ **Configuration**

### Required APIs
```env
# Google Search (for hiring news fallback)
GOOGLE_SEARCH_API_KEY=your_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

### Search Parameters
- **Date Range**: Last 30 days
- **Results**: Top 10 per company
- **Confidence**: 60% for Google search results
- **Confidence**: 85% for LinkedIn results

## 🎯 **Benefits**

### Job Tracking
- ✅ **Reliable**: Direct from company sources
- ✅ **Complete**: All posted positions
- ✅ **Fast**: No rate limiting issues
- ✅ **Accurate**: Official job descriptions

### Hiring Tracking  
- ✅ **Comprehensive**: LinkedIn + Google coverage
- ✅ **Fallback**: Never miss hiring news
- ✅ **Smart**: Prioritizes best sources first
- ✅ **Scalable**: Works for any company size

## 📈 **Performance**

### Optimizations
- Career page scraping: No rate limits
- LinkedIn with delays: 5-10 seconds between companies
- Google Search: API limits respected
- Parallel processing: Jobs and hires tracked separately

### Scheduling
- **Jobs**: Every 15 minutes (career pages)
- **Hires**: Every 60 minutes (LinkedIn + Google)
- **Analytics**: Every 30 minutes

## 🔍 **Example Searches**

### Google Hiring Search
```
"Betsson Group" (hiring OR "new hire" OR "joins" OR "appointed") -jobs -career
```

### Results Processing
- Extract person names from titles
- Identify positions (CEO, CTO, Director, etc.)
- Determine start dates from article dates
- Assign confidence scores based on source

This strategy maximizes coverage while minimizing rate limiting and compliance issues.