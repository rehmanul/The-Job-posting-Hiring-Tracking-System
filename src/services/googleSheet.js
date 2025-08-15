const { google } = require('googleapis');
const credentials = require('../../credentials.json');
const config = require('../../config/config.json');

const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

async function getCompanyData() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetId,
      range: 'Company Data!A2:D',
    });
    return response.data.values;
  } catch (error) {
    console.error('Error reading from Google Sheets:', error);
    return [];
  }
}

async function updateJobPostings(data) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetId,
      range: 'Job Postings!A2',
      valueInputOption: 'RAW',
      resource: {
        values: data,
      },
    });
  } catch (error) {
    console.error('Error writing to Google Sheets:', error);
  }
}

async function updateNewHires(data) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetId,
      range: 'New Hires!A2',
      valueInputOption: 'RAW',
      resource: {
        values: data,
      },
    });
  } catch (error) {
    console.error('Error writing to Google Sheets:', error);
  }
}

module.exports = {
  getCompanyData,
  updateJobPostings,
  updateNewHires,
};
