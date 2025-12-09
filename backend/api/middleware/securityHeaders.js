/**
 * Security Headers Middleware
 * Protects against XSS, clickjacking, MIME sniffing using Helmet
 */

const helmet = require('helmet');

/**
 * Configure Helmet security headers
 */
function configureSecurityHeaders(app) {
    // Use Helmet with custom configuration
    app.use(helmet({
        // Content Security Policy
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts (adjust for production)
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },

        // HTTP Strict Transport Security
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        },

        // Prevent clickjacking
        frameguard: {
            action: 'deny'
        },

        // Prevent MIME type sniffing
        noSniff: true,

        // XSS protection
        xssFilter: true,

        // Hide X-Powered-By header
        hidePoweredBy: true,

        // DNS Prefetch Control
        dnsPrefetchControl: { allow: false },

        // Don't allow browser to cache HTTPS content
        noCache: false,

        // Referrer Policy
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        }
    }));

    // Additional custom headers
    app.use((req, res, next) => {
        // Permissions Policy (formerly Feature Policy)
        res.setHeader('Permissions-Policy',
            'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
        );

        // X-Content-Type-Options
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // X-Frame-Options (redundant with Helmet but explicit)
        res.setHeader('X-Frame-Options', 'DENY');

        // X-XSS-Protection (legacy but still useful)
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // Cross-Origin policies
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

        next();
    });
}

/**
 * CORS configuration (more restrictive)
 */
function configureCORS(app) {
    const cors = require('cors');

    const corsOptions = {
        origin: function (origin, callback) {
            // Allow requests from specific origins
            const allowedOrigins = [
                'http://localhost:3000', // Frontend development
                'http://localhost:3001', // API Gateway
                process.env.FRONTEND_URL
            ].filter(Boolean);

            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Auth', 'X-Dev-Auth-Key']
    };

    app.use(cors(corsOptions));
}

module.exports = {
    configureSecurityHeaders,
    configureCORS
};
