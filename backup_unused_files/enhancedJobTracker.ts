import { JobTrackerService } from './jobTracker';
import { EnhancedHiringIntelligenceService } from './enhancedHiringIntelligence';
import { EnhancedGeminiService } from '../services/geminiHiringExtensions';
import { storage } from '../storage';


import type { Company, InsertNewHire } from '@shared/schema';

export class EnhancedJobTrackerService extends JobTrackerService {
  private hiringIntelligence: EnhancedHiringIntelligenceService;
  private hiringAccuracy: Map<string, number> = new Map();

  constructor(linkedinSessionCookies?: any[] | null) {
    super(linkedinSessionCookies);
    const geminiHiringExtensions = new EnhancedGeminiService();

    this.hiringIntelligence = new EnhancedHiringIntelligenceService(geminiHiringExtensions);
  }



  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Enhanced Job Tracker Service...');
      
      // Initialize parent class
      await super.initialize();
      
      // Initialize enhanced hiring intelligence
      await this.hiringIntelligence.initialize();
      
      console.log('✅ Enhanced Job Tracker Service initialized with multi-source hiring intelligence');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Job Tracker Service:', error);
      throw error;
    }
  }

  // Override the trackNewHires method with enhanced intelligence
  async trackNewHires(): Promise<void> {
    console.log('✅ EXECUTING ENHANCED `trackNewHires` METHOD');
    if (!this.isRunning) {
      console.log('⏸️ Job tracking is paused, skipping hire scan');
      return;
    }

    try {
      console.log('👥 Starting enhanced new hires scan...');

      
      const companies = await storage.getCompanies();
      const activeCompanies = companies.filter(c => c.isActive);
      
      console.log(`📊 Found ${companies.length} total companies, ${activeCompanies.length} active`);
      
      if (activeCompanies.length === 0) {
        console.log('⚠️ No active companies configured - skipping hire scan');
        return;
      }
      
      let totalHiresFound = 0;
      let companiesScanned = 0;
      
      // Process companies in smaller batches to avoid rate limits
      const batchSize = 2; // Smaller batch size for enhanced processing
      for (let i = 0; i < activeCompanies.length; i += batchSize) {
        const batch = activeCompanies.slice(i, i + batchSize);
        
        for (const company of batch) {
          try {
            console.log(`🏢 Enhanced hire detection for ${company.name}...`);
            
            // Use multiple detection methods with confidence scoring
            const allHires = await this.detectHiresMultiMethod(company);
            totalHiresFound += allHires.length;
            companiesScanned++;
            
            // Process and store hires with quality checks
            for (const hireData of allHires) {
              if (!this.isValidHire(hireData)) {
                console.warn(`⚠️ Skipping invalid hire:`, hireData.personName);
                continue;
              }
              
              try {
                const hire = await storage.createNewHire({
                  ...hireData,
                  company: company.name,
                });
                
                // Sync to external services
                await this.syncHireToServices(hire);
                
                console.log(`✅ Enhanced hire processed: ${hire.personName} at ${hire.company} (confidence: ${hire.confidenceScore}%)`);
                
              } catch (err) {
                console.error('❌ Failed to process hire:', err, hireData);
              }
            }
            
            // Track accuracy metrics
            if (company.name) {
              await this.updateHiringAccuracyMetrics(company.name, allHires.length);
            }

            
            // Longer delay for enhanced processing
            await this.delay(5000, 8000);
            
          } catch (error) {
            console.error(`❌ Failed to scan hires for ${company.name}:`, error);
          }
        }
        
        // Longer delay between batches for enhanced processing
        if (i + batchSize < activeCompanies.length) {
          console.log(`⏸️ Enhanced batch completed, waiting 45s before next batch...`);
          await this.delay(45000, 50000);
        }
      }
      
      console.log(`✅ Enhanced hire scan completed: ${totalHiresFound} hires found from ${companiesScanned} companies`);
      
      // Generate hiring intelligence report
      await this.generateHiringIntelligenceReport(totalHiresFound, companiesScanned);
      
      await this.recordHireScanAnalytics(totalHiresFound, companiesScanned);
      
    } catch (error) {
      console.error('❌ Enhanced hire scan failed:', error);
      await this.slackService.sendSystemMessage(`Enhanced hire scan failed: ${(error as Error).message}`, 'error');
    }
  }

  private async detectHiresMultiMethod(company: Company): Promise<InsertNewHire[]> {
    const allHires: InsertNewHire[] = [];
    const methods: string[] = [];

    console.log(`🎯 Using multi-method hire detection for ${company.name}`);

    // Method 1: Enhanced Hiring Intelligence (Primary)
    if (company.name) {
      try {
        const enhancedHires = await this.hiringIntelligence.detectCompanyHires(company.name);
        allHires.push(...enhancedHires);
        methods.push(`Enhanced Intelligence: ${enhancedHires.length}`);
        console.log(`🎯 Enhanced Intelligence found ${enhancedHires.length} hires`);
      } catch (error) {
        console.warn('⚠️ Enhanced intelligence failed:', error);
      }
    }


    // Method 2: LinkedIn Scraper (if available and logged in)
    if (this.linkedinScraper?.isEnabled && this.linkedinScraper?.isLoggedIn && company.linkedinUrl) {
      try {
        console.log('🔗 Using LinkedIn scraper as secondary method');
        const linkedinHires = await this.linkedinScraper.scrapeCompanyHires(company.linkedinUrl);
        
        // Merge with enhanced hires, avoiding duplicates
        const uniqueLinkedInHires = this.filterDuplicateHires(linkedinHires, allHires);
        allHires.push(...uniqueLinkedInHires);
        methods.push(`LinkedIn Scraper: ${uniqueLinkedInHires.length}`);
        console.log(`🔗 LinkedIn scraper found ${uniqueLinkedInHires.length} additional hires`);
      } catch (error) {
        console.warn('⚠️ LinkedIn scraper failed:', error);
      }
    }

    // Method 3: LinkedIn API (fallback)
    if (allHires.length === 0 && company.linkedinUrl) {
      try {
        console.log('📡 Using LinkedIn API as fallback method');
        const companyId = this.linkedinAPI.extractCompanyIdFromUrl(company.linkedinUrl);
        // LinkedIn API for shares requires a numeric organization ID, not a vanity name.
        if (companyId && /^\d+$/.test(companyId) && company.name) {
          const apiHires = await this.linkedinAPI.detectCompanyHires(companyId, company.name);
          allHires.push(...apiHires);
          methods.push(`LinkedIn API: ${apiHires.length}`);
          console.log(`📡 LinkedIn API found ${apiHires.length} hires`);
        } else if (companyId) {

          console.log(`ℹ️ Skipping LinkedIn API for ${company.name} because its company ID "${companyId}" is not numeric. Please use the numeric ID in the company URL.`);
        }
      } catch (error) {
        console.warn('⚠️ LinkedIn API failed:', error);
      }
    }


    // Method 4: Google Search (last resort)
    if (allHires.length === 0 && company.name) {
      try {
        console.log('🔍 Using Google search as last resort');
        const searchHires = await this.searchGoogleForHires(company.name);
        allHires.push(...searchHires);
        methods.push(`Google Search: ${searchHires.length}`);
        console.log(`🔍 Google search found ${searchHires.length} hires`);
      } catch (error) {
        console.warn('⚠️ Google search failed:', error);
      }
    }


    console.log(`📊 Detection methods used: ${methods.join(', ')}`);
    
    // Apply quality filtering and confidence scoring
    const qualityFilteredHires = await this.applyQualityFiltering(allHires, company);
    
    return qualityFilteredHires;
  }

  private filterDuplicateHires(newHires: InsertNewHire[], existingHires: InsertNewHire[]): InsertNewHire[] {
    return newHires.filter(newHire => {
      const isDuplicate = existingHires.some(existing => {
        const nameSimilarity = this.calculateNameSimilarity(newHire.personName, existing.personName);
        const sameCompany = !!newHire.company && !!existing.company && newHire.company.toLowerCase() === existing.company.toLowerCase();

        return nameSimilarity > 0.8 && sameCompany;
      });
      return !isDuplicate;
    });
  }

  private calculateNameSimilarity(name1: string | null | undefined, name2: string | null | undefined): number {
    if (typeof name1 !== 'string' || typeof name2 !== 'string') {
      return 0;
    }
    const normalize = (name: string) => name.toLowerCase().replace(/[^\w\s]/g, '').trim();


    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    if (n1 === n2) return 1;
    
    // Simple Levenshtein distance calculation
    const matrix = [];
    for (let i = 0; i <= n2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= n1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= n2.length; i++) {
      for (let j = 1; j <= n1.length; j++) {
        if (n2.charAt(i - 1) === n1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const maxLength = Math.max(n1.length, n2.length);
    return maxLength === 0 ? 1 : (maxLength - matrix[n2.length][n1.length]) / maxLength;
  }

  private async applyQualityFiltering(hires: InsertNewHire[], company: Company): Promise<InsertNewHire[]> {
    const filteredHires: InsertNewHire[] = [];
    
    for (const hire of hires) {
      let qualityScore = parseInt(hire.confidenceScore ?? '50') || 50;
      
      // Quality checks
      const checks = {
        hasValidName: this.hasValidPersonName(hire.personName),
        hasValidPosition: this.hasValidPosition(hire.position),
        hasRecentDate: this.isRecentHire(hire.startDate),
        hasHighConfidence: qualityScore >= 70,
        notGenericInfo: !this.isGenericInfo(hire)
      };
      
      // Calculate final quality score
      const passedChecks = Object.values(checks).filter(Boolean).length;
      const finalScore = (passedChecks / Object.keys(checks).length) * qualityScore;
      
      // Apply quality threshold
      if (finalScore >= 60) {
        hire.confidenceScore = Math.round(finalScore).toString();
        filteredHires.push(hire);
        console.log(`✅ Quality check passed: ${hire.personName} (score: ${finalScore})`);
      } else {
        console.log(`❌ Quality check failed: ${hire.personName} (score: ${finalScore})`);
      }
    }
    
    return filteredHires;
  }

  private hasValidPersonName(name: string | null | undefined): boolean {
    if (!name || name.length < 3) return false;

    
    const invalidNames = [
      'unknown', 'new hire', 'team member', 'employee', 'staff',
      'person', 'individual', 'candidate', 'recruit', 'n/a'
    ];
    
    const normalizedName = name.toLowerCase().trim();
    return !invalidNames.some(invalid => normalizedName.includes(invalid)) &&
           /^[a-zA-Z\s\-'\.]+$/.test(name) &&
           name.split(' ').length >= 2;
  }

  private hasValidPosition(position: string | null | undefined): boolean {
    if (!position || position.length < 3) return false;

    
    const invalidPositions = [
      'unknown', 'position', 'role', 'job', 'n/a', 'tbd', 'staff'
    ];
    
    const normalizedPosition = position.toLowerCase().trim();
    return !invalidPositions.some(invalid => normalizedPosition === invalid);
  }

  private isRecentHire(startDate: Date | null | undefined): boolean {
    if (!startDate) return false;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return startDate >= sixMonthsAgo;
  }


  private isGenericInfo(hire: InsertNewHire): boolean {
    const genericPatterns = [
      /new (team )?member/i,
      /recent hire/i,
      /latest addition/i,
      /unknown (person|individual)/i
    ];
    
    const fullText = `${hire.personName || ''} ${hire.position || ''}`;
    return genericPatterns.some(pattern => pattern.test(fullText));
  }


  private isValidHire(hire: InsertNewHire): boolean {
    if (!hire.personName || !hire.company || !hire.position) {
      return false;
    }
    return (
      hire.personName.trim().length > 0 &&
      hire.company.trim().length > 0 &&
      hire.position.trim().length > 0
    );
  }


  private async syncHireToServices(hire: any): Promise<void> {
    const syncTasks = [
      this.googleSheets.syncNewHire(hire).catch(err => 
        console.error('❌ Failed to sync to Google Sheets:', err)
      ),
      this.slackService.sendHireAlert(hire).catch(err => 
        console.error('❌ Failed to send Slack alert:', err)
      ),
      this.emailService.sendHireAlert(hire).catch(err => 
        console.error('❌ Failed to send email alert:', err)
      )
    ];
    
    await Promise.allSettled(syncTasks);
  }

  private async updateHiringAccuracyMetrics(companyName: string, hiresFound: number): Promise<void> {
    const currentAccuracy = this.hiringAccuracy.get(companyName) || 0;
    const newAccuracy = hiresFound > 0 ? Math.min(95, currentAccuracy + 5) : Math.max(50, currentAccuracy - 2);
    this.hiringAccuracy.set(companyName, newAccuracy);
    
    console.log(`📊 Hiring accuracy for ${companyName}: ${newAccuracy}%`);
  }

  private async generateHiringIntelligenceReport(totalHires: number, companiesScanned: number): Promise<void> {
    try {
      console.log('📋 Generating hiring intelligence report...');
      
      const report = {
        scanTimestamp: new Date().toISOString(),
        totalHires,
        companiesScanned,
        averageHiresPerCompany: totalHires / companiesScanned,
        accuracyMetrics: Object.fromEntries(this.hiringAccuracy),
        sourceBreakdown: await this.getSourceBreakdown(),
        confidenceDistribution: await this.getConfidenceDistribution(),
        topHiringCompanies: await this.getTopHiringCompanies()
      };
      
      // Store report
      await storage.createSystemLog({
        level: 'info',
        service: 'enhanced_hiring_intelligence',
        message: 'Hiring Intelligence Report Generated',
        metadata: report
      });
      
      // Send to Slack
      await this.slackService.sendSystemMessage(
        `🎯 Hiring Intelligence Report: ${totalHires} hires found across ${companiesScanned} companies. Average accuracy: ${Math.round(Object.values(this.hiringAccuracy).reduce((a, b) => a + b, 0) / this.hiringAccuracy.size)}%`,
        'info'
      );
      
      console.log('✅ Hiring intelligence report generated');
      
    } catch (error) {
      console.error('❌ Failed to generate hiring intelligence report:', error);
    }
  }

  private async getSourceBreakdown(): Promise<Record<string, number>> {
    const hires = await storage.getNewHires();
    const breakdown: Record<string, number> = {};
    
    hires.forEach(hire => {
      breakdown[hire.source] = (breakdown[hire.source] || 0) + 1;
    });
    
    return breakdown;
  }

  private async getConfidenceDistribution(): Promise<Record<string, number>> {
    const hires = await storage.getNewHires();
    const distribution: Record<string, number> = {
      'high (80-100%)': 0,
      'medium (60-79%)': 0,
      'low (0-59%)': 0
    };
    
    hires.forEach(hire => {
      const confidence = parseInt(hire.confidenceScore ?? '50') || 50;
      if (confidence >= 80) distribution['high (80-100%)']++;
      else if (confidence >= 60) distribution['medium (60-79%)']++;
      else distribution['low (0-59%)']++;
    });
    
    return distribution;
  }

  private async getTopHiringCompanies(): Promise<Array<{company: string, hires: number}>> {
    const hires = await storage.getNewHires();
    const companyCounts: Record<string, number> = {};
    
    hires.forEach(hire => {
      if (hire.company) {
        companyCounts[hire.company] = (companyCounts[hire.company] || 0) + 1;
      }
    });

    
    return Object.entries(companyCounts)
      .map(([company, hires]) => ({ company, hires }))
      .sort((a, b) => b.hires - a.hires)
      .slice(0, 10);
  }

  // Method to manually trigger enhanced hire detection for a specific company
  async enhancedDetectionForCompany(companyName: string): Promise<InsertNewHire[]> {
    try {
      console.log(`🎯 Running enhanced detection for ${companyName}`);
      
      const companies = await storage.getCompanies();
      const company = companies.find(c => c.name?.toLowerCase() === companyName.toLowerCase());

      
      if (!company) {
        throw new Error(`Company ${companyName} not found`);
      }
      
      const hires = await this.detectHiresMultiMethod(company);
      
      // Get analytics for this company
      console.log(`✅ Enhanced detection completed for ${companyName}:`);
      console.log(`   - Hires found: ${hires.length}`);

      if (company.name) {
        const analytics = await this.hiringIntelligence.getHiringAnalytics(company.name!);
        console.log(`   - Average confidence: ${analytics.averageConfidence}%`);
        console.log(`   - Sources used: ${Object.keys(analytics.sourceBreakdown).join(', ')}`);
      } else {

         console.log(`   - No analytics available as company name is missing in DB.`);
      }

      return hires;

      
    } catch (error) {
      console.error(`❌ Enhanced detection failed for ${companyName}:`, error);
      return [];
    }
  }

  // Method to add custom company configuration
  addCustomCompanyConfig(companyName: string, linkedinUrl: string, website: string, customSources?: any[]): void {
    this.hiringIntelligence.addCompanyConfig({
      name: companyName,
      linkedinUrl,
      website,
      sources: customSources || [
        { name: 'news', url: `${website}/news/`, selector: '.news-item', confidence: 80, enabled: true },
        { name: 'about', url: `${website}/about/`, selector: '.team-member', confidence: 70, enabled: true }
      ],
      keywords: ['welcome', 'joined', 'new hire', 'team member', 'appointed', 'announces'],
      excludeKeywords: ['left', 'departed', 'former', 'ex-']
    });
    
    console.log(`✅ Added custom configuration for ${companyName}`);
  }

  // Override cleanup to include enhanced service
  async cleanup(): Promise<void> {
    try {
      await super.cleanup();
      await this.hiringIntelligence.cleanup();
      console.log('🧹 Enhanced Job Tracker Service cleanup complete');
    } catch (error) {
      console.error('❌ Error during enhanced cleanup:', error);
    }
  }
}
