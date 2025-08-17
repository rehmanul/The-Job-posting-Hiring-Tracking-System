import type { Company, InsertJobPosting } from '@shared/schema';
import { storage } from '../storage';

export class WorkingJobTracker {
  private customSearchKey: string;
  private customSearchEngineId: string;
  private geminiApiKey: string;

  constructor() {
    this.customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '';
    this.customSearchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
  }

  async trackCompanyJobs(company: Company): Promise<InsertJobPosting[]> {
    const logMessage = `🔍 WORKING job tracker for ${company.name}`;
    console.log(logMessage);
    await this.logToDatabase('info', 'working_job_tracker', logMessage);

    if (!this.customSearchKey || !this.customSearchEngineId) {
      console.warn(`⚠️ Google Custom Search not configured`);
      return [];
    }

    const jobs: InsertJobPosting[] = [];

    try {
      // Professional job search queries
      const searchQueries = [
        `"${company.name}" "careers" "jobs" "hiring" site:${company.website}`,
        `"${company.name}" "job openings" "apply now" site:linkedin.com`,
        `"${company.name}" "we are hiring" "join our team"`,
        `"${company.name}" "software engineer" OR "developer" OR "manager" jobs`,
        `"${company.name}" "remote" OR "hybrid" jobs careers`
      ];

      for (const query of searchQueries) {
        try {
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.customSearchKey}&cx=${this.customSearchEngineId}&q=${encodeURIComponent(query)}&num=5&dateRestrict=m1`;
          
          const response = await fetch(searchUrl);
          if (!response.ok) continue;
          
          const data = await response.json();
          
          if (data.items) {
            for (const item of data.items) {
              const job = await this.extractJobFromSearchResult(item, company);
              if (job) jobs.push(job);
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn(`Job search query failed for ${company.name}:`, error);
        }
      }

      const validJobs = this.validateAndDeduplicateJobs(jobs);
      const resultMessage = `✅ Working job tracker found ${validJobs.length} REAL JOBS for ${company.name}`;
      console.log(resultMessage);
      await this.logToDatabase('info', 'working_job_tracker', resultMessage);

      return validJobs;

    } catch (error) {
      const errorMessage = `❌ Working job tracker error for ${company.name}: ${error}`;
      console.error(errorMessage);
      await this.logToDatabase('error', 'working_job_tracker', errorMessage);
      return [];
    }
  }

  private async extractJobFromSearchResult(item: any, company: Company): Promise<InsertJobPosting | null> {
    const fullText = `${item.title} ${item.snippet}`;
    
    // Use Gemini AI to extract structured job data
    if (this.geminiApiKey) {
      try {
        const aiExtracted = await this.extractJobWithGemini(fullText, company, item.link);
        if (aiExtracted) return aiExtracted;
      } catch (error) {
        console.warn('Gemini job extraction failed, using regex fallback');
      }
    }
    
    // Fallback to regex patterns
    return this.extractJobWithRegex(fullText, company, item.link);
  }

  private async extractJobWithGemini(text: string, company: Company, url: string): Promise<InsertJobPosting | null> {
    try {
      const prompt = `Extract job posting information from this text. Return ONLY a JSON object with jobTitle, location, jobType, and description fields. If no clear job posting, return null.

Text: "${text}"

Requirements:
- jobTitle must be a professional job title (Engineer, Manager, Director, etc.)
- location should be city/country or "Remote"
- jobType should be "Full-time", "Part-time", "Contract", etc.
- Ignore garbage titles like "Working", "Reviews", "Content"

Example: {"jobTitle": "Software Engineer", "location": "London, UK", "jobType": "Full-time", "description": "Join our engineering team"}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiResponse) return null;

      // Try to parse JSON from AI response
      const jsonMatch = aiResponse.match(/\{[^}]+\}/);
      if (!jsonMatch) return null;

      const extracted = JSON.parse(jsonMatch[0]);
      
      if (extracted.jobTitle && this.validateJobTitle(extracted.jobTitle)) {
        return {
          jobTitle: extracted.jobTitle,
          company: company.name,
          location: extracted.location || 'Not specified',
          jobType: extracted.jobType || 'Full-time',
          description: extracted.description || '',
          requirements: '',
          salary: null,
          postedDate: new Date(),
          applicationUrl: url,
          source: 'Gemini AI + Custom Search',
          foundDate: new Date()
        };
      }

    } catch (error) {
      console.warn('Gemini AI job extraction failed:', error);
    }

    return null;
  }

  private extractJobWithRegex(text: string, company: Company, url: string): InsertJobPosting | null {
    // Professional job title patterns
    const jobPatterns = [
      /(Software Engineer|Developer|Engineering Manager|Product Manager|Data Scientist|DevOps Engineer|Frontend Developer|Backend Developer|Full Stack Developer|Senior Developer|Lead Developer|Principal Engineer|Staff Engineer|Director of Engineering|VP Engineering|CTO|Technical Lead|Architect|QA Engineer|Test Engineer|Security Engineer|Site Reliability Engineer|Platform Engineer|Mobile Developer|iOS Developer|Android Developer|UI\/UX Designer|Product Designer|UX Researcher|Data Analyst|Business Analyst|Project Manager|Scrum Master|Product Owner|Marketing Manager|Sales Manager|Account Manager|Customer Success Manager|Support Engineer|Technical Writer|DevRel Engineer|Solutions Architect|Cloud Engineer|Machine Learning Engineer|AI Engineer|Blockchain Developer|Game Developer|Embedded Engineer|Hardware Engineer|Network Engineer|Database Administrator|System Administrator|IT Manager|CISO|Information Security|Compliance Officer|Legal Counsel|HR Manager|Recruiter|Talent Acquisition|Finance Manager|Accounting Manager|Operations Manager|Supply Chain Manager|Logistics Manager|Procurement Manager|Facilities Manager|Office Manager|Executive Assistant|Administrative Assistant|Intern|Graduate|Junior|Senior|Lead|Principal|Staff|Distinguished|Fellow)/i
    ];

    for (const pattern of jobPatterns) {
      const match = text.match(pattern);
      if (match) {
        const jobTitle = match[1];
        
        if (this.validateJobTitle(jobTitle)) {
          return {
            jobTitle,
            company: company.name,
            location: this.extractLocation(text) || 'Not specified',
            jobType: this.extractJobType(text) || 'Full-time',
            description: text.substring(0, 500),
            requirements: '',
            salary: null,
            postedDate: new Date(),
            applicationUrl: url,
            source: 'Regex + Custom Search',
            foundDate: new Date()
          };
        }
      }
    }

    return null;
  }

  private extractLocation(text: string): string | null {
    const locationPatterns = [
      /(?:in|at|based in)\s+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)/i,
      /(Remote|Hybrid|On-site)/i,
      /([A-Z][a-z]+,\s*[A-Z]{2,3})/i // City, Country/State
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private extractJobType(text: string): string | null {
    const typePatterns = [
      /(Full-time|Part-time|Contract|Freelance|Temporary|Internship)/i
    ];

    for (const pattern of typePatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private validateJobTitle(title: string): boolean {
    if (!title || title.length < 3) return false;
    
    // Must contain professional keywords
    const professionalKeywords = [
      'engineer', 'developer', 'manager', 'director', 'analyst', 'specialist', 
      'coordinator', 'lead', 'senior', 'principal', 'architect', 'designer',
      'scientist', 'researcher', 'consultant', 'advisor', 'executive', 'officer',
      'administrator', 'technician', 'associate', 'assistant', 'intern'
    ];
    
    const titleLower = title.toLowerCase();
    const hasKeyword = professionalKeywords.some(keyword => titleLower.includes(keyword));
    
    // Reject garbage terms
    const garbageTerms = [
      'working', 'reviews', 'pros', 'cons', 'content', 'market', 'bet365',
      'recently', 'started', 'very', 'excited', 'announce', 'new position'
    ];
    
    const hasGarbage = garbageTerms.some(term => titleLower.includes(term));
    
    return hasKeyword && !hasGarbage;
  }

  private validateAndDeduplicateJobs(jobs: InsertJobPosting[]): InsertJobPosting[] {
    // Filter valid jobs
    const validJobs = jobs.filter(job => 
      job.jobTitle && 
      this.validateJobTitle(job.jobTitle)
    );
    
    // Deduplicate by title + company
    const seen = new Set<string>();
    const uniqueJobs = validJobs.filter(job => {
      const key = `${job.jobTitle.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`🎯 Validated ${validJobs.length} jobs, deduplicated to ${uniqueJobs.length} unique`);
    
    return uniqueJobs;
  }

  private async logToDatabase(level: string, service: string, message: string): Promise<void> {
    try {
      await storage.createSystemLog({
        level,
        service,
        message,
        metadata: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      // Ignore database logging errors
    }
  }
}