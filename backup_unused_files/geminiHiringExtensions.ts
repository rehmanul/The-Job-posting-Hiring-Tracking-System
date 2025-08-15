import { GeminiService } from './geminiService';
import type { InsertNewHire } from '@shared/schema';
import axios from 'axios';

// Extend the existing GeminiService class with hiring intelligence capabilities
export class EnhancedGeminiService extends GeminiService {
  private readonly HIRING_ANALYSIS_PROMPTS = {
    EXTRACT_HIRES: `
You are a hiring intelligence expert. Analyze the following text and extract information about new hires, appointments, or team additions.

Look for patterns like:
- "Welcome [Name]" or "[Name] joins"
- "Pleased to announce [Name]" 
- "We're excited to welcome [Name]"
- "Appointed [Name] as [Position]"
- "[Name] has joined as [Position]"

Extract ONLY actual people joining the company. Ignore departures, promotions of existing employees, or general company news.

For each hire found, provide:
1. Person's full name
2. Position/title
3. Confidence score (0-100)
4. Quote from text that supports this finding

Format response as JSON array:
[
  {
    "personName": "Full Name",
    "position": "Job Title",
    "confidence": 85,
    "evidence": "quote from text"
  }
]

If no hires are found, return empty array [].

Text to analyze:
`,

    VALIDATE_HIRE: `
You are a hiring validation expert. Determine if this appears to be a legitimate new hire announcement.

Consider these factors:
- Is the name a real person's name (not generic like "New Team Member")?
- Is the position specific and realistic?
- Does the evidence text clearly indicate a new hire?
- Is this recent (not an old announcement)?

Person: {personName}
Position: {position}
Company: {company}
Evidence: {evidence}

Respond with JSON:
{
  "isValid": true/false,
  "confidence": 0-100,
  "reasoning": "explanation of decision"
}
`,

    ENHANCE_HIRE: `
You are a hiring information enhancer. Based on the provided hire information, suggest additional details or corrections.

Current hire info:
- Name: {personName}
- Position: {position}
- Company: {company}

Enhance this information by:
1. Standardizing the position title
2. Suggesting department/function
3. Estimating seniority level
4. Identifying if this is a key/executive hire

Respond with JSON:
{
  "enhancedPosition": "standardized title",
  "department": "department name",
  "seniorityLevel": "entry/mid/senior/executive",
  "isKeyHire": true/false,
  "confidence": 0-100
}
`,

    SEARCH_ANALYSIS: `
You are a hiring intelligence analyst. Analyze these search results to find information about new hires at {companyName}.

Look for:
- Press releases about new appointments
- LinkedIn posts about team additions
- News articles about executive hires
- Company blog posts about new team members

Extract hire information and assess credibility of each source.

Search results:
{searchResults}

Respond with JSON array of hires found:
[
  {
    "personName": "Full Name",
    "position": "Job Title", 
    "confidence": 0-100,
    "source": "source description",
    "evidence": "supporting text"
  }
]
`
  };

  async searchAndAnalyze(query: string, companyName: string): Promise<InsertNewHire[]> {
    try {
      console.log(`🤖 AI-powered search analysis for: ${query}`);
      
      // For demonstration, we'll simulate search results
      // In production, integrate with Google Custom Search API or similar
      const searchResults = await this.simulateSearchResults(query, companyName);
      
      if (!searchResults.length) {
        console.log('🔍 No search results to analyze');
        return [];
      }
      
      const prompt = this.HIRING_ANALYSIS_PROMPTS.SEARCH_ANALYSIS
        .replace('{companyName}', companyName)
        .replace('{searchResults}', JSON.stringify(searchResults, null, 2));
      
      const analysis = await this.queryGemini(prompt);
      const hires = this.parseHiringResponse(analysis, companyName, 'search_analysis');
      
      console.log(`🤖 AI search analysis found ${hires.length} potential hires`);
      return hires;
      
    } catch (error) {
      console.error('❌ AI search analysis failed:', error);
      return [];
    }
  }

  async searchSocialMentions(query: string, companyName: string): Promise<InsertNewHire[]> {
    try {
      console.log(`📱 AI-powered social media analysis for: ${query}`);
      
      // Simulate social media search results
      const socialResults = await this.simulateSocialResults(query, companyName);
      
      if (!socialResults.length) {
        return [];
      }
      
      const analysisPrompt = `
Analyze these social media mentions to find hiring announcements for ${companyName}:

${socialResults.map(result => `
Platform: ${result.platform}
Content: ${result.content}
Date: ${result.date}
---
`).join('\n')}

Extract hire information following the same JSON format as before.
`;
      
      const analysis = await this.queryGemini(analysisPrompt);
      const hires = this.parseHiringResponse(analysis, companyName, 'social_media');
      
      console.log(`📱 Social media analysis found ${hires.length} potential hires`);
      return hires;
      
    } catch (error) {
      console.error('❌ Social media analysis failed:', error);
      return [];
    }
  }

  async extractHiresFromText(content: string, companyName: string): Promise<InsertNewHire[]> {
    try {
      console.log(`🤖 AI text analysis for ${companyName} hiring information`);
      
      if (!content || content.length < 50) {
        return [];
      }
      
      const prompt = this.HIRING_ANALYSIS_PROMPTS.EXTRACT_HIRES + content;
      const analysis = await this.queryGemini(prompt);
      const hires = this.parseHiringResponse(analysis, companyName, 'text_analysis');
      
      console.log(`🤖 Text analysis found ${hires.length} potential hires`);
      return hires;
      
    } catch (error) {
      console.error('❌ Text analysis failed:', error);
      return [];
    }
  }

  async validateHire(hire: InsertNewHire, companyName: string): Promise<boolean> {
    try {
      const prompt = this.HIRING_ANALYSIS_PROMPTS.VALIDATE_HIRE
        .replace('{personName}', hire.personName)
        .replace('{position}', hire.position)
        .replace('{company}', companyName)
        .replace('{evidence}', hire.source || 'N/A');
      
      const validation = await this.queryGemini(prompt);
      const result = this.parseJsonResponse(validation);
      
      if (result && typeof result.isValid === 'boolean') {
        console.log(`🤖 Validation for ${hire.personName}: ${result.isValid} (confidence: ${result.confidence}%)`);
        return result.isValid;
      }
      
      return true; // Default to valid if parsing fails
      
    } catch (error) {
      console.warn('⚠️ Hire validation failed, defaulting to valid:', error);
      return true;
    }
  }

  async enhanceHireInfo(hire: InsertNewHire): Promise<InsertNewHire | null> {
    try {
      const prompt = this.HIRING_ANALYSIS_PROMPTS.ENHANCE_HIRE
        .replace('{personName}', hire.personName)
        .replace('{position}', hire.position)
        .replace('{company}', hire.company);
      
      const enhancement = await this.queryGemini(prompt);
      const result = this.parseJsonResponse(enhancement);
      
      if (result && result.enhancedPosition) {
        return {
          ...hire,
          position: result.enhancedPosition,
          // Add department info if available
          ...(result.department && { department: result.department }),
          // Boost confidence if it's a key hire
          confidenceScore: result.isKeyHire ? 
            Math.min(100, parseInt(hire.confidenceScore) + 10).toString() : 
            hire.confidenceScore
        };
      }
      
      return hire; // Return original if enhancement fails
      
    } catch (error) {
      console.warn('⚠️ Hire enhancement failed:', error);
      return hire;
    }
  }

  private parseHiringResponse(response: string, companyName: string, source: string): InsertNewHire[] {
    try {
      const cleanResponse = this.cleanJsonResponse(response);
      const hires = JSON.parse(cleanResponse);
      
      if (!Array.isArray(hires)) {
        return [];
      }
      
      return hires
        .filter(hire => hire.personName && hire.position)
        .map(hire => ({
          personName: hire.personName.trim(),
          company: companyName,
          position: hire.position.trim(),
          startDate: new Date(),
          linkedinProfile: null,
          source: source,
          confidenceScore: (hire.confidence || 70).toString()
        }));
        
    } catch (error) {
      console.warn('⚠️ Failed to parse hiring response:', error);
      return [];
    }
  }

  private parseJsonResponse(response: string): any {
    try {
      const cleanResponse = this.cleanJsonResponse(response);
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.warn('⚠️ Failed to parse JSON response:', error);
      return null;
    }
  }

  private cleanJsonResponse(response: string): string {
    // Remove markdown formatting and extra text
    return response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^{\[]*/, '')
      .replace(/[^}\]]*$/, '')
      .trim();
  }

  private async simulateSearchResults(query: string, companyName: string): Promise<any[]> {
    // In production, replace with actual Google Custom Search API
    console.log(`🔍 Simulating search results for: ${query}`);
    
    // Return mock search results for demonstration
    return [
      {
        title: `${companyName} Welcomes New Team Members`,
        snippet: `We're excited to welcome John Smith as Senior Software Engineer and Jane Doe as Marketing Manager to our growing team.`,
        url: `https://example.com/news/new-hires`,
        source: 'Company Website'
      },
      {
        title: `${companyName} Announces Key Executive Appointments`,
        snippet: `The company today announced the appointment of Michael Johnson as Chief Technology Officer, effective immediately.`,
        url: `https://example.com/press/executive-appointments`,
        source: 'Press Release'
      }
    ];
  }

  private async simulateSocialResults(query: string, companyName: string): Promise<any[]> {
    // In production, integrate with social media APIs
    console.log(`📱 Simulating social media results for: ${query}`);
    
    return [
      {
        platform: 'LinkedIn',
        content: `Thrilled to welcome Sarah Wilson to our team as Head of Product Development! Her experience in gaming will be invaluable. #NewTeamMember #Welcome`,
        date: new Date().toISOString(),
        author: `${companyName} Official`
      },
      {
        platform: 'Twitter',
        content: `Big welcome to our new Data Scientist, Dr. Robert Chen! Looking forward to the insights he'll bring to our analytics team. 🎉`,
        date: new Date().toISOString(),
        author: `@${companyName.toLowerCase().replace(/\s+/g, '')}`
      }
    ];
  }

  // Method to query Gemini AI (implement based on your existing GeminiService)
  private async queryGemini(prompt: string): Promise<string> {
    try {
      // This should use your existing Gemini API implementation
      // For now, we'll return a simulated response
      
      console.log('🤖 Querying Gemini AI for hiring analysis...');
      
      // Simulate AI response based on prompt content
      if (prompt.includes('EXTRACT_HIRES')) {
        return `[
          {
            "personName": "Alex Thompson",
            "position": "Senior Game Developer",
            "confidence": 88,
            "evidence": "We're thrilled to welcome Alex Thompson as our new Senior Game Developer"
          }
        ]`;
      } else if (prompt.includes('VALIDATE_HIRE')) {
        return `{
          "isValid": true,
          "confidence": 85,
          "reasoning": "Clear hiring announcement with specific name and position"
        }`;
      } else if (prompt.includes('ENHANCE_HIRE')) {
        return `{
          "enhancedPosition": "Senior Software Developer - Gaming",
          "department": "Engineering",
          "seniorityLevel": "senior",
          "isKeyHire": false,
          "confidence": 90
        }`;
      }
      
      // Default fallback
      return '[]';
      
    } catch (error) {
      console.error('❌ Gemini query failed:', error);
      throw error;
    }
  }

  // Method to classify jobs (enhance existing functionality)
  async classifyJob(jobTitle: string, jobUrl: string): Promise<{department: string | null, confidence: number}> {
    try {
      const classificationPrompt = `
Classify this job posting:

Job Title: ${jobTitle}
URL: ${jobUrl}

Determine:
1. Department (Engineering, Marketing, Sales, HR, Finance, Operations, etc.)
2. Confidence score (0-100)

Respond with JSON:
{
  "department": "department name",
  "confidence": 0.95
}
`;
      
      const classification = await this.queryGemini(classificationPrompt);
      const result = this.parseJsonResponse(classification);
      
      return {
        department: result?.department || null,
        confidence: result?.confidence || 0.8
      };
      
    } catch (error) {
      console.warn('⚠️ Job classification failed:', error);
      return { department: null, confidence: 0.5 };
    }
  }
}
