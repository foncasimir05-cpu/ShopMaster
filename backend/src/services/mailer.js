const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) return null;
  const port = parseInt(EMAIL_PORT) || 587;
  _transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  return _transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn('[Mailer] SMTP not configured — email not sent to:', to);
    return false;
  }
  await t.sendMail({
    from: process.env.EMAIL_FROM || `ShopMaster <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
  return true;
}

module.exports = { sendMail };
