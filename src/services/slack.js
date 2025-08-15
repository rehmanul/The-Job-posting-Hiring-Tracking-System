const { IncomingWebhook } = require('@slack/client');
const config = require('../../config/config.json');

const webhook = new IncomingWebhook(config.slackWebhookUrl);

async function sendSlackMessage(message) {
  try {
    await webhook.send(message);
  } catch (error) {
    console.error('Error sending Slack message:', error);
  }
}

module.exports = { sendSlackMessage };
