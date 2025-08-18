import { storage } from '../storage';
import { logger } from '../logger';

export class MinimalHireWebhook {
  async processLinkedInWebhook(payload: any): Promise<void> {
    try {
      const hireData = this.extractHireFromWebhook(payload);
      if (!hireData) return;

      // FILTER: Only process hires from YOUR 18 tracked companies
      const trackedCompanies = await storage.getCompanies();
      const isTrackedCompany = trackedCompanies.some(company => 
        company.name.toLowerCase().includes(hireData.company.toLowerCase()) ||
        hireData.company.toLowerCase().includes(company.name.toLowerCase())
      );

      if (!isTrackedCompany) {
        logger.info(`Hire from untracked company ignored: ${hireData.company}`);
        return;
      }

      const existingHires = await storage.getNewHires();
      const exists = existingHires.some(h => 
        h.personName.toLowerCase() === hireData.personName.toLowerCase() &&
        h.company.toLowerCase() === hireData.company.toLowerCase()
      );

      if (!exists) {
        await storage.createNewHire(hireData);
        logger.info(`✅ New hire from tracked company: ${hireData.personName} at ${hireData.company}`);
      }
    } catch (error) {
      logger.error('Webhook processing failed:', error);
    }
  }

  private extractHireFromWebhook(payload: any): any | null {
    try {
      const text = payload.activity?.text || payload.text || '';
      
      const hirePatterns = [
        /welcome\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:has\s+)?joined/i,
        /pleased\s+to\s+announce\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
      ];

      let personName = null;
      for (const pattern of hirePatterns) {
        const match = text.match(pattern);
        if (match) {
          personName = match[1].trim();
          break;
        }
      }

      if (!personName) return null;

      const positionMatch = text.match(/as\s+(?:our\s+new\s+)?([^,.\n]+?)(?:\s+at|\s+for|$)/i);
      const position = positionMatch ? positionMatch[1].trim() : 'Position not specified';

      const previousCompanyMatch = text.match(/previously\s+at\s+([^,.\n]+)/i);
      const previousCompany = previousCompanyMatch ? previousCompanyMatch[1].trim() : null;

      let confidence = 0.75;
      if (previousCompany) confidence += 0.15;
      if (payload.activity?.profileUrl) confidence += 0.10;

      return {
        personName,
        company: payload.activity?.company || 'Unknown Company',
        position,
        linkedinUrl: payload.activity?.profileUrl || null,
        source: 'LinkedIn Webhook',
        foundDate: new Date(),
        extractedAt: new Date().toISOString().split('T')[0],
        previousCompany
      };
    } catch (error) {
      logger.error('Hire extraction failed:', error);
      return null;
    }
  }
}