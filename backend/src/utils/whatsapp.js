// WhatsApp delivery via Twilio's WhatsApp Business API pattern.
// Guarded so the app runs fine with no Twilio credentials configured, and
// even if the `twilio` package itself failed to load for some reason.
// See https://www.twilio.com/docs/whatsapp for setup details.

let client;
let triedInit = false;

function getClient() {
  if (triedInit) return client || null;
  triedInit = true;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    client = null;
    return null;
  }

  try {
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('[WhatsApp] twilio SDK unavailable, disabling WhatsApp sending:', err.message);
    client = null;
  }
  return client;
}

/**
 * Sends a WhatsApp message if Twilio is configured. Never throws.
 */
async function sendWhatsapp({ to, body }) {
  const c = getClient();
  if (!c) {
    console.log(`[WhatsApp not configured, skipping] to=${to}`);
    return { status: 'SKIPPED' };
  }

  try {
    await c.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${to}`,
      body,
    });
    return { status: 'SENT' };
  } catch (err) {
    console.error('[WhatsApp] Send failed:', err.message);
    return { status: 'FAILED', error: err.message };
  }
}

module.exports = { sendWhatsapp };
