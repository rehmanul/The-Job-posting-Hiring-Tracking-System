const cron = require('node-cron');
const config = require('../config/config.json');
const googleSheet = require('./services/googleSheet');
const slack = require('./services/slack');
const email = require('./services/email');
const linkedInScraper = require('./scrapers/linkedInScraper');

async function trackJobPostings() {
  const companies = await googleSheet.getCompanyData();
  for (const company of companies) {
    const [name, website, linkedInUrl, careerPageUrl] = company;
    const jobs = await linkedInScraper.scrapeJobPostings(careerPageUrl);
    if (jobs.length > 0) {
      await googleSheet.updateJobPostings(jobs);
      await slack.sendSlackMessage(`Found ${jobs.length} new jobs at ${name}`);
      await email.sendEmail('your-email@example.com', `New Jobs at ${name}`, `Found ${jobs.length} new jobs.`);
    }
  }
}

async function trackNewHires() {
  const companies = await googleSheet.getCompanyData();
  for (const company of companies) {
    const [name] = company;
    const newHires = await linkedInScraper.scrapeNewHires(name);
    if (newHires.length > 0) {
      await googleSheet.updateNewHires(newHires);
      await slack.sendSlackMessage(`Found ${newHires.length} new hires at ${name}`);
    }
  }
}

cron.schedule(config.scrapingInterval, () => {
  trackJobPostings();
  trackNewHires();
});

console.log('Job tracker started.');
