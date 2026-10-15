const nodemailer = require('nodemailer');
const cfg = require('../config');
const transport = cfg.smtp ? nodemailer.createTransport({
  host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.port === 465, auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
}) : null;

async function sendCode(to, code) {
  if (!transport) { console.log(`[DEV] SMTP not set. Code for ${to}: ${code}`); return; }
  await transport.sendMail({ from: cfg.smtp.from, to, subject: `NILORA code: ${code}`,
    text: `Your NILORA verification code is ${code}. It expires in 10 minutes. If you did not ask for it, ignore this email.` });
}
module.exports = { sendCode };
