/**
 * STANDARD PRODUCTION AUTH SYSTEM
 * Unified, clean, and schema-compliant
 * Mounted at /api/auth
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwtManager = require('../auth/jwtManager');

/**
 * POST /auth/login
 * Standard production login
 */
router.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;

        // Input sanitization (Trim whitespace)
        if (email) email = email.trim();
        if (password) password = password.trim();

        console.log('🔑 Login attempt:', email);

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Query only columns that actually exist in database
        // Alias id -> user_id to match code expectations
        const query = `
            SELECT id as user_id, email, password_hash, role, org_id, department, 
                   is_active, username
            FROM users 
            WHERE email = $1
        `;

        const result = await req.db.query(query, [email]);

        if (result.rows.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            console.log('❌ Account disabled:', email);
            return res.status(401).json({ error: 'Account is disabled' });
        }

        // Verify password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT tokens using consistent JWT Manager
        // SUPER ADMIN FIX: Super admin should NEVER have org_id in JWT
        const tokenPayload = {
            user_id: user.user_id,
            email: user.email,
            username: user.username,
            role: user.role,
            department_id: user.department
        };

        // Only include organization_id for non-super-admin users
        if (user.role !== 'super_admin') {
            tokenPayload.organization_id = user.org_id;
        }

        const accessToken = jwtManager.generateAccessToken(tokenPayload);

        const refreshToken = jwtManager.generateRefreshToken({
            user_id: user.user_id
        });

        console.log('✅ Login successful:', email, '| Role:', user.role);

        // Return success response
        // For super admin, org_id should be null/undefined
        res.json({
            accessToken,
            refreshToken,
            user: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                org_id: user.role === 'super_admin' ? null : user.org_id,
                department: user.department
            }
        });

    } catch (error) {
        console.error('💥 Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            details: error.message
        });
    }
});

/**
 * GET /auth/me
 * Get current user info from token
 */
router.get('/me', async (req, res) => {
    try {
        // Get token from Authorization header
        const authHeader = req.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        // Verify and decode token using consistent JWT Manager
        // This ensures shared strictness (algo, secret, expiry)
        const decoded = jwtManager.verifyAccessToken(token);

        // Get fresh user data from database (using correct 'id' column)
        // Defensive: Check both possible field names from JWT
        // Only select columns that actually exist in the table
        const result = await req.db.query(
            `SELECT id AS user_id, username, email, role, org_id
             FROM users WHERE id = $1`,
            [decoded.user_id || decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // PHASE 17 FIX: Respect Session Context
        // If the token has a specific organization claim (from /session/set-org),
        // we must return THAT context, not the default DB value.
        // Check ALL possible organization field names from JWT
        const orgFromToken = decoded.organizationId || decoded.organization_id || decoded.organization || decoded.org_id;
        if (orgFromToken) {
            user.org_id = orgFromToken;
        }

        // SUPER ADMIN FIX: super_admin should never have org_id
        const isSuperAdmin = user.role === 'super_admin';
        if (isSuperAdmin) {
            user.org_id = null;
        }

        res.json({
            user: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                org_id: user.org_id,
                // CRITICAL: Map org_id to organization for frontend consistency
                // For super admin, organization should be null
                organization: user.org_id
            }
        });

    } catch (error) {
        console.error('[/auth/me] Error occurred:');
        console.error('  Error type:', error.name);
        console.error('  Error message:', error.message);
        console.error('  Stack:', error.stack);

        // More specific error responses
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', details: error.message });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token format', details: error.message });
        } else if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(401).json({ error: 'Invalid token', details: error.message });
    }
});

router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
