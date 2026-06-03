// backend/api/middleware/csrf.js
// Double-submit cookie CSRF protection.
// Client reads __csrf cookie; sends value in X-CSRF-Token header on mutations.
// Stateless — works with JWT auth. Safe for SPA frontends.
'use strict';

const crypto = require('crypto');

const CSRF_COOKIE = '__csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_BYTES = 32;

/**
 * setCsrfCookie — set __csrf cookie on every response if not already present.
 * Must be mounted globally before route handlers.
 */
function setCsrfCookie(req, res, next) {
    if (!req.cookies || !req.cookies[CSRF_COOKIE]) {
        const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
        res.cookie(CSRF_COOKIE, token, {
            httpOnly: false,  // JS must read it to send the header
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000,  // 24 hours
        });
    }
    next();
}

/**
 * verifyCsrf — reject state-changing requests without matching CSRF token.
 * Mount on individual route groups (not globally, to avoid blocking health checks).
 * Dev bypass: when NODE_ENV !== 'production' and x-dev-auth header is present, skip check.
 */
function verifyCsrf(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    // Development bypass — allow x-dev-auth requests to skip CSRF
    if (process.env.NODE_ENV !== 'production') {
        const devAuthKey = req.get('x-dev-auth') || req.get('x-dev-auth-key');
        const expectedKey = process.env.DEV_AUTH_KEY || 'super-secret-dev-key';
        if (devAuthKey && devAuthKey === expectedKey) return next();
    }

    const cookieToken = req.cookies && req.cookies[CSRF_COOKIE];
    const headerToken = req.get(CSRF_HEADER);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({
            error: 'CSRF validation failed',
            hint: 'Send the value of the __csrf cookie in the X-CSRF-Token header',
        });
    }
    next();
}

module.exports = { setCsrfCookie, verifyCsrf };
