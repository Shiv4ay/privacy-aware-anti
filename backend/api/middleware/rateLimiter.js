/**
 * Rate Limiting Middleware
 * Prevents brute force attacks with intelligent rate limiting
 * 
 * Features:
 * - Login: 5 attempts per 15 minutes
 * - Password reset: 3 attempts per hour
 * - API calls: 100 requests per minute per user
 * - Account lockout after 5 failed attempts
 */

const rateLimit = require('express-rate-limit');

/**
 * Login rate limiter - 5 attempts per 15 minutes
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    keyGenerator: (req) => {
        // Rate limit by IP + email combination
        const email = (req.body && req.body.email) || 'unknown';
        return `login_${req.ip}_${email}`; // Prefix to avoid IPv6 detection error
    },
    validate: {
        trustProxy: false
    }
});

/**
 * Password reset rate limiter - 3 attempts per hour
 */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many password reset requests, please try again after 1 hour',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = (req.body && req.body.email) || 'unknown';
        return `pwd_reset_${req.ip}_${email}`;
    }
});

/**
 * Registration rate limiter - 3 per hour per IP
 */
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many registration attempts, please try again later',
    // Default keyGenerator uses IP, which is fine if we don't override it
    // But if we want consistent prefixes:
    keyGenerator: (req) => `register_${req.ip}`
});

/**
 * General API rate limiter - 100 requests per minute
 */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests, please slow down',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        try {
            // Use user ID if authenticated, otherwise IP
            console.log(`[DEBUG] RateLimit KeyGen: IP=${req.ip} User=${req.user?.userId}`);
            return req.user?.userId ? `user_${req.user.userId}` : `ip_${req.ip}`;
        } catch (e) {
            console.error('[DEBUG] RateLimit KeyGen Error:', e);
            throw e;
        }
    },
    skip: (req) => {
        // Skip rate limiting for super admins
        return req.user?.role === 'super_admin';
    }
});

/**
 * Strict rate limiter for sensitive operations - 10 per hour
 */
const strictLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many requests for this sensitive operation',
    keyGenerator: (req) => req.user?.userId ? `strict_user_${req.user.userId}` : `strict_ip_${req.ip}`
});

/**
 * MFA setup limiter - Prevent MFA spam
 */
const mfaLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many MFA setup attempts',
    keyGenerator: (req) => req.user?.userId ? `mfa_${req.user.userId}` : `mfa_ip_${req.ip}`
});

module.exports = {
    loginLimiter,
    passwordResetLimiter,
    registrationLimiter,
    apiLimiter,
    strictLimiter,
    mfaLimiter
};
