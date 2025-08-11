const { WebClient } = require('@slack/web-api');

class SlackService {
  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  async sendMessage(channel, message) {
    try {
      await this.client.chat.postMessage({
        channel: channel || process.env.SLACK_CHANNEL_ID,
        text: message,
      });
    } catch (error) {
      console.error('Error sending Slack message:', error);
    }
  }
}

module.exports = { SlackService };
