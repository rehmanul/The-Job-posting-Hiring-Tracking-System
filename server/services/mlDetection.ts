import OpenAI from "openai";
import { InsertJobPosting, InsertNewHire } from "../../shared/schema";

export class MLDetectionService {
  private isEnabled = false;
  private openAIClient: OpenAI | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      console.log('🤖 Initializing ML Detection Service...');

      if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️ ML Detection Service disabled - OPENAI_API_KEY not found');
        this.isEnabled = false;
        this.isInitialized = true;
        return;
      }

      this.openAIClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Test API connection
      await this.testConnection();

      this.isEnabled = true;
      this.isInitialized = true;

      console.log('✅ ML Detection Service initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize ML Detection Service:', error);
      this.isEnabled = false;
      this.isInitialized = true;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.openAIClient) throw new Error('OpenAI client not initialized');

    try {
      await this.openAIClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
    } catch (error) {
      throw new Error(`OpenAI API test failed: ${(error as Error).message}`);
    }
  }

  async classifyJob(jobTitle: string, jobDescription: string): Promise<{
    department: string;
    seniority: string;
    skills: string[];
    remote: boolean;
    confidence: number;
  }> {
    if (!this.isEnabled || !this.openAIClient) {
      // Fallback classification using keyword matching
      return this.fallbackClassification(jobTitle, jobDescription);
    }

    try {
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

      const response = await this.openAIClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response content');

      const classification = JSON.parse(content);

      // Validate response structure
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
      console.warn('⚠️ ML classification failed, using fallback:', error);
      return this.fallbackClassification(jobTitle, jobDescription);
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

    // Skills extraction (basic keyword matching)
    const skillKeywords = [
      'javascript', 'typescript', 'react', 'node.js', 'python', 'java', 'c++', 'go', 'rust',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'git', 'sql', 'mongodb',
      'redis', 'elasticsearch', 'kafka', 'microservices', 'rest', 'graphql', 'machine learning',
      'tensorflow', 'pytorch', 'pandas', 'numpy', 'spark', 'hadoop', 'tableau', 'power bi'
    ];

    const skills = skillKeywords.filter(skill => 
      combined.includes(skill.toLowerCase())
    ).slice(0, 5);

    // Remote work detection
    const remote = this.containsAny(combined, ['remote', 'hybrid', 'work from home', 'distributed']);

    return {
      department,
      seniority,
      skills,
      remote,
      confidence: 0.6 // Lower confidence for fallback
    };
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  async detectDuplicateJob(
    newJob: { jobTitle: string; company: string; description?: string },
    existingJobs: Array<{ jobTitle: string; company: string; description?: string }>
  ): Promise<{ isDuplicate: boolean; similarity: number; matchedJob?: any }> {

    if (!this.isEnabled || !this.openAIClient) {
      // Simple fallback duplicate detection
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
      // Use semantic similarity for more accurate duplicate detection
      for (const existingJob of existingJobs) {
        const similarity = await this.calculateSimilarity(newJob, existingJob);

        if (similarity > 0.85) { // High similarity threshold
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
    if (!this.openAIClient) return 0;

    try {
      const prompt = `Compare these two job postings and rate their similarity from 0.0 to 1.0:

Job 1: ${job1.jobTitle} at ${job1.company}
Description: ${job1.description?.slice(0, 300) || 'N/A'}

Job 2: ${job2.jobTitle} at ${job2.company}
Description: ${job2.description?.slice(0, 300) || 'N/A'}

Return only a number between 0.0 and 1.0 representing similarity (1.0 = identical, 0.0 = completely different).`;

      const response = await this.openAIClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0.1
      });

      const similarity = parseFloat(response.choices[0]?.message?.content || '0');
      return Math.max(0, Math.min(1, similarity)); // Clamp between 0 and 1

    } catch (error) {
      console.warn('⚠️ Similarity calculation failed:', error);
      return 0;
    }
  }
}