require('dotenv').config();
const puppeteer = require('puppeteer');

async function login(page) {
  await page.goto('https://www.linkedin.com/login');
  await page.type('#username', process.env.LINKEDIN_EMAIL);
  await page.type('#password', process.env.LINKEDIN_PASSWORD);
  await page.click('.btn__primary--large');
  await page.waitForNavigation();
}

async function scrapeJobPostings(url) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await login(page);
    await page.goto(url, { waitUntil: 'networkidle2' });

    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('.jobs-search-results__list-item');
      const jobData = [];
      jobElements.forEach(job => {
        const titleElement = job.querySelector('.job-card-list__title');
        const locationElement = job.querySelector('.job-card-container__metadata-item');
        const urlElement = job.querySelector('.job-card-container__link');

        if (titleElement && locationElement && urlElement) {
          const title = titleElement.innerText;
          const location = locationElement.innerText;
          const url = urlElement.href;
          jobData.push({ title, location, url });
        }
      });
      return jobData;
    });

    return jobs;
  } catch (error) {
    console.error('Error scraping job postings:', error);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeNewHires(company) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await login(page);
    await page.goto(`https://www.linkedin.com/company/${company}/people/`, { waitUntil: 'networkidle2' });

    const newHires = await page.evaluate(() => {
      const hireElements = document.querySelectorAll('.org-people-profile-card');
      const hireData = [];
      hireElements.forEach(hire => {
        const nameElement = hire.querySelector('.org-people-profile-card__profile-title');
        const positionElement = hire.querySelector('.org-people-profile-card__headline');
        const profileUrlElement = hire.querySelector('a.org-people-profile-card__profile-link');

        if (nameElement && positionElement && profileUrlElement) {
          const name = nameElement.innerText;
          const position = positionElement.innerText;
          const profileUrl = profileUrlElement.href;
          hireData.push({ name, position, profileUrl });
        }
      });
      return hireData;
    });

    return newHires;
  } catch (error) {
    console.error(`Error scraping new hires for ${company}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapeJobPostings,
  scrapeNewHires,
};
