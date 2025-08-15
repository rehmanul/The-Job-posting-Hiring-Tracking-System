/**
 * Gaming Industry Companies Configuration
 * Production-ready configuration for iGaming and sports betting companies
 */

import type { InsertCompany } from '../../shared/schema';
import { storage } from '../storage';

/**
 * Production configuration for 20+ iGaming companies
 * Each company configured for automated job tracking and hire monitoring
 */
export const GAMING_COMPANIES: InsertCompany[] = [
  // Major iGaming Operators
  {
    name: 'Evoke plc',
    website: 'https://www.evokeplc.com',
    careerPageUrl: 'https://www.evokeplc.com/careers/',
    linkedinUrl: 'https://www.linkedin.com/company/evoke-plc/',
    industry: 'iGaming',
    isActive: true,
    location: 'London, UK'
  },
  {
    name: 'Betsson Group',
    website: 'https://www.betssongroup.com',
    careerPageUrl: 'https://www.betssongroup.com/career/available-jobs/',
    linkedinUrl: 'https://www.linkedin.com/company/betsson-group/',
    industry: 'iGaming',
    isActive: true,
    location: 'Stockholm, Sweden'
  },
  {
    name: 'Super Group (Betway)',
    website: 'https://supergroup.com',
    careerPageUrl: 'https://myhcm.wd3.myworkdayjobs.com/Betway',
    linkedinUrl: 'https://www.linkedin.com/company/betway/',
    industry: 'iGaming',
    isActive: true,
    location: 'Guernsey, Channel Islands'
  },
  {
    name: 'Catena Media',
    website: 'https://www.catenamedia.com',
    careerPageUrl: 'https://jobs.lever.co/catenamedia',
    linkedinUrl: 'https://www.linkedin.com/company/catena-media/',
    industry: 'iGaming',
    isActive: true,
    location: 'Malta'
  },
  {
    name: 'Entain',
    website: 'https://www.entain.com',
    careerPageUrl: 'https://www.entaincareers.com/en/',
    linkedinUrl: 'https://www.linkedin.com/company/entain/',
    industry: 'iGaming',
    isActive: true,
    location: 'London, UK'
  },
  {
    name: 'Evolution',
    website: 'https://www.evolution.com',
    careerPageUrl: 'https://careers.evolution.com',
    linkedinUrl: 'https://www.linkedin.com/company/evolution-gaming/',
    industry: 'iGaming',
    isActive: true,
    location: 'Stockholm, Sweden'
  },
  {
    name: 'Flutter Entertainment',
    website: 'https://flutter.com',
    careerPageUrl: 'https://careers.fluttergroup.com/jobs/',
    linkedinUrl: 'https://www.linkedin.com/company/flutter-entertainment/',
    industry: 'iGaming',
    isActive: true,
    location: 'Dublin, Ireland'
  },
  {
    name: 'Gaming Innovation Group (GiG)',
    website: 'https://www.gig.com',
    careerPageUrl: 'https://gig.pinpointhq.com/',
    linkedinUrl: 'https://www.linkedin.com/company/gaming-innovation-group/',
    industry: 'iGaming',
    isActive: true,
    location: 'Malta'
  },
  {
    name: 'Genius Sports',
    website: 'https://www.geniussports.com',
    careerPageUrl: 'https://www.geniussports.com/careers/',
    linkedinUrl: 'https://www.linkedin.com/company/genius-sports/',
    industry: 'Sports Technology',
    isActive: true,
    location: 'London, UK'
  },
  {
    name: 'FDJ United',
    website: 'https://www.fdjunited.com',
    careerPageUrl: 'https://www.fdjunited.com/careers/',
    linkedinUrl: 'https://www.linkedin.com/company/fdj-united/',
    industry: 'iGaming',
    isActive: true,
    location: 'Malta'
  },
  {
    name: 'LeoVegas',
    website: 'https://www.leovegasgroup.com',
    careerPageUrl: 'https://www.leovegasgroup.com/careers/',
    linkedinUrl: 'https://www.linkedin.com/company/leovegas/',
    industry: 'iGaming',
    isActive: true,
    location: 'Stockholm, Sweden'
  },
  {
    name: 'NetEnt',
    website: 'https://www.netent.com',
    careerPageUrl: 'https://www.netent.com/en/open-positions/',
    linkedinUrl: 'https://www.linkedin.com/company/netent/',
    industry: 'iGaming',
    isActive: true,
    location: 'Stockholm, Sweden'
  },
  {
    name: 'Playtech',
    website: 'https://www.playtech.com',
    careerPageUrl: 'https://www.playtechpeople.com/',
    linkedinUrl: 'https://www.linkedin.com/company/playtech/',
    industry: 'iGaming',
    isActive: true,
    location: 'Tallinn, Estonia'
  },
  {
    name: 'The Workshop',
    website: 'https://theworkshop.com',
    careerPageUrl: 'https://careers.theworkshop.com/',
    linkedinUrl: 'https://www.linkedin.com/company/the-workshop/',
    industry: 'iGaming',
    isActive: true,
    location: 'Malaga, Spain'
  },
  {
    name: 'William Hill',
    website: 'https://www.williamhillgroup.com',
    careerPageUrl: 'https://www.williamhillgroup.com/careers',
    linkedinUrl: 'https://www.linkedin.com/company/william-hill/',
    industry: 'iGaming',
    isActive: true,
    location: 'London, UK'
  },
  {
    name: 'Yolo Group',
    website: 'https://yolo.group',
    careerPageUrl: 'https://yolo.com/jobs',
    linkedinUrl: 'https://www.linkedin.com/company/yolo-group/',
    industry: 'iGaming',
    isActive: true,
    location: 'Tallinn, Estonia'
  },
  {
    name: 'bet365',
    website: 'https://www.bet365.com',
    careerPageUrl: 'https://www.bet365careers.com/en/all-jobs',
    linkedinUrl: 'https://www.linkedin.com/company/bet365/',
    industry: 'iGaming',
    isActive: true,
    location: 'Stoke-on-Trent, UK'
  },
  {
    name: 'Better Collective',
    website: 'https://bettercollective.com',
    careerPageUrl: 'https://bettercollective.com/careers/',
    linkedinUrl: 'https://www.linkedin.com/company/better-collective/',
    industry: 'iGaming',
    isActive: true,
    location: 'Copenhagen, Denmark'
  }
];

let isInitialized = false;

/**
 * Initialize gaming companies in the database
 * This ensures all iGaming companies are tracked from day one
 */
export async function initializeGamingCompanies(): Promise<void> {
  if (isInitialized) {
    return;
  }
  
  // Check if companies already exist in database
  const existingCompanies = await storage.getCompanies();
  if (existingCompanies.length >= 18) {
    isInitialized = true;
    return;
  }
  
  console.log('🎰 Initializing gaming companies for production tracking...');
  
  let companiesAdded = 0;
  let companiesUpdated = 0;
  
  // Get all existing companies once
  const allExistingCompanies = await storage.getCompanies();
  
  for (const companyData of GAMING_COMPANIES) {
    try {
      const existingCompany = allExistingCompanies.find(c => 
        c.name.toLowerCase() === companyData.name.toLowerCase()
      );
      
      if (existingCompany) {
        companiesUpdated++;
        // Skip update to avoid spam
      } else {
        await storage.createCompany(companyData);
        companiesAdded++;
        console.log(`🆕 Added new company: ${companyData.name}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to initialize company ${companyData.name}:`, error);
    }
  }
  
  console.log(`✅ Gaming companies initialization complete:`);
  console.log(`   📈 ${companiesAdded} companies added`);
  console.log(`   🔄 ${companiesUpdated} companies updated`);
  console.log(`   🎯 ${GAMING_COMPANIES.length} total gaming companies configured for tracking`);
  
  isInitialized = true;
}
