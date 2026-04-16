const db = require('../config/database');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP (in production, integrate with Twilio or SMS service)
const sendOTP = async (mobile) => {
  try {
    // For development, log OTP to console
    const otp = generateOTP();
    console.log(`🔢 OTP for ${mobile}: ${otp}`);

    // Store OTP in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await db.query(
      'INSERT INTO otps (mobile, otp_code, expires_at) VALUES (?, ?, ?)',
      [mobile, otp, expiresAt]
    );

    // In production, integrate with Twilio here
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: `Your OTP is: ${otp}`,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: `+91${mobile}`
    // });

    return { success: true, message: 'OTP sent successfully', otp };
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP');
  }
};

// Verify OTP
const verifyOTP = async (mobile, otpCode) => {
  try {
    const result = await db.query(
      `SELECT id FROM otps 
       WHERE mobile = ? AND otp_code = ? AND is_used = 0 AND expires_at > NOW()`,
      [mobile, otpCode]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    // Mark OTP as used
    await db.query(
      'UPDATE otps SET is_used = 1 WHERE id = ?',
      [result.rows[0].id]
    );

    return { success: true, message: 'OTP verified successfully' };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw new Error('Failed to verify OTP');
  }
};

// Clean up expired OTPs
const cleanupExpiredOTPs = async () => {
  try {
    await db.query(
      'DELETE FROM otps WHERE expires_at < NOW()'
    );
    console.log('?? Cleaned up expired OTPs');
  } catch (error) {
    console.error('Error cleaning up OTPs:', error);
  }
};

module.exports = {
  generateOTP,
  sendOTP,
  verifyOTP,
  cleanupExpiredOTPs
};
