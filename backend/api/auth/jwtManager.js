/**
 * JWT Token Manager
 * Handles generation and validation of access and refresh tokens
 * 
 * Security:
 * - Access tokens: 15 minutes expiry
 * - Refresh tokens: 7 days expiry
 * - Uses HS256 algorithm
 * - Token blacklisting for logout/invalidation
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Load from environment
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = '4h'; // Extended for better UX - was 15m
const REFRESH_TOKEN_EXPIRY = '7d'; // Unchanged - secure balance

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

// In-memory blacklist (use Redis in production for distributed systems)
const tokenBlacklist = new Set();

/**
 * Generate access token (15 minutes)
 */
function generateAccessToken(user) {
    const payload = {
        userId: user.user_id || user.userId, // Allow snake_case or camelCase input
        email: user.email,
        username: user.username,
        role: user.role,
        department: user.department_id || user.department,
        organizationId: user.organization_id || user.organization || user.org_id, // Robust org check
        type: 'access'
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        algorithm: 'HS256'
    });
}

/**
 * Generate refresh token (7 days)
 */
function generateRefreshToken(user) {
    const payload = {
        userId: user.user_id,
        type: 'refresh',
        sessionId: crypto.randomBytes(16).toString('hex') // Unique session identifier
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        algorithm: 'HS256'
    });
}

/**
 * Generate temporary MFA token (valid for 5 minutes)
 */
function generateMFAToken(user) {
    const payload = {
        userId: user.user_id || user.userId,
        type: 'mfa_pending'
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '5m',
        algorithm: 'HS256'
    });
}


/**
 * Verify access token
 */
function verifyAccessToken(token) {
    try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

        if (payload.type !== 'access') {
            throw new Error('Invalid token type');
        }

        // Check blacklist
        if (isTokenBlacklisted(token)) {
            throw new Error('Token has been invalidated');
        }

        return payload;
    } catch (error) {
        throw new Error(`Token verification failed: ${error.message}`);
    }
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
    try {
        const payload = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });

        if (payload.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        // Check blacklist
        if (isTokenBlacklisted(token)) {
            throw new Error('Token has been invalidated');
        }

        return payload;
    } catch (error) {
        throw new Error(`Refresh token verification failed: ${error.message}`);
    }
}

/**
 * Verify MFA pending token
 */
function verifyMFAToken(token) {
    try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

        if (payload.type !== 'mfa_pending') {
            throw new Error('Invalid token type');
        }

        return payload;
    } catch (error) {
        throw new Error(`MFA verification failed: ${error.message}`);
    }
}


/**
 * Invalidate token (add to blacklist)
 */
function invalidateToken(token) {
    const hash = hashToken(token);
    tokenBlacklist.add(hash);

    // Auto-cleanup: Remove from blacklist after expiry
    setTimeout(() => {
        tokenBlacklist.delete(hash);
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
}

/**
 * Check if token is blacklisted
 */
function isTokenBlacklisted(token) {
    const hash = hashToken(token);
    return tokenBlacklist.has(hash);
}

/**
 * Hash token for blacklist storage (privacy)
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Decode token without verification (for debugging)
 */
function decodeToken(token) {
    return jwt.decode(token);
}

/**
 * Generate token pair (access + refresh)
 */
function generateTokenPair(user) {
    return {
        accessToken: generateAccessToken(user),
        refreshToken: generateRefreshToken(user),
        expiresIn: 4 * 60 * 60, // 4 hours in seconds
        tokenType: 'Bearer'
    };
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    verifyMFAToken,
    invalidateToken,
    isTokenBlacklisted,
    decodeToken,
    generateTokenPair,
    generateMFAToken
};
