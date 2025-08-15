import axios from 'axios';
import * as cheerio from 'cheerio';
import { GeminiService } from './geminiService';
import { GeminiHiringExtensions } from './geminiHiringExtensions';
import type { InsertNewHire } from '@shared/schema';


interface HiringSource {
  name: string;
  url: string;
  selector: string;
  confidence: number;
  enabled: boolean;
}

interface CompanyHiringConfig {
  name: string;
  linkedinUrl: string;
  website: string;
  sources: HiringSource[];
  keywords: string[];
  excludeKeywords: string[];
}

export class EnhancedHiringIntelligenceService {
  private geminiHiringExtensions: GeminiHiringExtensions;
  private isInitialized = false;
  private companyConfigs: Map<string, CompanyHiringConfig> = new Map();


  // Gaming companies configuration
  private readonly GAMING_COMPANIES_CONFIG: CompanyHiringConfig[] = [
    {
      name: 'Evoke plc',
      linkedinUrl: 'https://www.linkedin.com/company/evoke-plc/',
      website: 'https://www.evoke.cc/',
      sources: [
        { name: 'company_news', url: 'https://www.evoke.cc/news/', selector: '.news-item', confidence: 85, enabled: true },
        { name: 'press_releases', url: 'https://www.evoke.cc/press/', selector: '.press-item', confidence: 90, enabled: true },
        { name: 'careers_team', url: 'https://www.evoke.cc/careers/team/', selector: '.team-member', confidence: 75, enabled: true }
      ],
      keywords: ['welcome', 'joined', 'new hire', 'team member', 'appointed', 'announces'],
      excludeKeywords: ['left', 'departed', 'former', 'ex-']
    },
    {
      name: 'Betsson Group',
      linkedinUrl: 'https://www.linkedin.com/company/betsson-group/',
      website: 'https://www.betsson.com/',
      sources: [
        { name: 'about_team', url: 'https://www.betsson.com/about/team/', selector: '.team-card', confidence: 80, enabled: true },
        { name: 'news', url: 'https://www.betsson.com/news/', selector: '.news-article', confidence: 85, enabled: true }
      ],
      keywords: ['welcome', 'joined', 'new', 'team', 'hire', 'appointed'],
      excludeKeywords: ['left', 'departed', 'former']
    },
    {
      name: 'Entain',
      linkedinUrl: 'https://www.linkedin.com/company/entaingroup/',
      website: 'https://entaingroup.com/',
      sources: [
        { name: 'news', url: 'https://entaingroup.com/news/', selector: '.news-item', confidence: 90, enabled: true },
        { name: 'leadership', url: 'https://entaingroup.com/about/leadership/', selector: '.leader-profile', confidence: 75, enabled: true }
      ],
      keywords: ['appointed', 'joined', 'welcome', 'new', 'hire', 'announces'],
      excludeKeywords: ['former', 'ex-', 'departed']
    },
    {
      name: 'Flutter Entertainment',
      linkedinUrl: 'https://www.linkedin.com/company/flutter-entertainment/',
      website: 'https://www.flutter.com/',
      sources: [
        { name: 'press_centre', url: 'https://www.flutter.com/press-centre/', selector: '.press-release', confidence: 90, enabled: true },
        { name: 'our_people', url: 'https://www.flutter.com/our-people/', selector: '.people-profile', confidence: 75, enabled: true }
      ],
      keywords: ['appointed', 'joined', 'welcome', 'new', 'announces'],
      excludeKeywords: ['former', 'departed']
    },
    {
      name: 'bet365',
      linkedinUrl: 'https://www.linkedin.com/company/bet365/',
      website: 'https://www.bet365.com/',
      sources: [
        { name: 'about', url: 'https://help.bet365.com/about/', selector: '.content', confidence: 70, enabled: true }
      ],
      keywords: ['joined', 'welcome', 'new', 'team'],
      excludeKeywords: ['former', 'ex-']
    }
    // Add other gaming companies here...
  ];

  constructor(geminiHiringExtensions: GeminiHiringExtensions) {
    this.geminiHiringExtensions = geminiHiringExtensions;
    this.initializeCompanyConfigs();
  }


  private initializeCompanyConfigs(): void {
    this.GAMING_COMPANIES_CONFIG.forEach(config => {
      this.companyConfigs.set(config.name.toLowerCase(), config);
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log('🎯 Initializing Enhanced Hiring Intelligence Service...');
      
      // The extensions service is initialized separately
      this.isInitialized = true;
      
      console.log('✅ Enhanced Hiring Intelligence Service initialized');

      console.log(`📊 Configured for ${this.companyConfigs.size} gaming companies`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Hiring Intelligence Service:', error);
      this.isInitialized = false;
    }
  }

  async detectCompanyHires(companyName: string): Promise<InsertNewHire[]> {
    if (!this.isInitialized) {
      console.warn('⚠️ Service not initialized');
      return [];
    }

    const config = this.companyConfigs.get(companyName.toLowerCase());
    if (!config) {
      console.warn(`⚠️ No configuration found for ${companyName}`);
      return await this.genericHireDetection(companyName);
    }

    console.log(`🎯 Detecting hires for ${companyName} using multi-source approach`);

    const allHires: InsertNewHire[] = [];
    
    // 1. Scrape company website sources
    const websiteHires = await this.scrapeCompanyWebsiteSources(config);
    allHires.push(...websiteHires);

    // 2. Search Google for recent announcements
    const googleHires = await this.searchGoogleForHireAnnouncements(config);
    allHires.push(...googleHires);

    // 3. Monitor industry publications
    const industryHires = await this.searchIndustryPublications(config);
    allHires.push(...industryHires);

    // 4. Social media monitoring (Twitter/X)
    const socialHires = await this.monitorSocialMedia(config);
    allHires.push(...socialHires);

    // 5. Company press releases
    const pressHires = await this.monitorPressReleases(config);
    allHires.push(...pressHires);

    // Deduplicate and validate hires
    const uniqueHires = await this.deduplicateHires(allHires);
    
    // AI validation and enhancement
    const validatedHires = await this.validateWithAI(uniqueHires, config);

    console.log(`✅ Found ${validatedHires.length} validated hires for ${companyName}`);
    return validatedHires;
  }

  private async scrapeCompanyWebsiteSources(config: CompanyHiringConfig): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    
    for (const source of config.sources) {
      if (!source.enabled) continue;
      
      try {
        console.log(`🌐 Scraping ${source.name} for ${config.name}`);
        
      const response = await axios.get(source.url, {
          timeout: 30000, // Increased timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });


        const $ = cheerio.load(response.data);
        const content = $(source.selector).text() + ' ' + $('body').text();
        
        const detectedHires = await this.extractHiresFromContent(content, config, source.confidence, source.name);
        hires.push(...detectedHires);
        
      } catch (error) {
        console.warn(`⚠️ Failed to scrape ${source.url}:`, error);
      }
    }
    
    return hires;
  }

  private async searchGoogleForHireAnnouncements(config: CompanyHiringConfig): Promise<InsertNewHire[]> {
    try {
      const queries = [
        `"${config.name}" "welcome" "joined" site:linkedin.com`,
        `"${config.name}" "new hire" "appointed" -site:glassdoor.com`,
        `"${config.name}" "announces" "joins" "team member"`,
        `"${config.name}" "executive" "appointment" "leadership"`
      ];

      const hires: InsertNewHire[] = [];
      
      for (const query of queries) {
        console.log(`🔍 Google search: ${query}`);
        
        // Use Gemini AI to analyze search results if available
        if (this.geminiHiringExtensions) {
          try {
            const searchResults = await this.geminiHiringExtensions.searchAndAnalyze(query, config.name);
            hires.push(...searchResults);
          } catch (e) {
             console.error(`❌ Gemini search failed for query "${query}":`, e);
          }
        }

        
        await this.delay(2000, 4000); // Rate limiting
      }
      
      return hires;
      
    } catch (error) {
      console.error('❌ Google search failed:', error);
      return [];
    }
  }

  private async searchIndustryPublications(config: CompanyHiringConfig): Promise<InsertNewHire[]> {
    const industryUrls = [
      'https://igamingbusiness.com/',
      'https://www.gamingamerican.com/', // Corrected URL
      'https://www.gamblinginsider.com/',

      'https://www.yogonet.com/',
      'https://www.casinonewsdaily.com/'
    ];

    const hires: InsertNewHire[] = [];
    
    for (const url of industryUrls) {
      try {
        console.log(`📰 Checking industry publication: ${url}`);
        
        const response = await axios.get(url, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const $ = cheerio.load(response.data);
        const articles = $('article, .article, .news-item').slice(0, 10);
        
        for (let i = 0; i < articles.length; i++) {
          const article = articles.eq(i);
          const title = article.find('h1, h2, h3, .title').text();
          const content = article.text();
          
          if (this.mentionsCompany(title + ' ' + content, config)) {
            const detectedHires = await this.extractHiresFromContent(content, config, 70, 'industry_publication');
            hires.push(...detectedHires);
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to check ${url}:`, error);
      }
      
      await this.delay(3000, 5000);
    }
    
    return hires;
  }

  private async monitorSocialMedia(config: CompanyHiringConfig): Promise<InsertNewHire[]> {
    // For now, we'll use Gemini AI to search for social media mentions
    // In production, you'd want to integrate with Twitter API v2
    
    try {
      console.log(`📱 Monitoring social media for ${config.name}`);
      
      const socialQueries = [
        `${config.name} welcome new team member`,
        `${config.name} excited to announce joined`,
        `${config.name} pleased to welcome appointed`
      ];
      
      const hires: InsertNewHire[] = [];
      
      for (const query of socialQueries) {
        if (this.geminiHiringExtensions) {
          try {
            const socialResults = await this.geminiHiringExtensions.searchSocialMentions(query, config.name);
            hires.push(...socialResults);
          } catch(e) {
            console.error(`❌ Gemini social search failed for query "${query}":`, e);
          }
        }
      }

      
      return hires;
      
    } catch (error) {
      console.error('❌ Social media monitoring failed:', error);
      return [];
    }
  }

  private async monitorPressReleases(config: CompanyHiringConfig): Promise<InsertNewHire[]> {
    const pressReleaseUrls = [
      'https://www.prnewswire.com/',
      'https://www.businesswire.com/',
      'https://finance.yahoo.com/news/',
      'https://www.reuters.com/business/'
    ];

    const hires: InsertNewHire[] = [];
    
    for (const baseUrl of pressReleaseUrls) {
      try {
        console.log(`📄 Checking press releases at ${baseUrl}`);
        
        // Search for company-specific press releases
        const searchUrl = `${baseUrl}?q=${encodeURIComponent(config.name)}`;
        
        const response = await axios.get(searchUrl, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const $ = cheerio.load(response.data);
        const articles = $('article, .article, .news-item, .press-release').slice(0, 5);
        
        for (let i = 0; i < articles.length; i++) {
          const article = articles.eq(i);
          const content = article.text();
          
          if (this.mentionsCompany(content, config)) {
            const detectedHires = await this.extractHiresFromContent(content, config, 85, 'press_release');
            hires.push(...detectedHires);
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to check press releases at ${baseUrl}:`, error);
      }
      
      await this.delay(2000, 4000);
    }
    
    return hires;
  }

  private async extractHiresFromContent(
    content: string, 
    config: CompanyHiringConfig, 
    baseConfidence: number, 
    source: string
  ): Promise<InsertNewHire[]> {
    const hires: InsertNewHire[] = [];
    
    // Use AI to extract hire information
    if (this.geminiHiringExtensions) {
      try {
        const aiHires = await this.geminiHiringExtensions.extractHiresFromText(content, config.name);
        hires.push(...aiHires.map((hire: InsertNewHire) => ({
          ...hire,
          confidenceScore: Math.min(baseConfidence, parseInt(hire.confidenceScore ?? '70') || 70).toString(),
          source
        })));

      } catch (error) {
        console.warn('⚠️ AI extraction failed, using rule-based approach');
      }
    }
    
    // Fallback: Rule-based extraction
    if (hires.length === 0) {
      const ruleBasedHires = this.ruleBasedHireExtraction(content, config, baseConfidence, source);
      hires.push(...ruleBasedHires);
    }
    
    return hires;
  }

  private ruleBasedHireExtraction(
    content: string, 
    config: CompanyHiringConfig, 
    confidence: number, 
    source: string
  ): InsertNewHire[] {
    const hires: InsertNewHire[] = [];
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      // Check if sentence contains hiring keywords
      const hasHireKeyword = config.keywords.some(keyword => lowerSentence.includes(keyword));
      const hasExcludeKeyword = config.excludeKeywords.some(keyword => lowerSentence.includes(keyword));
      
      if (hasHireKeyword && !hasExcludeKeyword && lowerSentence.includes(config.name.toLowerCase())) {
        // Extract person name using patterns
        const namePatterns = [
          /(?:welcome|pleased to announce|excited to welcome)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
          /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:has joined|joins|joined)/i,
          /(?:appointed|announces)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
        ];
        
        for (const pattern of namePatterns) {
          const match = sentence.match(pattern);
          if (match && match[1]) {
            // Extract position
            const positionPatterns = [
              /as\s+(?:the\s+)?([^.!?]+?)(?:\.|$)/i,
              /to\s+the\s+role\s+of\s+([^.!?]+?)(?:\.|$)/i,
              /(?:position|role)\s+of\s+([^.!?]+?)(?:\.|$)/i
            ];
            
            let position = 'Unknown Position';
            for (const posPattern of positionPatterns) {
              const posMatch = sentence.match(posPattern);
              if (posMatch && posMatch[1]) {
                position = posMatch[1].trim();
                break;
              }
            }
            
            hires.push({
              personName: match[1].trim(),
              company: config.name,
              position: position,
              startDate: new Date(),
              linkedinProfile: null,
              source: source,
              confidenceScore: confidence.toString()
            });
            
            break; // Only extract one hire per sentence
          }
        }
      }
    }
    
    return hires;
  }

  private mentionsCompany(content: string, config: CompanyHiringConfig): boolean {
    const lowerContent = content.toLowerCase();
    return lowerContent.includes(config.name.toLowerCase()) || 
           lowerContent.includes(config.name.replace(/\s+/g, '').toLowerCase());
  }

  private async deduplicateHires(hires: InsertNewHire[]): Promise<InsertNewHire[]> {
    const uniqueHires: InsertNewHire[] = [];
    const seen = new Set<string>();
    
    for (const hire of hires) {
      const key = `${hire.personName.toLowerCase()}-${hire.company.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueHires.push(hire);
      }
    }
    
    return uniqueHires;
  }

  private async validateWithAI(hires: InsertNewHire[], config: CompanyHiringConfig): Promise<InsertNewHire[]> {
    if (!this.geminiHiringExtensions) return hires;
    
    const validatedHires: InsertNewHire[] = [];
    
    for (const hire of hires) {
      try {
        const isValid = await this.geminiHiringExtensions.validateHire(hire, config.name);
        if (isValid) {
          // Enhance with additional information
          const enhanced = await this.geminiHiringExtensions.enhanceHireInfo(hire);
          validatedHires.push(enhanced || hire);
        }

      } catch (error) {
        console.warn('⚠️ AI validation failed, including hire anyway:', hire.personName);
        validatedHires.push(hire);
      }
    }
    
    return validatedHires;
  }

  private async genericHireDetection(companyName: string): Promise<InsertNewHire[]> {
    console.log(`🔍 Using generic hire detection for ${companyName}`);
    
    if (!this.geminiHiringExtensions) {
      console.warn('⚠️ No AI service available for generic detection');
      return [];
    }
    
    try {
      // Use AI to search for generic hire patterns
      const query = `"${companyName}" "welcome" "joined" "new hire" "appointed" "team member"`;
      return await this.geminiHiringExtensions.searchAndAnalyze(query, companyName);
    } catch (error) {
      console.error('❌ Generic hire detection failed:', error);
      return [];
    }
  }


  private async delay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Method to add custom company configuration
  addCompanyConfig(config: CompanyHiringConfig): void {
    this.companyConfigs.set(config.name.toLowerCase(), config);
    console.log(`✅ Added configuration for ${config.name}`);
  }

  // Method to get hiring analytics
  async getHiringAnalytics(companyName: string, days: number = 30): Promise<any> {
    const hires = await this.detectCompanyHires(companyName);
    if (hires.length === 0) {
      return {
        totalHires: 0,
        recentHires: 0,
        averageConfidence: 0,
        sourceBreakdown: {},
        topPositions: {}
      };
    }

    const recentHires = hires.filter(hire => {
      if (!hire.startDate) return false;
      const daysDiff = (Date.now() - hire.startDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= days;
    });
    
    return {
      totalHires: hires.length,
      recentHires: recentHires.length,
      averageConfidence: hires.reduce((sum, h) => sum + parseInt(h.confidenceScore ?? '70'), 0) / hires.length,
      sourceBreakdown: this.getSourceBreakdown(hires),
      topPositions: this.getTopPositions(hires)
    };
  }


  private getSourceBreakdown(hires: InsertNewHire[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    hires.forEach(hire => {
      breakdown[hire.source] = (breakdown[hire.source] || 0) + 1;
    });
    return breakdown;
  }

  private getTopPositions(hires: InsertNewHire[]): Record<string, number> {
    const positions: Record<string, number> = {};
    hires.forEach(hire => {
      const position = hire.position ?? 'Unknown Position';
      positions[position] = (positions[position] || 0) + 1;
    });
    return Object.fromEntries(

      Object.entries(positions).sort(([,a], [,b]) => b - a).slice(0, 10)
    );
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Enhanced Hiring Intelligence Service cleanup complete');
  }
}

// Extended GeminiService methods for hire detection
declare module './geminiService' {
  interface GeminiService {
    searchAndAnalyze(query: string, companyName: string): Promise<InsertNewHire[]>;
    searchSocialMentions(query: string, companyName: string): Promise<InsertNewHire[]>;
    extractHiresFromText(content: string, companyName: string): Promise<InsertNewHire[]>;
    validateHire(hire: InsertNewHire, companyName: string): Promise<boolean>;
    enhanceHireInfo(hire: InsertNewHire): Promise<InsertNewHire | null>;
  }
}
