// backend/api/middleware/logger.js
'use strict';

const crypto = require('crypto');
const winston = require('winston');

// Allowlist: alphanumeric, hyphens, underscores, max 128 chars
const SAFE_ID_RE = /^[a-zA-Z0-9\-_]{1,128}$/;

function sanitizeRequestId(value) {
    if (typeof value === 'string' && SAFE_ID_RE.test(value)) return value;
    return null;
}

// Use crypto.randomUUID() — available in Node.js 14.17+ without extra deps
function generateId() {
    return crypto.randomUUID();
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'privacy-rag-api' },
    transports: [
        new winston.transports.Console(),
    ],
});

/**
 * Express middleware: attach a unique request_id to req and res headers.
 * Sanitizes the incoming x-request-id to prevent log injection; handles
 * multi-value headers by taking only the first value.
 */
function requestIdMiddleware(req, res, next) {
    const incoming = req.headers['x-request-id'];
    const raw = Array.isArray(incoming) ? incoming[0] : incoming;
    const id = sanitizeRequestId(raw) || generateId();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}

module.exports = { logger, requestIdMiddleware };
