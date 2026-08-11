const nodemailer = require('nodemailer');

let transporter;
let triedInit = false;

/**
 * Lazily builds a nodemailer transporter from env vars. Returns null (and
 * only logs once) if SMTP is not configured, so callers can gracefully skip
 * sending instead of crashing the process.
 */
function getTransporter() {
  if (triedInit) return transporter || null;
  triedInit = true;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } catch (err) {
    console.warn('[Email] Failed to create SMTP transporter:', err.message);
    transporter = null;
  }
  return transporter;
}

/**
 * Sends an email if SMTP is configured. Never throws - callers get back a
 * result object describing what happened so it can be recorded in a SendLog.
 */
async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email not configured, skipping] to=${to} subject="${subject}"`);
    return { status: 'SKIPPED' };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    return { status: 'SENT' };
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return { status: 'FAILED', error: err.message };
  }
}

module.exports = { sendEmail };
