/**
 * Rate Limiting Middleware
 * Prevents brute force attacks with intelligent rate limiting backed by Redis
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default || require('rate-limit-redis');
const Redis = require('ioredis');

// Connect to existing Redis instance
const redisClient = new Redis(process.env.REDIS_URL || 'redis://redis:6379/0', {
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3
});

redisClient.on('error', (err) => console.warn('RateLimiter Redis warning:', err.message));

/**
 * Safely normalize IP address for use in keys
 */
function normalizeIP(ip) {
    if (!ip) return 'unknown';
    const normalized = String(ip).replace(/^::ffff:/, '');
    return normalized.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Custom handler that blocks the request AND logs it instantly to the Security Audit UI
 */
const securityThreatHandler = (req, res, next, options) => {
    try {
        const userId = req.user?.userId || null;
        const safeIP = normalizeIP(req.ip);

        // Construct the Audit Log payload 
        const auditPayload = {
            type: "audit_log",
            action: "rate_limit_exceeded",
            user_id: userId,
            resource_type: "api_endpoint",
            resource_id: null,
            success: false, // Blocked
            error_message: "Rate limit threshold breached (DDoS protection)",
            details: {
                endpoint: req.originalUrl,
                method: req.method,
                ip: safeIP,
                limit_rule: options.message
            },
            timestamp: new Date().toISOString()
        };

        // Fire and forget to the realtime dashboard
        redisClient.publish('system_activity', JSON.stringify(auditPayload));

        // Let the worker know to insert this into the DB for permanent records
        redisClient.lpush("audit_queue", JSON.stringify(auditPayload));

        console.warn(`[SECURITY WALL] Rate limit breached by IP: ${safeIP} on ${req.originalUrl}`);
    } catch (err) {
        console.error("Failed to broadcast rate limit alert:", err);
    }

    res.status(429).json({ status: 'error', message: options.message || 'Too many requests' });
};

// Common RedisStore config factory
const createRedisStore = (prefix) => {
    return new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `rl_${prefix}_`
    });
};

/**
 * AI Rate Limiter - STRICT (20 requests per minute)
 * Protects expensive LLM /search and /chat endpoints
 */
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Artificial Intelligence capacity limit reached. Please wait a moment.',
    store: createRedisStore('ai'),
    keyGenerator: (req) => req.user?.userId ? `user_${req.user.userId}` : `ip_${normalizeIP(req.ip)}`,
    handler: securityThreatHandler
});

/**
 * General API rate limiter - 100 requests per minute
 */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many API requests, please slow down',
    store: createRedisStore('api'),
    keyGenerator: (req) => req.user?.userId ? `user_${req.user.userId}` : `ip_${normalizeIP(req.ip)}`,
    skip: (req) => req.user?.role === 'super_admin' || req.originalUrl.includes('/health'),
    handler: securityThreatHandler
});

/**
 * Login rate limiter - 5 attempts per 15 minutes
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    store: createRedisStore('login'),
    keyGenerator: (req) => `login_${normalizeIP(req.ip)}_${(req.body && req.body.email) || 'unknown'}`,
    handler: securityThreatHandler
});

/**
 * Password reset limiter - 3 attempts per hour
 */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many password reset requests',
    store: createRedisStore('pwd'),
    handler: securityThreatHandler
});

module.exports = {
    loginLimiter,
    passwordResetLimiter,
    apiLimiter,
    aiLimiter
};
