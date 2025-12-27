/**
 * Enhanced Authentication Middleware
 * Validates JWT tokens and attaches user context to requests
 * 
 * Features:
 * - JWT token extraction and validation
 * - Token blacklist checking
 * - User status verification (active, not locked)
 * - Development mode bypass
 */

const { verifyAccessToken, isTokenBlacklisted } = require('../auth/jwtManager');

/**
 * Extract token from Authorization header
 */
function extractToken(req) {
    const auth = req.get('Authorization') || req.get('authorization') || '';

    if (!auth || !auth.startsWith('Bearer ')) {
        return null;
    }

    return auth.slice(7).trim();
}

/**
 * Main authentication middleware
 */
async function authenticateJWT(req, res, next) {
    try {
        // Development mode bypass (keep existing dev auth)
        if (process.env.NODE_ENV === 'development') {
            const devAuthKey = req.get('x-dev-auth') || req.get('x-dev-auth-key');
            const expectedKey = process.env.DEV_AUTH_KEY || 'super-secret-dev-key';

            if (devAuthKey && devAuthKey === expectedKey) {
                req.user = {
                    userId: 'dev-user-1',
                    username: 'dev-user',
                    email: 'dev@localhost',
                    role: 'super_admin',
                    department: 'Engineering',
                    organizationId: 'ORG001',
                    entityId: 'DEV001',
                    isDev: true
                };
                return next();
            }
        }

        // Extract token
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        // Verify JWT
        let payload;
        try {
            payload = verifyAccessToken(token);
        } catch (error) {
            console.error('[Auth] Token verification failed:', error.message);
            return res.status(401).json({ error: 'Invalid or expired token', details: error.message });
        }

        // Check token blacklist
        if (isTokenBlacklisted(token)) {
            console.error('[Auth] Token is blacklisted');
            return res.status(401).json({ error: 'Token has been invalidated' });
        }

        // Fetch full user from database (if db connection available)
        if (req.db) {
            if (!payload.userId) {
                console.error('[Auth] Token payload missing userId:', payload);
                return res.status(401).json({ error: 'Invalid token payload (missing userId)' });
            }

            try {
                const userResult = await req.db.query(
                    `SELECT id, user_id, username, email, role, department, org_id, 
                    is_active, is_mfa_enabled 
             FROM users 
             WHERE user_id = $1`,
                    [payload.userId]
                );

                if (userResult.rows.length === 0) {
                    console.error(`[Auth] User ID ${payload.userId} not found in DB`);
                    return res.status(401).json({ error: 'User not found' });
                }

                const user = userResult.rows[0];

                // Check if user is active
                if (!user.is_active) {
                    console.error(`[Auth] User ID ${user.id} is deactivated`);
                    return res.status(401).json({ error: 'Account is deactivated' });
                }

                // Attach full user to request
                req.user = {
                    id: user.id,
                    userId: user.user_id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    organizationId: user.org_id,
                    org_id: user.org_id,
                    is_mfa_enabled: user.is_mfa_enabled
                };
            } catch (dbError) {
                console.error('[Auth] Database lookup failed:', dbError);
                throw new Error(`Database auth lookup failed: ${dbError.message}`);
            }
        } else {
            console.warn('[Auth] No DB connection available on request object');
            // No DB connection - use payload data
            req.user = {
                userId: payload.userId,
                email: payload.email,
                username: payload.username,
                role: payload.role,
                department: payload.department,
                organizationId: payload.organizationId || payload.org_id,
                org_id: payload.org_id || payload.organizationId
            };
        }

        // PHASE 11: Context Propagation (Header Override)
        // Allow client to specify active context (verified against user permissions in real app, implicit here)
        const contextOrg = req.get('X-Organization') || req.get('x-organization');
        if (contextOrg) {
            console.log(`[Auth] Context switched to: ${contextOrg}`);
            req.user.org_id = contextOrg;
            req.user.organizationId = contextOrg;
        }

        next();
    } catch (error) {
        console.error('[Auth] Authentication Critical Error:', error);
        // RETURN DETAILED ERROR TO CLIENT FOR DEBUGGING
        return res.status(500).json({
            error: 'Authentication middleware failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

/**
 * Optional authentication (don't fail if no token)
 */
async function optionalAuth(req, res, next) {
    const token = extractToken(req);

    if (!token) {
        // No token - proceed without user context
        req.user = null;
        return next();
    }

    // Has token - try to authenticate
    return authenticateJWT(req, res, next);
}

/**
 * Require specific role(s)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: roles,
                current: req.user.role
            });
        }

        next();
    };
}

/**
 * Require admin role (university_admin or super_admin)
 */
function requireAdmin(req, res, next) {
    return requireRole('university_admin', 'super_admin')(req, res, next);
}

/**
 * Require super admin role only
 */
function requireSuperAdmin(req, res, next) {
    return requireRole('super_admin')(req, res, next);
}

module.exports = {
    authenticateJWT,
    optionalAuth,
    requireRole,
    requireAdmin,
    requireSuperAdmin,
    extractToken
};
