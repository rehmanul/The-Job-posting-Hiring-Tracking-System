import { GoogleGenerativeAI } from "@google/generative-ai";
import { InsertJobPosting, InsertNewHire } from "../../shared/schema";

export class GeminiService {
  private isEnabled = false;
  private genAI: GoogleGenerativeAI | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      console.log('🤖 Initializing Gemini AI Service...');

      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ Gemini AI Service disabled - GEMINI_API_KEY not found');
        this.isEnabled = false;
        this.isInitialized = true;
        return;
      }

      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      // Test API connection
      await this.testConnection();

      this.isEnabled = true;
      this.isInitialized = true;

      console.log('✅ Gemini AI Service initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI Service:', error);
      this.isEnabled = false;
      this.isInitialized = true;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.genAI) throw new Error('Gemini client not initialized');

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      await model.generateContent("test");
    } catch (error) {
      throw new Error(`Gemini API test failed: ${(error as Error).message}`);
    }
  }

  async classifyJob(jobTitle: string, jobDescription: string): Promise<{
    department: string;
    seniority: string;
    skills: string[];
    remote: boolean;
    confidence: number;
  }> {
    if (!this.isEnabled || !this.genAI) {
      return this.fallbackClassification(jobTitle, jobDescription);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
      
      const prompt = `Analyze this job posting and classify it:

Job Title: ${jobTitle}
Job Description: ${jobDescription.slice(0, 1000)}

Return a JSON object with:
- department: (Engineering, Marketing, Sales, HR, Finance, Operations, Design, Data, Product, Customer Success, Legal, Executive, Other)
- seniority: (Entry, Mid, Senior, Lead, Manager, Director, VP, Executive)
- skills: array of up to 5 key technical skills mentioned
- remote: boolean if mentions remote/hybrid work
- confidence: float 0-1 indicating classification confidence

Example: {"department": "Engineering", "seniority": "Senior", "skills": ["React", "Node.js", "TypeScript"], "remote": true, "confidence": 0.9}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      if (!content) throw new Error('No response content');

      const classification = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

      if (!classification.department || !classification.seniority) {
        throw new Error('Invalid classification response');
      }

      return {
        department: classification.department,
        seniority: classification.seniority,
        skills: classification.skills || [],
        remote: classification.remote || false,
        confidence: classification.confidence || 0.8
      };

    } catch (error) {
      console.warn('⚠️ Gemini classification failed, using fallback:', error);
      return this.fallbackClassification(jobTitle, jobDescription);
    }
  }

  async classifyHire(personName: string, position: string): Promise<{
    position: string;
    department: string;
    seniority: string;
    confidence: number;
  }> {
    if (!this.isEnabled || !this.genAI) {
      return {
        position,
        department: this.classifyDepartmentFromTitle(position),
        seniority: this.classifySeniorityFromTitle(position),
        confidence: 0.6
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
      
      const prompt = `Analyze this new hire information and classify:

Person: ${personName}
Position: ${position}

Return JSON with:
- position: cleaned/standardized position title
- department: (Engineering, Marketing, Sales, HR, Finance, Operations, Design, Data, Product, Customer Success, Legal, Executive, Other)
- seniority: (Entry, Mid, Senior, Lead, Manager, Director, VP, Executive)
- confidence: float 0-1 indicating classification confidence`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      if (!content) throw new Error('No response content');

      const classification = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

      return {
        position: classification.position || position,
        department: classification.department || 'Other',
        seniority: classification.seniority || 'Mid',
        confidence: classification.confidence || 0.8
      };

    } catch (error) {
      console.warn('⚠️ Gemini hire classification failed, using fallback:', error);
      return {
        position,
        department: this.classifyDepartmentFromTitle(position),
        seniority: this.classifySeniorityFromTitle(position),
        confidence: 0.6
      };
    }
  }

  private fallbackClassification(jobTitle: string, jobDescription: string): {
    department: string;
    seniority: string;
    skills: string[];
    remote: boolean;
    confidence: number;
  } {
    const titleLower = jobTitle.toLowerCase();
    const descLower = jobDescription.toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    // Department classification
    let department = 'Other';
    if (this.containsAny(combined, ['engineer', 'developer', 'software', 'full stack', 'backend', 'frontend', 'devops', 'sre', 'architect'])) {
      department = 'Engineering';
    } else if (this.containsAny(combined, ['marketing', 'content', 'seo', 'campaign', 'brand', 'growth'])) {
      department = 'Marketing';
    } else if (this.containsAny(combined, ['sales', 'account', 'business development', 'revenue'])) {
      department = 'Sales';
    } else if (this.containsAny(combined, ['data', 'analytics', 'scientist', 'analyst', 'bi', 'ml', 'ai'])) {
      department = 'Data';
    } else if (this.containsAny(combined, ['product', 'pm', 'product manager'])) {
      department = 'Product';
    } else if (this.containsAny(combined, ['design', 'ui', 'ux', 'visual', 'creative'])) {
      department = 'Design';
    } else if (this.containsAny(combined, ['hr', 'human resources', 'people', 'talent', 'recruiter'])) {
      department = 'HR';
    }

    // Seniority classification
    let seniority = 'Mid';
    if (this.containsAny(combined, ['intern', 'junior', 'entry', 'graduate', 'associate'])) {
      seniority = 'Entry';
    } else if (this.containsAny(combined, ['senior', 'sr.', 'lead', 'principal', 'staff'])) {
      seniority = 'Senior';
    } else if (this.containsAny(combined, ['manager', 'head of', 'team lead'])) {
      seniority = 'Manager';
    } else if (this.containsAny(combined, ['director', 'vp', 'vice president', 'chief'])) {
      seniority = 'Director';
    }

    // Skills extraction
    const skillKeywords = [
      'javascript', 'typescript', 'react', 'node.js', 'python', 'java', 'c++', 'go', 'rust',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'git', 'sql', 'mongodb',
      'redis', 'elasticsearch', 'kafka', 'microservices', 'rest', 'graphql', 'machine learning',
      'tensorflow', 'pytorch', 'pandas', 'numpy', 'spark', 'hadoop', 'tableau', 'power bi'
    ];

    const skills = skillKeywords.filter(skill => 
      combined.includes(skill.toLowerCase())
    ).slice(0, 5);

    const remote = this.containsAny(combined, ['remote', 'hybrid', 'work from home', 'distributed']);

    return {
      department,
      seniority,
      skills,
      remote,
      confidence: 0.6
    };
  }

  private classifyDepartmentFromTitle(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (this.containsAny(titleLower, ['engineer', 'developer', 'software', 'full stack', 'backend', 'frontend', 'devops', 'sre', 'architect'])) {
      return 'Engineering';
    } else if (this.containsAny(titleLower, ['marketing', 'content', 'seo', 'campaign', 'brand', 'growth'])) {
      return 'Marketing';
    } else if (this.containsAny(titleLower, ['sales', 'account', 'business development', 'revenue'])) {
      return 'Sales';
    } else if (this.containsAny(titleLower, ['data', 'analytics', 'scientist', 'analyst', 'bi', 'ml', 'ai'])) {
      return 'Data';
    } else if (this.containsAny(titleLower, ['product', 'pm', 'product manager'])) {
      return 'Product';
    } else if (this.containsAny(titleLower, ['design', 'ui', 'ux', 'visual', 'creative'])) {
      return 'Design';
    } else if (this.containsAny(titleLower, ['hr', 'human resources', 'people', 'talent', 'recruiter'])) {
      return 'HR';
    }
    
    return 'Other';
  }

  private classifySeniorityFromTitle(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (this.containsAny(titleLower, ['intern', 'junior', 'entry', 'graduate', 'associate'])) {
      return 'Entry';
    } else if (this.containsAny(titleLower, ['senior', 'sr.', 'lead', 'principal', 'staff'])) {
      return 'Senior';
    } else if (this.containsAny(titleLower, ['manager', 'head of', 'team lead'])) {
      return 'Manager';
    } else if (this.containsAny(titleLower, ['director', 'vp', 'vice president', 'chief'])) {
      return 'Director';
    }
    
    return 'Mid';
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  async detectDuplicateJob(
    newJob: { jobTitle: string; company: string; description?: string },
    existingJobs: Array<{ jobTitle: string; company: string; description?: string }>
  ): Promise<{ isDuplicate: boolean; similarity: number; matchedJob?: any }> {

    if (!this.isEnabled || !this.genAI) {
      const exactMatch = existingJobs.find(job => 
        job.jobTitle.toLowerCase() === newJob.jobTitle.toLowerCase() &&
        job.company.toLowerCase() === newJob.company.toLowerCase()
      );

      return {
        isDuplicate: !!exactMatch,
        similarity: exactMatch ? 1.0 : 0.0,
        matchedJob: exactMatch
      };
    }

    try {
      for (const existingJob of existingJobs) {
        const similarity = await this.calculateSimilarity(newJob, existingJob);

        if (similarity > 0.85) {
          return {
            isDuplicate: true,
            similarity,
            matchedJob: existingJob
          };
        }
      }

      return { isDuplicate: false, similarity: 0.0 };

    } catch (error) {
      console.warn('⚠️ Duplicate detection failed:', error);
      return { isDuplicate: false, similarity: 0.0 };
    }
  }

  private async calculateSimilarity(job1: any, job2: any): Promise<number> {
    if (!this.genAI) return 0;

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
      
      const prompt = `Compare these two job postings and rate their similarity from 0.0 to 1.0:

Job 1:
Company: ${job1.company}
Title: ${job1.jobTitle}
Description: ${job1.description || ''}

Job 2:
Company: ${job2.company}
Title: ${job2.jobTitle}
Description: ${job2.description || ''}

Return only a number between 0.0 and 1.0 representing similarity.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      const similarity = parseFloat(content.trim());
      return isNaN(similarity) ? 0 : Math.max(0, Math.min(1, similarity));

    } catch (error) {
      console.warn('⚠️ Similarity calculation failed:', error);
      return 0;
    }
  }
}