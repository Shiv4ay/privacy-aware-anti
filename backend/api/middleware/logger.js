// backend/api/middleware/logger.js
'use strict';

const winston = require('winston');

// Use crypto.randomUUID() — available in Node.js 14.17+ without extra deps
function generateId() {
    return require('crypto').randomUUID();
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
 */
function requestIdMiddleware(req, res, next) {
    const id = req.headers['x-request-id'] || generateId();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}

module.exports = { logger, requestIdMiddleware };
