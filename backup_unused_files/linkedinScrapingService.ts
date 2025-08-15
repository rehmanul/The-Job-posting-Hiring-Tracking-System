import puppeteer from 'puppeteer';
import type { InsertNewHire } from '@shared/schema';

export class LinkedInScrapingService {
  private browser: any = null;
  private page: any = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false, // Keep visible for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Anti-detection setup
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await this.page.setViewport({ width: 1366, height: 768 });
    
    // Remove webdriver traces
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  async loginWithStoredSession(accessToken: string) {
    try {
      console.log('🔐 Using stored LinkedIn session...');
      
      // Navigate to LinkedIn
      await this.page.goto('https://www.linkedin.com', { waitUntil: 'networkidle2' });
      
      // Set LinkedIn session cookies/tokens
      await this.page.evaluate((token) => {
        localStorage.setItem('linkedin_oauth_token', token);
        // Add other session storage as needed
      }, accessToken);
      
      // Refresh to apply session
      await this.page.reload({ waitUntil: 'networkidle2' });
      
      // Check if logged in
      const isLoggedIn = await this.page.$('.global-nav__me') !== null;
      
      if (isLoggedIn) {
        console.log('✅ LinkedIn session active');
        return true;
      } else {
        console.log('❌ LinkedIn session expired, need re-authentication');
        return false;
      }
      
    } catch (error) {
      console.error('❌ LinkedIn login failed:', error);
      return false;
    }
  }

  async scrapeCompanyHires(companyLinkedInUrl: string, companyName: string): Promise<InsertNewHire[]> {
    if (!this.page) {
      throw new Error('LinkedIn scraper not initialized');
    }

    const hires: InsertNewHire[] = [];
    
    try {
      console.log(`🔍 Scraping ${companyName} LinkedIn page...`);
      
      // Navigate to company page
      await this.page.goto(companyLinkedInUrl, { waitUntil: 'networkidle2' });
      await this.randomDelay(2000, 4000);
      
      // Go to company posts/updates section
      const postsUrl = `${companyLinkedInUrl}/posts/`;
      await this.page.goto(postsUrl, { waitUntil: 'networkidle2' });
      await this.randomDelay(3000, 5000);
      
      // Scroll to load more posts
      await this.scrollAndLoadPosts();
      
      // Extract posts content
      const posts = await this.page.evaluate(() => {
        const postElements = document.querySelectorAll('[data-urn*="activity"]');
        const postsData = [];
        
        for (const post of postElements) {
          const textElement = post.querySelector('.feed-shared-text');
          const authorElement = post.querySelector('.feed-shared-actor__name');
          const timeElement = post.querySelector('.feed-shared-actor__sub-description time');
          
          if (textElement) {
            postsData.push({
              text: textElement.innerText || '',
              author: authorElement?.innerText || '',
              time: timeElement?.getAttribute('datetime') || '',
              fullHtml: post.innerHTML
            });
          }
        }
        
        return postsData;
      });
      
      console.log(`📄 Found ${posts.length} posts to analyze`);
      
      // Analyze posts for hiring announcements
      for (const post of posts) {
        const hire = this.extractHireFromPost(post, companyName);
        if (hire) {
          hires.push(hire);
          console.log(`✅ Found hire: ${hire.personName} as ${hire.position}`);
        }
      }
      
      // Also scrape "People" section for new employees
      await this.scrapeCompanyPeople(companyLinkedInUrl, companyName, hires);
      
    } catch (error) {
      console.error(`❌ Error scraping ${companyName}:`, error);
    }
    
    return hires;
  }

  private async scrapeCompanyPeople(companyUrl: string, companyName: string, hires: InsertNewHire[]) {
    try {
      console.log(`👥 Checking ${companyName} people section...`);
      
      const peopleUrl = `${companyUrl}/people/`;
      await this.page.goto(peopleUrl, { waitUntil: 'networkidle2' });
      await this.randomDelay(3000, 5000);
      
      // Look for "Recently joined" or new employees
      const newEmployees = await this.page.evaluate(() => {
        const employeeCards = document.querySelectorAll('.org-people-profile-card');
        const recentEmployees = [];
        
        for (const card of employeeCards) {
          const nameElement = card.querySelector('.org-people-profile-card__profile-title');
          const titleElement = card.querySelector('.org-people-profile-card__profile-info .t-14');
          const timeElement = card.querySelector('[data-test-id*="recently-joined"]');
          
          if (nameElement && titleElement && timeElement) {
            recentEmployees.push({
              name: nameElement.innerText?.trim() || '',
              title: titleElement.innerText?.trim() || '',
              joinedRecently: true
            });
          }
        }
        
        return recentEmployees;
      });
      
      // Add recent employees as hires
      for (const employee of newEmployees) {
        if (this.isValidPersonName(employee.name) && this.isValidPosition(employee.title)) {
          hires.push({
            personName: employee.name,
            company: companyName,
            position: employee.title,
            startDate: new Date(),
            linkedinProfile: null,
            source: 'LinkedIn People',
            confidenceScore: '95'
          });
          console.log(`✅ Found recent hire: ${employee.name} as ${employee.title}`);
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Could not scrape people section:', error);
    }
  }

  private extractHireFromPost(post: any, companyName: string): InsertNewHire | null {
    const text = post.text.toLowerCase();
    
    // Hiring keywords
    const hiringKeywords = [
      'welcome', 'joined', 'joining', 'new team member', 'excited to announce',
      'pleased to welcome', 'happy to share', 'thrilled to have', 'delighted to welcome'
    ];
    
    if (!hiringKeywords.some(keyword => text.includes(keyword))) {
      return null;
    }
    
    // Extract name and position using patterns
    const patterns = [
      /welcome\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:as|to)\s+(?:our\s+)?(?:new\s+)?([A-Za-z\s&-]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:joined|joins)\s+(?:as|our team as)\s+([A-Za-z\s&-]+)/i,
      /excited\s+to\s+(?:announce|welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:as|to)\s+(?:our\s+)?([A-Za-z\s&-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = post.text.match(pattern);
      if (match) {
        const name = match[1]?.trim();
        const position = match[2]?.trim();
        
        if (this.isValidPersonName(name) && this.isValidPosition(position)) {
          return {
            personName: name,
            company: companyName,
            position: this.cleanPosition(position),
            startDate: new Date(post.time || Date.now()),
            linkedinProfile: null,
            source: 'LinkedIn Posts',
            confidenceScore: '90'
          };
        }
      }
    }
    
    return null;
  }

  private async scrollAndLoadPosts() {
    // Scroll down to load more posts
    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.randomDelay(2000, 4000);
    }
  }

  private async randomDelay(min: number, max: number) {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private isValidPersonName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    const words = name.trim().split(/\s+/);
    return words.length >= 2 && words.length <= 4 && 
           words.every(word => /^[A-Z][a-z]{2,}$/.test(word));
  }

  private isValidPosition(position: string): boolean {
    if (!position || typeof position !== 'string') return false;
    const pos = position.toLowerCase().trim();
    
    const executiveKeywords = [
      'ceo', 'cto', 'cfo', 'coo', 'chief', 'director', 'manager', 'head of', 
      'vice president', 'president', 'senior', 'lead', 'officer', 'executive'
    ];
    
    return pos.length >= 3 && executiveKeywords.some(keyword => pos.includes(keyword));
  }

  private cleanPosition(position: string): string {
    return position
      .replace(/^(our|the|a)\s+/i, '')
      .replace(/\s+(team|department|at).*$/i, '')
      .trim() || 'Team Member';
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}