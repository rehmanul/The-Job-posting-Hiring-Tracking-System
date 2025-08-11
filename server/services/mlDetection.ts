import OpenAI from "openai";
import { InsertJobPosting, InsertNewHire } from "../../shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

export class MLDetectionService {
  private isEnabled: boolean;
  private openai: OpenAI | null = null;

  constructor() {
    this.isEnabled = !!process.env.OPENAI_API_KEY;
    if (this.isEnabled) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log('🤖 ML Detection Service initialized with OpenAI GPT-4o');
    } else {
      console.warn('⚠️ ML Detection Service disabled - OPENAI_API_KEY not found');
    }
  }

  async enhanceJobDetection(rawJobData: any, context: string): Promise<Partial<InsertJobPosting> & { confidenceScore: string }> {
    if (!this.isEnabled) {
      return {
        ...rawJobData,
        confidenceScore: '50' // Base confidence without ML
      };
    }

    try {
      const prompt = `Analyze this job posting data and enhance it with ML detection. 
      
Raw data: ${JSON.stringify(rawJobData)}
Context: ${context}

Please analyze and return a JSON object with these fields:
- jobTitle: cleaned and standardized job title
- department: inferred department/team
- seniorityLevel: entry/mid/senior/executive
- jobType: full-time/part-time/contract/internship
- isRemote: true/false
- confidenceScore: 0-100 score for detection accuracy
- skillsRequired: array of key skills mentioned
- salaryRange: estimated salary range if determinable
- urgency: low/medium/high based on posting language

Focus on accurate detection and classification.`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert job posting analyzer. Provide accurate, production-ready job classification and enhancement."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Low temperature for consistent results
      });

      const enhanced = JSON.parse(response.choices[0].message.content || '{}');

      return {
        jobTitle: enhanced.jobTitle || rawJobData.jobTitle,
        department: enhanced.department || rawJobData.department,
        location: rawJobData.location,
        postedDate: rawJobData.postedDate,
        url: rawJobData.url,
        source: rawJobData.source,
        confidenceScore: enhanced.confidenceScore?.toString() || '85',
        // Additional ML-enhanced fields
        seniorityLevel: enhanced.seniorityLevel,
        jobType: enhanced.jobType,
        isRemote: enhanced.isRemote,
        skillsRequired: enhanced.skillsRequired,
        salaryRange: enhanced.salaryRange,
        urgency: enhanced.urgency
      };

    } catch (error) {
      console.error('❌ ML job enhancement failed:', (error as Error).message);
      return {
        ...rawJobData,
        confidenceScore: '60' // Fallback confidence
      };
    }
  }

  async enhanceHireDetection(rawHireData: any, context: string): Promise<Partial<InsertNewHire> & { confidenceScore: string }> {
    if (!this.isEnabled) {
      return {
        ...rawHireData,
        confidenceScore: '50'
      };
    }

    try {
      const prompt = `Analyze this new hire data and enhance it with ML detection.
      
Raw data: ${JSON.stringify(rawHireData)}
Context: ${context}

Please analyze and return a JSON object with these fields:
- personName: cleaned name
- position: standardized job title
- department: inferred department
- seniorityLevel: entry/mid/senior/executive
- isExecutive: true/false if C-level or VP+
- confidenceScore: 0-100 score for detection accuracy
- previousCompany: if mentioned in bio
- startDate: estimated start date
- linkedinProfile: cleaned LinkedIn URL

Focus on accurate hire detection and person classification.`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert hiring pattern analyzer. Provide accurate, production-ready hire classification."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const enhanced = JSON.parse(response.choices[0].message.content || '{}');

      return {
        personName: enhanced.personName || rawHireData.personName,
        position: enhanced.position || rawHireData.position,
        company: rawHireData.company,
        startDate: enhanced.startDate || rawHireData.startDate,
        source: rawHireData.source,
        linkedinProfile: enhanced.linkedinProfile || rawHireData.linkedinProfile,
        confidenceScore: enhanced.confidenceScore?.toString() || '85',
        // Additional ML-enhanced fields
        department: enhanced.department,
        seniorityLevel: enhanced.seniorityLevel,
        isExecutive: enhanced.isExecutive,
        previousCompany: enhanced.previousCompany
      };

    } catch (error) {
      console.error('❌ ML hire enhancement failed:', (error as Error).message);
      return {
        ...rawHireData,
        confidenceScore: '60'
      };
    }
  }

  async detectJobPostingAnomaly(jobData: InsertJobPosting): Promise<{ isAnomaly: boolean; reason?: string; confidence: number }> {
    if (!this.isEnabled) {
      return { isAnomaly: false, confidence: 50 };
    }

    try {
      const prompt = `Analyze this job posting for anomalies that might indicate spam, fake jobs, or data quality issues:

Job Data: ${JSON.stringify(jobData)}

Return JSON with:
- isAnomaly: boolean
- reason: string explanation if anomaly detected
- confidence: 0-100 confidence in anomaly detection
- suggestions: array of improvement suggestions

Look for: unrealistic requirements, spam indicators, formatting issues, suspicious patterns.`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at detecting fake or low-quality job postings. Be thorough but not overly strict."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        isAnomaly: result.isAnomaly || false,
        reason: result.reason,
        confidence: result.confidence || 70
      };

    } catch (error) {
      console.error('❌ ML anomaly detection failed:', (error as Error).message);
      return { isAnomaly: false, confidence: 50 };
    }
  }
}