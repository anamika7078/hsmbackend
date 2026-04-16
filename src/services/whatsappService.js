const twilio = require('twilio');

/**
 * Send a WhatsApp message via Twilio.
 * Requires Twilio credentials and a WhatsApp-enabled sender number in .env
 *
 * TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
 * TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxx
 * TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   ← Twilio Sandbox or approved number
 */
const sendWhatsAppMessage = async (toMobile, message) => {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default

  // Skip silently if credentials are not configured
  if (!sid || sid === 'your-twilio-account-sid') {
    console.log(`📱 [WHATSAPP MOCK] To: ${toMobile} | Message: ${message.slice(0, 80)}...`);
    return;
  }

  const client = twilio(sid, token);

  // Normalise number to E.164: add country code +91 if not present
  let toNumber = toMobile.replace(/\D/g, ''); // strip non-digits
  if (!toNumber.startsWith('91') && toNumber.length === 10) {
    toNumber = `91${toNumber}`;
  }
  const to = `whatsapp:+${toNumber}`;

  try {
    const result = await client.messages.create({ from, to, body: message });
    console.log(`✅ WhatsApp sent to ${to} | SID: ${result.sid}`);
    return result;
  } catch (err) {
    // Non-blocking: log but don't crash the notice creation flow
    console.error(`❌ WhatsApp failed for ${to}:`, err.message);
  }
};

/**
 * Build a WhatsApp notice message string.
 */
const buildNoticeMessage = (notice) => {
  const priorityEmoji = {
    urgent: '🚨',
    high:   '⚠️',
    normal: '📢',
    low:    '📌',
  }[notice.priority] || '📢';

  const typeLabel = {
    general:     'General Notice',
    emergency:   'Emergency Alert',
    maintenance: 'Maintenance Notice',
    meeting:     'Meeting Notice',
    event:       'Event Announcement',
  }[notice.notice_type] || 'Notice';

  return (
    `${priorityEmoji} *Society Notice – ${typeLabel}*\n\n` +
    `*${notice.title}*\n\n` +
    `${notice.content}\n\n` +
    `📅 Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}\n` +
    `👤 Posted by: ${notice.created_by_name || 'Society Admin'}\n\n` +
    `_This is an automated message from your Housing Society Management System._`
  );
};

/**
 * Send notice WhatsApp notifications to a list of members.
 * @param {{ name: string, mobile: string }[]} members
 * @param {object} notice
 */
const sendNoticeWhatsApp = async (members, notice) => {
  if (!members || members.length === 0) return;

  const message = buildNoticeMessage(notice);
  const mobiles = members.map((m) => m.mobile).filter(Boolean);

  console.log(`📱 Sending WhatsApp notice to ${mobiles.length} member(s)...`);

  // Send concurrently but cap at 5 at a time to avoid rate limits
  const BATCH = 5;
  for (let i = 0; i < mobiles.length; i += BATCH) {
    const batch = mobiles.slice(i, i + BATCH);
    await Promise.allSettled(batch.map((mobile) => sendWhatsAppMessage(mobile, message)));
  }
};

module.exports = { sendWhatsAppMessage, sendNoticeWhatsApp, buildNoticeMessage };
