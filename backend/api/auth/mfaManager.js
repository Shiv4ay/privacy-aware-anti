/**
 * MFA (Multi-Factor Authentication) Manager
 * Handles TOTP-based 2FA with QR codes and recovery codes
 * 
 * Features:
 * - TOTP (Time-based One-Time Password) using RFC 6238
 * - QR code generation for authenticator apps (Google Authenticator, Authy, etc.)
 * - 10 recovery/backup codes
 * - Optional MFA per user
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const APP_NAME = 'Privacy-Aware RAG';

/**
 * Generate MFA secret and QR code for user
 */
async function generateMfaSecret(userId, userEmail) {
    // Generate secret
    const secret = speakeasy.generateSecret({
        name: `${APP_NAME} (${userEmail})`,
        issuer: APP_NAME,
        length: 32
    });

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);

    return {
        secret: secret.base32, // Store this in database
        qrCodeDataURL, // Send this to frontend for display
        otpauthURL: secret.otpauth_url
    };
}

/**
 * Verify TOTP token
 */
function verifyMfaToken(secret, token, window = 1) {
    if (!secret || !token) {
        return false;
    }

    // Verify with time window (allows for clock drift)
    const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window // Allow 30 seconds before/after
    });

    return verified;
}

/**
 * Generate recovery codes (10 codes)
 */
async function generateRecoveryCodes() {
    const codes = [];

    for (let i = 0; i < 10; i++) {
        // Generate 8-character alphanumeric code
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
    }

    return codes;
}

/**
 * Hash recovery codes for storage
 */
async function hashRecoveryCodes(codes) {
    const hashedCodes = await Promise.all(
        codes.map(code => bcrypt.hash(code, 10))
    );
    return hashedCodes;
}

/**
 * Verify recovery code
 */
async function verifyRecoveryCode(providedCode, hashedCodes) {
    if (!providedCode || !hashedCodes || hashedCodes.length === 0) {
        return { valid: false, index: -1 };
    }

    // Check against all hashed codes
    for (let i = 0; i < hashedCodes.length; i++) {
        const match = await bcrypt.compare(providedCode.toUpperCase(), hashedCodes[i]);
        if (match) {
            return { valid: true, index: i };
        }
    }

    return { valid: false, index: -1 };
}

/**
 * 

Remove recovery code from list after use (one-time use)
 */
function removeRecoveryCodeAt(hashedCodes, index) {
    if (index < 0 || index >= hashedCodes.length) {
        return hashedCodes;
    }

    // Create new array without the used code
    return hashedCodes.filter((_, i) => i !== index);
}

/**
 * Enable MFA for user (save to database)
 */
async function enableMFA(userId, secret, recoveryCodes, db) {
    try {
        // Hash recovery codes before storage
        const hashedCodes = await hashRecoveryCodes(recoveryCodes);

        await db.query(
            `INSERT INTO mfa_secrets (user_id, secret, enabled, recovery_codes)
       VALUES ($1, $2, TRUE, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET secret = $2, enabled = TRUE, recovery_codes = $3, created_at = NOW()`,
            [userId, secret, hashedCodes]
        );

        // Update user table
        await db.query(
            `UPDATE users SET is_mfa_enabled = TRUE WHERE user_id = $1`,
            [userId]
        );

        return true;
    } catch (error) {
        console.error('Enable MFA error:', error);
        throw error;
    }
}

/**
 * Disable MFA for user
 */
async function disableMFA(userId, db) {
    try {
        await db.query(
            `UPDATE mfa_secrets SET enabled = FALSE WHERE user_id = $1`,
            [userId]
        );

        await db.query(
            `UPDATE users SET is_mfa_enabled = FALSE WHERE user_id = $1`,
            [userId]
        );

        return true;
    } catch (error) {
        console.error('Disable MFA error:', error);
        throw error;
    }
}

/**
 * Get MFA secret from database
 */
async function getMfaSecret(userId, db) {
    try {
        const result = await db.query(
            `SELECT secret, enabled, recovery_codes, backup_codes_used 
       FROM mfa_secrets 
       WHERE user_id = $1 AND enabled = TRUE`,
            [userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    } catch (error) {
        console.error('Get MFA secret error:', error);
        return null;
    }
}

/**
 * Update last used timestamp
 */
async function updateMfaLastUsed(userId, db) {
    try {
        await db.query(
            `UPDATE mfa_secrets SET last_used = NOW() WHERE user_id = $1`,
            [userId]
        );
    } catch (error) {
        console.error('Update MFA last used error:', error);
    }
}

/**
 * Use recovery code (mark as used)
 */
async function useRecoveryCode(userId, codeIndex, db) {
    try {
        // Get current recovery codes
        const result = await db.query(
            `SELECT recovery_codes, backup_codes_used FROM mfa_secrets WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return false;
        }

        const { recovery_codes, backup_codes_used } = result.rows[0];

        // Remove used code
        const updatedCodes = removeRecoveryCodeAt(recovery_codes, codeIndex);

        // Update database
        await db.query(
            `UPDATE mfa_secrets 
       SET recovery_codes = $1, backup_codes_used = $2 
       WHERE user_id = $3`,
            [updatedCodes, backup_codes_used + 1, userId]
        );

        return true;
    } catch (error) {
        console.error('Use recovery code error:', error);
        return false;
    }
}

/**
 * Check if MFA is enabled for user
 */
async function isMfaEnabled(userId, db) {
    try {
        const result = await db.query(
            `SELECT is_mfa_enabled FROM users WHERE user_id = $1`,
            [userId]
        );

        return result.rows.length > 0 && result.rows[0].is_mfa_enabled;
    } catch (error) {
        console.error('Check MFA enabled error:', error);
        return false;
    }
}

module.exports = {
    generateMfaSecret,
    verifyMfaToken,
    generateRecoveryCodes,
    hashRecoveryCodes,
    verifyRecoveryCode,
    removeRecoveryCodeAt,
    enableMFA,
    disableMFA,
    getMfaSecret,
    updateMfaLastUsed,
    useRecoveryCode,
    isMfaEnabled
};
