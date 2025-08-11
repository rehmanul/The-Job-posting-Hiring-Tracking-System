import type { Company } from '../../shared/schema';

/**
 * Production configuration for 16+ target companies
 * Each company configured for automated job tracking and hire monitoring
 */
export const TARGET_COMPANIES: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Tech Giants
  {
    name: 'Google',
    website: 'https://google.com',
    careerPageUrl: 'https://careers.google.com/jobs/results/',
    linkedinUrl: 'https://www.linkedin.com/company/google/',
    industry: 'Technology',
    isActive: true,
    location: 'Mountain View, CA'
  },
  {
    name: 'Meta',
    website: 'https://meta.com',
    careerPageUrl: 'https://www.metacareers.com/jobs/',
    linkedinUrl: 'https://www.linkedin.com/company/meta/',
    industry: 'Social Media',
    isActive: true,
    location: 'Menlo Park, CA'
  },
  {
    name: 'Microsoft',
    website: 'https://microsoft.com',
    careerPageUrl: 'https://careers.microsoft.com/us/en/search-results',
    linkedinUrl: 'https://www.linkedin.com/company/microsoft/',
    industry: 'Technology',
    isActive: true,
    location: 'Redmond, WA'
  },
  {
    name: 'Amazon',
    website: 'https://amazon.com',
    careerPageUrl: 'https://www.amazon.jobs/en/search',
    linkedinUrl: 'https://www.linkedin.com/company/amazon/',
    industry: 'E-commerce',
    isActive: true,
    location: 'Seattle, WA'
  },
  {
    name: 'Apple',
    website: 'https://apple.com',
    careerPageUrl: 'https://jobs.apple.com/en-us/search',
    linkedinUrl: 'https://www.linkedin.com/company/apple/',
    industry: 'Consumer Electronics',
    isActive: true,
    location: 'Cupertino, CA'
  },

  // Financial Services
  {
    name: 'JPMorgan Chase',
    website: 'https://jpmorganchase.com',
    careerPageUrl: 'https://careers.jpmorgan.com/US/en/search-results',
    linkedinUrl: 'https://www.linkedin.com/company/jpmorgan-chase/',
    industry: 'Financial Services',
    isActive: true,
    location: 'New York, NY'
  },
  {
    name: 'Goldman Sachs',
    website: 'https://goldmansachs.com',
    careerPageUrl: 'https://www.goldmansachs.com/careers/explore-careers/',
    linkedinUrl: 'https://www.linkedin.com/company/goldman-sachs/',
    industry: 'Investment Banking',
    isActive: true,
    location: 'New York, NY'
  },
  {
    name: 'Morgan Stanley',
    website: 'https://morganstanley.com',
    careerPageUrl: 'https://www.morganstanley.com/careers/search-jobs',
    linkedinUrl: 'https://www.linkedin.com/company/morgan-stanley/',
    industry: 'Financial Services',
    isActive: true,
    location: 'New York, NY'
  },

  // Consulting
  {
    name: 'McKinsey & Company',
    website: 'https://mckinsey.com',
    careerPageUrl: 'https://www.mckinsey.com/careers/search-jobs',
    linkedinUrl: 'https://www.linkedin.com/company/mckinsey/',
    industry: 'Management Consulting',
    isActive: true,
    location: 'New York, NY'
  },
  {
    name: 'Boston Consulting Group',
    website: 'https://bcg.com',
    careerPageUrl: 'https://careers.bcg.com/search',
    linkedinUrl: 'https://www.linkedin.com/company/boston-consulting-group/',
    industry: 'Management Consulting',
    isActive: true,
    location: 'Boston, MA'
  },
  {
    name: 'Bain & Company',
    website: 'https://bain.com',
    careerPageUrl: 'https://www.bain.com/careers/find-a-role/',
    linkedinUrl: 'https://www.linkedin.com/company/bain-and-company/',
    industry: 'Management Consulting',
    isActive: true,
    location: 'Boston, MA'
  },

  // Unicorn Startups
  {
    name: 'Stripe',
    website: 'https://stripe.com',
    careerPageUrl: 'https://stripe.com/jobs/search',
    linkedinUrl: 'https://www.linkedin.com/company/stripe/',
    industry: 'Fintech',
    isActive: true,
    location: 'San Francisco, CA'
  },
  {
    name: 'SpaceX',
    website: 'https://spacex.com',
    careerPageUrl: 'https://www.spacex.com/careers/',
    linkedinUrl: 'https://www.linkedin.com/company/spacex/',
    industry: 'Aerospace',
    isActive: true,
    location: 'Hawthorne, CA'
  },
  {
    name: 'Airbnb',
    website: 'https://airbnb.com',
    careerPageUrl: 'https://careers.airbnb.com/',
    linkedinUrl: 'https://www.linkedin.com/company/airbnb/',
    industry: 'Travel',
    isActive: true,
    location: 'San Francisco, CA'
  },
  {
    name: 'Uber',
    website: 'https://uber.com',
    careerPageUrl: 'https://www.uber.com/us/en/careers/list/',
    linkedinUrl: 'https://www.linkedin.com/company/uber-com/',
    industry: 'Transportation',
    isActive: true,
    location: 'San Francisco, CA'
  },
  {
    name: 'Netflix',
    website: 'https://netflix.com',
    careerPageUrl: 'https://jobs.netflix.com/search',
    linkedinUrl: 'https://www.linkedin.com/company/netflix/',
    industry: 'Entertainment',
    isActive: true,
    location: 'Los Gatos, CA'
  },

  // Additional High-Growth Companies
  {
    name: 'Palantir',
    website: 'https://palantir.com',
    careerPageUrl: 'https://www.palantir.com/careers/',
    linkedinUrl: 'https://www.linkedin.com/company/palantir-technologies/',
    industry: 'Data Analytics',
    isActive: true,
    location: 'Denver, CO'
  },
  {
    name: 'Databricks',
    website: 'https://databricks.com',
    careerPageUrl: 'https://www.databricks.com/company/careers/open-positions',
    linkedinUrl: 'https://www.linkedin.com/company/databricks/',
    industry: 'Data & AI',
    isActive: true,
    location: 'San Francisco, CA'
  },
  {
    name: 'Snowflake',
    website: 'https://snowflake.com',
    careerPageUrl: 'https://careers.snowflake.com/us/en/search-results',
    linkedinUrl: 'https://www.linkedin.com/company/snowflake-computing/',
    industry: 'Cloud Computing',
    isActive: true,
    location: 'Bozeman, MT'
  }
];

/**
 * Initialize target companies in the database
 * This ensures all production companies are tracked from day one
 */
export async function initializeTargetCompanies(): Promise<void> {
  const { storage } = await import('../storage');
  
  console.log('🏢 Initializing target companies for production tracking...');
  
  let companiesAdded = 0;
  let companiesUpdated = 0;
  
  for (const companyData of TARGET_COMPANIES) {
    try {
      // Check if company already exists
      const existingCompanies = await storage.getCompanies();
      const existingCompany = existingCompanies.find(c => 
        c.name.toLowerCase() === companyData.name.toLowerCase()
      );
      
      if (existingCompany) {
        // Update existing company with latest configuration
        await storage.updateCompany(existingCompany.id, {
          ...companyData,
          updatedAt: new Date()
        });
        companiesUpdated++;
        console.log(`✅ Updated company: ${companyData.name}`);
      } else {
        // Create new company
        await storage.createCompany({
          ...companyData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        companiesAdded++;
        console.log(`🆕 Added new company: ${companyData.name}`);
      }
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Failed to initialize company ${companyData.name}:`, error);
    }
  }
  
  console.log(`✅ Company initialization complete:`);
  console.log(`   📈 ${companiesAdded} companies added`);
  console.log(`   🔄 ${companiesUpdated} companies updated`);
  console.log(`   🎯 ${TARGET_COMPANIES.length} total companies configured for tracking`);
}