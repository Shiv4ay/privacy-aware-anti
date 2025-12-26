/**
 * PHASE 4 AUTHENTICATION SYSTEM
 * Secure, Compliant, and Robust
 * Mounted at /api/auth
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwtManager = require('../auth/jwtManager');
const { authenticateJWT } = require('../middleware/authMiddleware');

// ==========================================
// HELPERS
// ==========================================

// Validate email format
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate password strength (Phase 4 requirement)
function isStrongPassword(password) {
    return password.length >= 10;
    // In production, add complexity checks (Upper, Lower, Number, Special)
}

// Log security event
async function logAudit(db, userId, action, success, details = {}, req = null) {
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
        const ua = req ? req.get('User-Agent') : null;

        await db.query(`
            INSERT INTO audit_log 
            (user_id, action, resource_type, ip_address, user_agent, success, error_message, metadata)
            VALUES ($1, $2, 'auth', $3, $4, $5, $6, $7)
        `, [
            userId,
            action,
            ip,
            ua,
            success,
            success ? null : (details.error || 'Unknown error'),
            success ? details : null
        ]);
    } catch (err) {
        console.error('Audit logging failed:', err.message);
    }
}

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /api/auth/organizations
 * List all organizations (Public for registration)
 */
router.get('/organizations', async (req, res) => {
    try {
        const result = await req.db.query('SELECT id, name, type FROM organizations ORDER BY name ASC');
        res.json({
            success: true,
            organizations: result.rows
        });
    } catch (err) {
        console.error('Failed to fetch orgs:', err);
        res.status(500).json({ error: 'Failed to load organizations' });
    }
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    const client = await req.db.connect();
    try {
        await client.query('BEGIN');

        let { email, password, username, role, department, org_id } = req.body;

        // Sanitization
        email = (email || '').trim().toLowerCase();
        username = (username || '').trim();

        // Validation
        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Email, password, and username are required' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 10 characters long' });
        }

        // Check format of org_id if provided (should be string usually, e.g. "ORG001")
        // If system expects integer, handle accordingly. Current schema implies string or int mapping.
        // `users` table has `org_id` as INTEGER. If user sends "ORG001", we might have a mismatch if not handled.
        // Assuming user sends ID for now or frontend handles mapping via `orgs` endpoint.
        // For public registration, usually org is assigned or looked up.
        // Simplifying: if org_id is provided, use it, else null (or default).

        // Check if user exists
        const userCheck = await client.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (userCheck.rows.length > 0) {
            await logAudit(client, null, 'register_attempt', false, { error: 'User already exists', email }, req);
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const saltRounds = 12; // High security
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Default role
        const assignedRole = ['student', 'faculty', 'researcher'].includes(role) ? role : 'user';

        // Insert user
        const insertQuery = `
            INSERT INTO users (username, email, password_hash, role, department, org_id, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            RETURNING id, username, email, role, org_id
        `;
        const newUser = await client.query(insertQuery, [username, email, passwordHash, assignedRole, department, org_id]);
        const user = newUser.rows[0];

        // Log to password history
        await client.query(
            'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
            [user.id, passwordHash]
        );

        // Generate tokens
        const tokens = jwtManager.generateTokenPair({ ...user, user_id: user.id });

        // Create Session
        await client.query(`
            INSERT INTO auth_sessions 
            (user_id, refresh_token, expires_at, ip_address, user_agent)
            VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4)
        `, [user.id, tokens.refreshToken, req.ip, req.get('User-Agent')]);

        await logAudit(client, user.id, 'register', true, { role: assignedRole }, req);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Registration successful',
            user: {
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                org_id: user.org_id
            },
            ...tokens
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Registration failed', details: error.message });
    } finally {
        client.release();
    }
});

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        email = (email || '').trim().toLowerCase();

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Fetch user
        const result = await req.db.query(
            `SELECT u.id, u.username, u.email, u.password_hash, u.role, u.org_id, u.department, u.is_active, u.failed_login_attempts, o.type as organization_type
             FROM users u
             LEFT JOIN organizations o ON u.org_id = o.id
             WHERE u.email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            // Mitigate timing attacks slightly (not perfect but better than instant return)
            await bcrypt.compare('dummy', '$2b$12$BQ.................');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            // Increment failed attempts
            await req.db.query('UPDATE users SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE id = $1', [user.id]);
            await logAudit(req.db, user.id, 'login_failed', false, { error: 'Invalid password' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Reset failed attempts on success
        await req.db.query('UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE id = $1', [user.id]);

        // Generate Tokens
        const tokens = jwtManager.generateTokenPair({ ...user, user_id: user.id });

        // Store Session
        await req.db.query(`
            INSERT INTO auth_sessions 
            (user_id, refresh_token, expires_at, ip_address, user_agent)
            VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4)
        `, [user.id, tokens.refreshToken, req.ip, req.get('User-Agent')]);

        await logAudit(req.db, user.id, 'login', true, {}, req);

        res.json({
            message: 'Login successful',
            user: {
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                org_id: user.org_id,
                organization_type: user.organization_type,
                department: user.department
            },
            ...tokens
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/refresh-token
 * Get new access token using refresh token
 */
router.post('/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        // Verify JWT signature
        let decoded;
        try {
            decoded = jwtManager.verifyRefreshToken(refreshToken);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Check DB session
        const sessionResult = await req.db.query(
            'SELECT session_id, user_id, is_active FROM auth_sessions WHERE refresh_token = $1',
            [refreshToken]
        );

        if (sessionResult.rows.length === 0) {
            // Token Reuse Detection / Fraud:
            // Valid signature but not in DB? Might be a reused token that was rotated.
            // In a strict system, we would invalidate ALL user sessions here.
            await logAudit(req.db, decoded.userId, 'refresh_token_reuse_attempt', false, { token: refreshToken.substring(0, 10) + '...' }, req);
            return res.status(403).json({ error: 'Invalid session (Token Reuse Detected)' });
        }

        const session = sessionResult.rows[0];
        if (!session.is_active) {
            return res.status(403).json({ error: 'Session inactive' });
        }

        // Get User
        const userResult = await req.db.query('SELECT id, username, email, role, org_id, department FROM users WHERE id = $1', [session.user_id]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = userResult.rows[0];

        // Rotate Tokens (Security Best Practice)
        // 1. Invalidate old refresh token (delete or mark inactive, or just replace)
        // We will replace it in this session to keep the session ID stable but rotate the key.
        const newTokens = jwtManager.generateTokenPair({ ...user, user_id: user.id });

        await req.db.query(`
            UPDATE auth_sessions 
            SET refresh_token = $1, last_used = NOW(), expires_at = NOW() + INTERVAL '7 days'
            WHERE session_id = $2
        `, [newTokens.refreshToken, session.session_id]);

        res.json({
            ...newTokens
        });

    } catch (error) {
        console.error('Refresh Error:', error);
        res.status(500).json({ error: 'Refresh failed' });
    }
});

/**
 * POST /api/auth/logout
 * Invalidate session
 */
router.post('/logout', authenticateJWT, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const accessToken = req.get('Authorization')?.split(' ')[1];

        // Blacklist Access Token
        if (accessToken) {
            jwtManager.invalidateToken(accessToken);
        }

        // Invalidate Session in DB
        if (refreshToken) {
            await req.db.query('UPDATE auth_sessions SET is_active = FALSE WHERE refresh_token = $1', [refreshToken]);
        } else {
            // Fallback: Invalidate all sessions for this IP? Or just rely on Access Token expiry?
            // Ideally logout should send refresh token to kill the specific session.
            // If not provided, we can't kill the refresh session easily without user ID context from DB which we have in req.user
            if (req.user && req.user.userId) {
                // Optional: Kill all sessions for user? No, that's too aggressive.
                // Just logging out.
            }
        }

        await logAudit(req.db, req.user?.userId, 'logout', true, {}, req);
        res.json({ message: 'Logged out successfully' });

    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateJWT, async (req, res) => {
    try {
        // req.user is already hydrated by middleware
        // We just return it, ensuring sensitive fields are omitted
        res.json({
            user: {
                userId: req.user.userId,
                username: req.user.username,
                email: req.user.email,
                role: req.user.role,
                department: req.user.department,
                org_id: req.user.organizationId || req.user.org_id
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/**
 * POST /api/auth/request-password-reset
 * Generate OTP
 */
router.post('/request-password-reset', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const userRes = await req.db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            // Return success to prevent email enumeration
            return res.json({ message: 'If account exists, OTP has been sent.' });
        }
        const userId = userRes.rows[0].id;

        // Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();

        await req.db.query(`
            INSERT INTO password_reset_tokens (user_id, otp_code, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
        `, [userId, otp]);

        // IN PRODUCTION: Send Email
        // For Proof of Concept / Dev: Return OTP in logs (or response if DEBUG mode)
        console.log(`[DEV OTP] Password Reset for ${email}: ${otp}`);

        await logAudit(req.db, userId, 'password_reset_request', true, {}, req);

        res.json({ message: 'If account exists, OTP has been sent.', dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined });

    } catch (error) {
        console.error('Reset Request Error:', error);
        res.status(500).json({ error: 'Request failed' });
    }
});

/**
 * POST /api/auth/reset-password
 * Confirm OTP and set new password
 */
router.post('/reset-password', async (req, res) => {
    const client = await req.db.connect();
    try {
        await client.query('BEGIN');
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'All fields required' });
        }
        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ error: 'Password too weak' });
        }

        // Verify OTP
        const query = `
            SELECT t.token_id, u.id as user_id
            FROM password_reset_tokens t
            JOIN users u ON t.user_id = u.id
            WHERE u.email = $1 
            AND t.otp_code = $2 
            AND t.used = FALSE 
            AND t.expires_at > NOW()
        `;
        const result = await client.query(query, [email, otp]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const { token_id, user_id } = result.rows[0];

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Update User
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user_id]);

        // Mark Token Used
        await client.query('UPDATE password_reset_tokens SET used = TRUE, used_at = NOW() WHERE token_id = $1', [token_id]);

        // Log to History
        await client.query('INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)', [user_id, passwordHash]);

        // Revoke all existing sessions (Security Best Practice)
        await client.query('UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1', [user_id]);

        await logAudit(client, user_id, 'password_reset_success', true, {}, req);

        await client.query('COMMIT');
        res.json({ message: 'Password reset successfully. Please login.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Reset Confirm Error:', error);
        res.status(500).json({ error: 'Reset failed' });
    } finally {
        client.release();
    }
});

/**
 * POST /api/auth/change-password
 * Change password for logged-in user
 */
router.post('/change-password', authenticateJWT, async (req, res) => {
    const client = await req.db.connect();
    try {
        await client.query('BEGIN');
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.userId;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }
        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ error: 'New password is too weak (min 10 chars)' });
        }

        // Get current hash
        const result = await client.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = result.rows[0];

        // Verify current password
        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) {
            await logAudit(client, userId, 'password_change_failed', false, { error: 'Incorrect current password' }, req);
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        // Hash new password
        const newHash = await bcrypt.hash(newPassword, 12);

        // Update
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

        // Log to history
        await client.query('INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)', [userId, newHash]);

        await logAudit(client, userId, 'password_change_success', true, {}, req);

        await client.query('COMMIT');
        res.json({ message: 'Password updated successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Change Password Error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    } finally {
        client.release();
    }
});

/**
 * POST /api/auth/mfa/toggle
 * Toggle MFA (Simulated for Demo)
 */
router.post('/mfa/toggle', authenticateJWT, async (req, res) => {
    try {
        const { enabled } = req.body;
        const userId = req.user.userId;

        // Persist to Database
        await req.db.query('UPDATE users SET is_mfa_enabled = $1 WHERE id = $2', [enabled, userId]);

        await logAudit(req.db, userId, 'mfa_toggle', true, { enabled }, req);

        res.json({
            success: true,
            message: enabled ? 'MFA Enabled' : 'MFA Disabled',
            status: enabled
        });
    } catch (error) {
        console.error("MFA Toggle Error:", error);
        res.status(500).json({ error: 'Failed to toggle MFA' });
    }
});

module.exports = router;
