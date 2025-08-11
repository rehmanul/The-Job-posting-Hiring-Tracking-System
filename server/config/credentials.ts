// Production credentials configuration for external services
export const CREDENTIALS_CONFIG = {
  linkedin: {
    email: process.env.LINKEDIN_EMAIL || "dglink3tr@gmail.com",
    password: process.env.LINKEDIN_PASSWORD || "",
    api: {
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI || "http://localhost:5000/auth/linkedin/callback"
    }
  },
  slack: {
    webhook_url: process.env.SLACK_WEBHOOK_URL || "",
    channel: process.env.SLACK_CHANNEL || "#job-alerts",
    bot_token: process.env.SLACK_BOT_TOKEN || ""
  },
  email: {
    smtp_server: process.env.EMAIL_SMTP_SERVER || "smtp.gmail.com",
    smtp_port: parseInt(process.env.EMAIL_SMTP_PORT || "587"),
    username: process.env.GMAIL_USER || "rehman.shoj@gmail.com",
    password: process.env.GMAIL_PASSWORD || "",
    recipients: [
      "rehman.shoj@gmail.com",
      "matt@boostkit.io"
    ]
  },
  google_sheets: {
    credentials_file: "service_account.json",
    spreadsheet_id: process.env.GOOGLE_SHEETS_ID || "",
    companies_sheet: "Company Data",
    jobs_sheet: "Job Postings",
    hires_sheet: "New Hires"
  },
  scan_intervals: {
    jobs_hours: 4,
    hires_hours: 8
  },
  advanced_features: {
    parallel_processing: true,
    ai_enhanced_detection: true,
    auto_backup: true,
    rate_limiting: true,
    duplicate_detection: true,
    trend_analysis: true
  },
  refresh_interval: 300
};

// Validation helpers
export function validateLinkedInCredentials(): boolean {
  return !!(CREDENTIALS_CONFIG.linkedin.email && CREDENTIALS_CONFIG.linkedin.password);
}

export function validateSlackCredentials(): boolean {
  return !!(CREDENTIALS_CONFIG.slack.webhook_url || CREDENTIALS_CONFIG.slack.bot_token);
}

export function validateEmailCredentials(): boolean {
  return !!(CREDENTIALS_CONFIG.email.username && CREDENTIALS_CONFIG.email.password);
}

export function validateGoogleSheetsCredentials(): boolean {
  return !!(process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

export function validateGeminiCredentials(): boolean {
  return !!process.env.GEMINI_API_KEY;
}