const crypto = require('crypto');

// Simple in-memory OTP storage (in production, use Redis or database)
const otpStore = new Map();
const OTP_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes

class OTPService {
  // Generate 6-digit OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store OTP with expiry
  storeOTP(phone, otp, purpose = 'login') {
    const key = `${phone}_${purpose}`;
    const expiryTime = Date.now() + OTP_EXPIRY_TIME;
    
    otpStore.set(key, {
      otp,
      expiryTime,
      attempts: 0,
      maxAttempts: 5
    });

    console.log(`🔐 OTP stored for ${phone} (${purpose}): ${otp} [Expires: ${new Date(expiryTime).toLocaleTimeString()}]`);
    
    // Auto cleanup after expiry
    setTimeout(() => {
      otpStore.delete(key);
      console.log(`🗑️ OTP expired and cleaned up for ${phone} (${purpose})`);
    }, OTP_EXPIRY_TIME);
  }

  // Verify OTP
  verifyOTP(phone, providedOTP, purpose = 'login') {
    const key = `${phone}_${purpose}`;
    const otpData = otpStore.get(key);

    if (!otpData) {
      console.log(`❌ No OTP found for ${phone} (${purpose})`);
      return { success: false, error: 'OTP not found or expired' };
    }

    if (Date.now() > otpData.expiryTime) {
      otpStore.delete(key);
      console.log(`⏰ OTP expired for ${phone} (${purpose})`);
      return { success: false, error: 'OTP has expired' };
    }

    if (otpData.attempts >= otpData.maxAttempts) {
      otpStore.delete(key);
      console.log(`🚫 Max attempts exceeded for ${phone} (${purpose})`);
      return { success: false, error: 'Maximum verification attempts exceeded' };
    }

    if (otpData.otp !== providedOTP) {
      otpData.attempts++;
      otpStore.set(key, otpData);
      console.log(`❌ Invalid OTP for ${phone} (${purpose}). Attempts: ${otpData.attempts}/${otpData.maxAttempts}`);
      return { 
        success: false, 
        error: 'Invalid OTP',
        attemptsRemaining: otpData.maxAttempts - otpData.attempts
      };
    }

    // OTP verified successfully
    otpStore.delete(key);
    console.log(`✅ OTP verified successfully for ${phone} (${purpose})`);
    return { success: true };
  }

  // Send OTP via DVHosting SMS API
  async sendOTP(phone, otp, purpose = 'login') {
    try {
      const apiKey = process.env.DVHOSTING_API_KEY;

      // In development or if no API key, just log the OTP
      if (!apiKey || process.env.NODE_ENV !== 'production') {
        console.log(`📱 [DEV] SMS to ${phone}: Your Laundrify ${purpose} OTP is: ${otp}. Valid for 10 minutes.`);
        return { success: true, message: 'OTP sent successfully (dev mode)' };
      }

      // Clean phone number (remove any non-digits)
      const cleanPhone = phone.replace(/\D/g, '');

      // DVHosting v4 API endpoint
      const url = `https://dvhosting.in/api-sms-v4.php?authorization=${apiKey}&route=otp&variables_values=${otp}&numbers=${cleanPhone}`;

      console.log(`📱 Sending ${purpose} OTP to ${cleanPhone} via DVHosting`);

      const response = await fetch(url);
      const responseText = await response.text();

      if (!responseText || responseText.trim() === "") {
        console.error('❌ Empty response from DVHosting API');
        return { success: false, error: "Empty response from DVHosting" };
      }

      try {
        const jsonResponse = JSON.parse(responseText);
        const isSuccess = jsonResponse.return || jsonResponse.success;

        if (isSuccess) {
          console.log(`✅ ${purpose} OTP sent successfully to ${cleanPhone}`);
          return { success: true, message: 'OTP sent successfully via DVHosting SMS' };
        } else {
          console.error('❌ DVHosting API returned error:', jsonResponse.message);
          return { success: false, error: jsonResponse.message || 'DVHosting API error' };
        }
      } catch (parseError) {
        // If JSON parsing fails, check if response contains "success"
        const isSuccess = /success/i.test(responseText);

        if (isSuccess) {
          console.log(`✅ ${purpose} OTP sent successfully to ${cleanPhone} (text response)`);
          return { success: true, message: 'OTP sent successfully via DVHosting SMS' };
        } else {
          console.error('❌ DVHosting API response not parseable:', responseText.substring(0, 100));
          return { success: false, error: 'Invalid response from DVHosting API' };
        }
      }
    } catch (error) {
      console.error(`❌ Failed to send ${purpose} OTP to ${phone}:`, error);
      return { success: false, error: 'Failed to send OTP via DVHosting SMS' };
    }
  }

  // Send SMS notification (not OTP) via DVHosting SMS API
  async sendSMS(phone, message, purpose = 'notification') {
    try {
      const apiKey = process.env.DVHOSTING_API_KEY;

      // In development or if no API key, just log the message
      if (!apiKey || process.env.NODE_ENV !== 'production') {
        console.log(`📱 [DEV] SMS to ${phone}: ${message}`);
        return { success: true, message: 'SMS sent successfully (dev mode)' };
      }

      // Clean phone number (remove any non-digits)
      const cleanPhone = phone.replace(/\D/g, '');

      // Encode the message for URL
      const encodedMessage = encodeURIComponent(message);

      // DVHosting v4 API endpoint for regular SMS
      const url = `https://dvhosting.in/api-sms-v4.php?authorization=${apiKey}&route=q&numbers=${cleanPhone}&message=${encodedMessage}`;

      console.log(`📱 Sending ${purpose} SMS to ${cleanPhone} via DVHosting: ${message.substring(0, 50)}...`);

      const response = await fetch(url);
      const responseText = await response.text();

      if (!responseText || responseText.trim() === "") {
        console.error('❌ Empty response from DVHosting API');
        return { success: false, error: "Empty response from DVHosting" };
      }

      try {
        const jsonResponse = JSON.parse(responseText);
        const isSuccess = jsonResponse.return || jsonResponse.success;

        if (isSuccess) {
          console.log(`✅ ${purpose} SMS sent successfully to ${cleanPhone}`);
          return { success: true, message: 'SMS sent successfully via DVHosting' };
        } else {
          console.error('❌ DVHosting API returned error:', jsonResponse.message);
          return { success: false, error: jsonResponse.message || 'DVHosting API error' };
        }
      } catch (parseError) {
        // If JSON parsing fails, check if response contains "success"
        const isSuccess = /success/i.test(responseText);

        if (isSuccess) {
          console.log(`✅ ${purpose} SMS sent successfully to ${cleanPhone} (text response)`);
          return { success: true, message: 'SMS sent successfully via DVHosting' };
        } else {
          console.error('❌ DVHosting API response not parseable:', responseText.substring(0, 100));
          return { success: false, error: 'Invalid response from DVHosting API' };
        }
      }
    } catch (error) {
      console.error(`❌ Failed to send ${purpose} SMS to ${phone}:`, error);
      return { success: false, error: 'Failed to send SMS via DVHosting' };
    }
  }

  // Clear all OTPs for a phone number
  clearOTPs(phone) {
    const keys = Array.from(otpStore.keys()).filter(key => key.startsWith(phone));
    keys.forEach(key => otpStore.delete(key));
    console.log(`🧹 Cleared all OTPs for ${phone}`);
  }

  // Get OTP status (for debugging)
  getOTPStatus(phone, purpose = 'login') {
    const key = `${phone}_${purpose}`;
    const otpData = otpStore.get(key);
    
    if (!otpData) {
      return { exists: false };
    }

    return {
      exists: true,
      expiresAt: new Date(otpData.expiryTime),
      attempts: otpData.attempts,
      maxAttempts: otpData.maxAttempts,
      timeRemaining: Math.max(0, otpData.expiryTime - Date.now())
    };
  }
}

module.exports = new OTPService();
