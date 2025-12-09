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
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Check token blacklist
        if (isTokenBlacklisted(token)) {
            return res.status(401).json({ error: 'Token has been invalidated' });
        }

        // Fetch full user from database (if db connection available)
        if (req.db) {
            const userResult = await req.db.query(
                `SELECT user_id, username, email, role, department_id, organization_id, 
                entity_id, is_active, locked_until 
         FROM users 
         WHERE user_id = $1`,
                [payload.userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(401).json({ error: 'User not found' });
            }

            const user = userResult.rows[0];

            // Check if user is active
            if (!user.is_active) {
                return res.status(401).json({ error: 'Account is deactivated' });
            }

            // Check if account is locked
            if (user.locked_until && new Date(user.locked_until) > new Date()) {
                return res.status(401).json({
                    error: 'Account is temporarily locked',
                    lockedUntil: user.locked_until
                });
            }

            // Attach full user to request
            req.user = {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                department: user.department_id,
                organizationId: user.organization_id,
                entityId: user.entity_id
            };
        } else {
            // No DB connection - use payload data
            req.user = {
                userId: payload.userId,
                email: payload.email,
                username: payload.username,
                role: payload.role,
                department: payload.department,
                organizationId: payload.organizationId
            };
        }

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
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
