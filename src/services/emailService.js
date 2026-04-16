const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send a notice notification email to a list of recipients.
 * @param {string[]} recipientEmails
 * @param {{ title: string, content: string, notice_type: string, priority: string, created_by_name: string }} notice
 */
const sendNoticeEmail = async (recipientEmails, notice) => {
  if (!recipientEmails || recipientEmails.length === 0) return;

  // Skip if email credentials are not configured
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com') {
    console.log(`📧 [EMAIL MOCK] Would send notice "${notice.title}" to ${recipientEmails.length} members:`, recipientEmails);
    return;
  }

  const transporter = createTransporter();

  const priorityBadge = {
    urgent: '🚨 URGENT',
    high: '⚠️ HIGH PRIORITY',
    normal: '📢',
    low: '📌',
  }[notice.priority] || '📢';

  const typeLabel = {
    general: 'General Notice',
    emergency: 'Emergency Alert',
    maintenance: 'Maintenance Notice',
    meeting: 'Meeting Notice',
    event: 'Event Announcement',
  }[notice.notice_type] || 'Notice';

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 32px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
          🏢 Society Notice Board
        </h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">${typeLabel}</p>
      </div>

      <!-- Priority Banner -->
      <div style="background: ${notice.priority === 'urgent' ? '#fee2e2' : notice.priority === 'high' ? '#fef3c7' : '#e0f2fe'}; 
                  padding: 12px 40px; text-align: center; font-size: 13px; font-weight: 700;
                  color: ${notice.priority === 'urgent' ? '#dc2626' : notice.priority === 'high' ? '#d97706' : '#0284c7'};">
        ${priorityBadge} &nbsp;${notice.priority?.toUpperCase()} PRIORITY
      </div>

      <!-- Body -->
      <div style="padding: 40px; background: #ffffff;">
        <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 16px;">${notice.title}</h2>
        <p style="color: #475569; line-height: 1.7; font-size: 15px; margin: 0 0 24px; white-space: pre-wrap;">${notice.content}</p>

        <div style="background: #f1f5f9; border-radius: 12px; padding: 16px 20px; display: flex; gap: 24px; flex-wrap: wrap;">
          <div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Posted By</p>
            <p style="margin: 4px 0 0; color: #1e293b; font-weight: 600; font-size: 14px;">${notice.created_by_name || 'Society Admin'}</p>
          </div>
          <div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Date</p>
            <p style="margin: 4px 0 0; color: #1e293b; font-weight: 600; font-size: 14px;">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          This is an automated message from your Housing Society Management System.<br/>
          Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"Society Admin" <${process.env.EMAIL_USER}>`,
    bcc: recipientEmails, // Use BCC to protect member privacy
    subject: `${priorityBadge} [Society Notice] ${notice.title}`,
    html: htmlBody,
    text: `${notice.title}\n\n${notice.content}\n\nPosted by: ${notice.created_by_name || 'Admin'}`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Notice email sent to ${recipientEmails.length} members. MessageId: ${info.messageId}`);
  } catch (err) {
    console.error('❌ Failed to send notice email:', err.message);
    // Non-blocking — do not throw; notice was already saved
  }
};

module.exports = { sendNoticeEmail };
