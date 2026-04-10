// backend/api/middleware/metrics.js
'use strict';

const client = require('prom-client');

// Isolated registry — avoids double-registration when tests require() this module multiple times
const register = new client.Registry();

// Collect default Node.js metrics (heap, GC, event-loop lag, etc.)
client.collectDefaultMetrics({ register });

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
});

// HTTP requests counter
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

/**
 * Express middleware: record request duration and count on response finish.
 * Skips self-recording for the /metrics scrape route.
 */
function metricsMiddleware(req, res, next) {
    if (req.path === '/metrics') return next();
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        const labels = {
            method: req.method,
            // Use route template (e.g. /api/user/:id) to avoid cardinality explosion.
            // Fall back to 'unmatched' for 404s — never raw req.path.
            route: req.route?.path || 'unmatched',
            status_code: res.statusCode,
        };
        end(labels);
        httpRequestsTotal.inc(labels);
    });
    next();
}

module.exports = { register, httpRequestDuration, httpRequestsTotal, metricsMiddleware };
