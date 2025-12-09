// backend/api/index.js - Phase 4 Integration
// This file demonstrates how to integrate the Phase 4 auth system
// Add these lines AFTER the existing middleware setup

// ========================================
// PHASE 4: AUTH SYSTEM INTEGRATION
// ========================================

// 1. Import Phase 4 security middleware
const { configureSecurityHeaders } = require('./middleware/securityHeaders');
const { apiLimiter, loginLimiter, passwordResetLimiter, registrationLimiter } = require('./middleware/rateLimiter');
const { sanitizeBody } = require('./middleware/validator');
const { anomalyDetectionMiddleware } = require('./security/anomalyDetector');

// 2. Import Phase 4 auth routes
const phase4AuthRoutes = require('./routes/auth');

// 3. Apply security headers FIRST (before other middleware)
configureSecurityHeaders(app);

// 4. Add input sanitization (after express.json() but before routes)
app.use(sanitizeBody);

// 5. Add Phase 4 comprehensive auth routes
// Note: This replaces the basic auth endpoints in the original index.js
app.use('/api/auth', phase4AuthRoutes);

// 6. Apply rate limiting to all API routes (after auth routes)
app.use('/api', apiLimiter);

// 7. Apply anomaly detection to all authenticated routes
app.use('/api/search', anomalyDetectionMiddleware);
app.use('/api/upload', anomalyDetectionMiddleware);
app.use('/api/documents', anomalyDetectionMiddleware);

// ========================================
// DATABASE CONNECTION MIDDLEWARE
// ========================================
// Attach database pool to all requests for auth routes
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// ========================================
// NOTES FOR INTEGRATION:
// ========================================
// 1. The existing basic auth endpoints (lines 184-429 in index.js) can be removed
//    as they are replaced by comprehensive Phase 4 endpoints in /routes/auth.js
//
// 2. Make sure JWT_SECRET and JWT_REFRESH_SECRET are in .env
//
// 3. Run database migration: 004_auth_system.sql
//
// 4. Phase 4 endpoints provide:
//    - Enhanced registration with password validation
//    - MFA support with QR codes
//    - OTP password reset
//    - Token refresh mechanism
//    - Session management
//    - Audit logging
//
// 5. All Phase 4 endpoints use the enhanced authMiddleware.js which supports:
//    - JWT validation
//    - Token blacklisting
//    - Account status checking (locked/inactive)
//    - Development mode bypass
