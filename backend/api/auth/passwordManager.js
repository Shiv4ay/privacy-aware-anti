/**
 * Password Manager
 * Handles password hashing, validation, OTP generation, and security checks
 * 
 * Security Features:
 * - Bcrypt hashing with 12 rounds
 * - Password strength validation (12+ chars, uppercase, lowercase, number, special)
 * - Password history check (prevent reuse of last 5)
 * - 6-digit OTP generation with expiry
 * - Email notifications for security events
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 12;
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

/**
 * Hash password using bcrypt
 */
async function hashPassword(plaintext) {
    if (!plaintext || plaintext.length < 1) {
        throw new Error('Password cannot be empty');
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hash = await bcrypt.hash(plaintext, salt);
    return hash;
}

/**
 * Verify password against hash
 */
async function verifyPassword(plaintext, hash) {
    if (!plaintext || !hash) {
        return false;
    }

    try {
        return await bcrypt.compare(plaintext, hash);
    } catch (error) {
        console.error('Password verification error:', error);
        return false;
    }
}

/**
 * Validate password strength
 * Rules:
 * - Minimum 12 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 */
function validatePasswordStrength(password) {
    const errors = [];

    if (!password) {
        return ['Password is required'];
    }

    if (password.length < 12) {
        errors.push('Password must be at least 12 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    // Check common passwords (basic list)
    const commonPasswords = ['password123!', 'Password123!', 'Test1234!@#$', 'Admin123!@#$'];
    if (commonPasswords.includes(password)) {
        errors.push('Password is too common, please choose a stronger password');
    }

    return errors;
}

/**
 * Check if password was used in history (last 5 passwords)
 */
async function checkPasswordHistory(userId, newPasswordHash, db) {
    try {
        const result = await db.query(
            `SELECT password_hash FROM password_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
            [userId]
        );

        for (const row of result.rows) {
            // Compare hashes directly (bcrypt hashes are deterministic per salt)
            if (await bcrypt.compare(newPasswordHash, row.password_hash)) {
                return false; // Password was used before
            }
        }

        return true; // Password is new
    } catch (error) {
        console.error('Password history check error:', error);
        return true; // Allow password change if history check fails
    }
}

/**
 * Save password to history
 */
async function savePasswordHistory(userId, passwordHash, db) {
    try {
        await db.query(
            `INSERT INTO password_history (user_id, password_hash) 
       VALUES ($1, $2)`,
            [userId, passwordHash]
        );

        // Keep only last 5 entries
        await db.query(
            `DELETE FROM password_history 
       WHERE user_id = $1 
       AND id NOT IN (
         SELECT id FROM password_history 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5
       )`,
            [userId]
        );
    } catch (error) {
        console.error('Save password history error:', error);
    }
}

/**
 * Generate 6-digit OTP code
 */
function generateOTP() {
    // Generate cryptographically secure random number
    const otp = crypto.randomInt(100000, 999999).toString();
    return otp;
}

/**
 * Generate OTP with expiry timestamp
 */
function generateOTPWithExpiry() {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    return {
        code: otp,
        expiresAt
    };
}

/**
 * Verify OTP code and expiry
 */
function verifyOTP(providedOTP, storedOTP, expiresAt) {
    if (!providedOTP || !storedOTP) {
        return false;
    }

    // Check expiry
    if (new Date() > new Date(expiresAt)) {
        return false; // OTP expired
    }

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(providedOTP),
        Buffer.from(storedOTP)
    );
}

/**
 * Send OTP via email (placeholder - integrate with your email service)
 */
async function sendOTPEmail(email, otp, userName = '') {
    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    console.log(`[EMAIL] Sending OTP to ${email}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Expires in ${OTP_EXPIRY_MINUTES} minutes`);

    // Example email content:
    const emailContent = {
        to: email,
        subject: 'Password Reset - OTP Code',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>You requested a password reset. Your OTP code is:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
        <p>If you did not request this reset, please ignore this email and ensure your account is secure.</p>
        <hr>
        <p style="color: #888; font-size: 12px;">Privacy-Aware RAG System - University Security Team</p>
      </div>
    `
    };

    // Return email content for testing
    return emailContent;
}

/**
 * Send security notification email
 */
async function sendSecurityEmail(email, message, userName = '') {
    console.log(`[SECURITY EMAIL] To: ${email}`);
    console.log(`Message: ${message}`);

    const emailContent = {
        to: email,
        subject: 'Security Alert - Your Account',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d9534f;">Security Alert</h2>
        <p>Hello ${userName},</p>
        <p>${message}</p>
        <p>If this was not you, please contact your system administrator immediately.</p>
        <p>Time: ${new Date().toISOString()}</p>
        <hr>
        <p style="color: #888; font-size: 12px;">Privacy-Aware RAG System - University Security Team</p>
      </div>
    `
    };

    return emailContent;
}

module.exports = {
    hashPassword,
    verifyPassword,
    validatePasswordStrength,
    checkPasswordHistory,
    savePasswordHistory,
    generateOTP,
    generateOTPWithExpiry,
    verifyOTP,
    sendOTPEmail,
    sendSecurityEmail
};
