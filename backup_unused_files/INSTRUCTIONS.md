
# Configuration and Credentials

To use this application, you need to provide your credentials and configuration in the `.env` file in the root directory of the project.

Create a `.env` file in the root of the project and add the following variables:

## LinkedIn Credentials

You need to provide your LinkedIn email and password in the `.env` file.

```
LINKEDIN_EMAIL=YOUR_LINKEDIN_EMAIL
LINKEDIN_PASSWORD=YOUR_LINKEDIN_PASSWORD
```

**Important:** It is recommended to use a separate LinkedIn account for scraping to avoid any issues with your personal account.

## Google Sheets

If you want to save the scraped data to a Google Sheet, you need to provide the Google Sheet ID and your service account credentials in the `.env` file.

```
GOOGLE_SHEETS_ID=YOUR_GOOGLE_SHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL=YOUR_GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY=YOUR_GOOGLE_PRIVATE_KEY
```

## Slack

If you want to receive notifications on Slack, you need to provide your Slack Bot Token, Channel ID and App Token in the `.env` file.

```
SLACK_BOT_TOKEN=YOUR_SLACK_BOT_TOKEN
SLACK_CHANNEL_ID=YOUR_SLACK_CHANNEL_ID
SLACK_APP_TOKEN=YOUR_SLACK_APP_TOKEN
```

## Gmail SMTP

If you want to receive email notifications, you need to configure the Gmail SMTP settings in the `.env` file.

```
GMAIL_USER=YOUR_GMAIL_ADDRESS
GMAIL_APP_PASSWORD=YOUR_GMAIL_APP_PASSWORD
EMAIL_RECIPIENTS=RECIPIENT_EMAIL_1,RECIPIENT_EMAIL_2
```

## Monitoring Configuration

You can configure the monitoring settings in the `.env` file.

```
TRACKING_INTERVAL_MINUTES=30
JOB_POSTING_CHECK_INTERVAL=15
NEW_HIRE_CHECK_INTERVAL=60
MAX_RETRIES=3
REQUEST_TIMEOUT=30000
MAX_CONCURRENT_REQUESTS=5
```

## Anti-Detection Configuration

You can configure the anti-detection settings in the `.env` file.

```
USE_STEALTH_MODE=true
USE_PROXY_ROTATION=false
PROXY_LIST=proxy1:port,proxy2:port
MIN_DELAY_MS=2000
MAX_DELAY_MS=8000
```

## System Configuration

You can configure the system settings in the `.env` file.

```
LOG_LEVEL=info
ENABLE_ANALYTICS=true
ENABLE_HEALTH_METRICS=true
SERVER_PORT=3000
```

## Docker Configuration

You can configure the Docker settings in the `.env` file.

```
DOCKER_ENV=false
HEADLESS_MODE=true
```

# Running the Application

To run the application, you need to have Node.js installed on your system.

1.  Install the dependencies:

```bash
npm install
```

2.  Start the application:

```bash
npm start
```

The application will then start scraping LinkedIn based on the configured interval.
