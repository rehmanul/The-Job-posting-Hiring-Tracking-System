import axios from 'axios';
import dotenv from 'dotenv';
import type { Company, InsertNewHire } from '@shared/schema';

dotenv.config();

const PDL_API_KEY = process.env.PDL_API_KEY;
const PDL_API_URL = 'https://api.peopledatalabs.com/v5/person/search';

function cleanCompanyName(company: string): string {
  if (!company || typeof company !== 'string') return "";
  return company.trim()
    .replace(/\b(Inc|Corp|LLC|Ltd|Co)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCompanyMatch(company1: string, company2: string): boolean {
  if (!company1 || !company2) return false;

  const clean1 = cleanCompanyName(company1.toLowerCase());
  const clean2 = cleanCompanyName(company2.toLowerCase());

  if (clean1 === clean2) return true;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

  const words1 = clean1.split(' ').filter(w => w.length > 2);
  const words2 = clean2.split(' ').filter(w => w.length > 2);

  if (words1.length > 0 && words2.length > 0) {
    const matches = words1.filter(w1 => words2.some(w2 => w2.includes(w1) || w1.includes(w2)));
    return matches.length >= Math.min(words1.length, words2.length) * 0.7;
  }

  return false;
}

function parsePdlPerson(person: any, company: Company): InsertNewHire | null {
  if (!person || !person.experience || person.experience.length === 0) {
    return null;
  }

  const currentJob = person.experience[0];
  const previousJob = person.experience.length > 1 ? person.experience[1] : null;

  if (!currentJob.company || !currentJob.company.name || !isCompanyMatch(currentJob.company.name, company.name)) {
    return null;
  }

  const startDate = currentJob.start_date ? new Date(currentJob.start_date) : null;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  if (!startDate || startDate < sixMonthsAgo) {
    return null;
  }

  let confidenceScore = 70;
  if (person.full_name && person.full_name.includes(' ')) confidenceScore += 10;
  if (person.linkedin_url) confidenceScore += 15;
  if (currentJob.title && currentJob.title.name) confidenceScore += 10;
  if (previousJob && previousJob.company && previousJob.company.name) confidenceScore += 5;

  return {
    personName: person.full_name || "",
    company: currentJob.company.name || company.name,
    position: currentJob.title?.name || "",
    startDate: startDate,
    previousCompany: previousJob?.company?.name || "",
    linkedinProfile: person.linkedin_url || "",
    source: "PDL Person Search",
    confidenceScore: Math.min(confidenceScore, 100).toString(),
    foundDate: new Date(),
    verified: false
  };
}

export async function findRecentHires(company: Company): Promise<InsertNewHire[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDateString = sixMonthsAgo.toISOString().split('T')[0];

  const query = {
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                { term: { "job_company_name": company.name.toLowerCase() } },
                { match: { "job_company_name": company.name } }
              ]
            }
          },
          {
            range: {
              "job_start_date": {
                gte: startDateString
              }
            }
          }
        ],
        should: [
          { term: { "job_title_role": "software engineer" } },
          { term: { "job_title_role": "product manager" } },
          { term: { "job_title_role": "data scientist" } },
          { term: { "job_title_role": "marketing manager" } }
        ]
      }
    },
    size: 50,
    required: "experience,linkedin_url,full_name"
  };

  try {
    const response = await axios.post(
      PDL_API_URL,
      {
        query: query,
        size: 10
      },
      {
        headers: {
          'X-Api-Key': PDL_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const hires: InsertNewHire[] = [];
    if (response.data && response.data.data) {
      for (const person of response.data.data) {
        const hire = parsePdlPerson(person, company);
        if (hire) {
          hires.push(hire);
        }
      }
    }
    return hires;
  } catch (error) {
    console.error('Error fetching data from PDL API:', error);
    return [];
  }
}