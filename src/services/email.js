const nodemailer = require('nodemailer');
const config = require('../../config/config.json');

const transporter = nodemailer.createTransport(config.smtp);

async function sendEmail(to, subject, text) {
  try {
    await transporter.sendMail({
      from: config.smtp.auth.user,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = { sendEmail };
