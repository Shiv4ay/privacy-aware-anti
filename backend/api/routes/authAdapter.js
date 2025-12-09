/**
 * Phase 4 Auth Routes Adapter
 * Bridges existing database schema (id) with Phase 4 auth routes (user_id)
 * 
 * This allows Phase 4 auth system to work with your existing users table
 */

const express = require('express');
const router = express.Router();

// Import auth managers
const jwtManager = require('../auth/jwtManager');
const passwordManager = require('../auth/passwordManager');

/**
 * POST /auth/phase4/register
 * Simplified registration that works with existing schema
 */
router.post('/phase4/register', async (req, res) => {
    try {
        const { email, password, username, role = 'student', department, org_id = 1 } = req.body;

        // Validate password
        const errors = passwordManager.validatePasswordStrength(password);
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        // Check existing user
        const existing = await req.db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const passwordHash = await passwordManager.hashPassword(password);

        // Insert user (using existing schema)
        const result = await req.db.query(
            `INSERT INTO users (username, email, password_hash, name, org_id, role, department, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
             RETURNING id, username, email, name, role, org_id, department`,
            [username, email, passwordHash, username, org_id, role, department || 'general']
        );

        const user = result.rows[0];

        // Generate JWT
        const tokens = jwtManager.generateTokenPair({
            user_id: user.id, // Map id to user_id for JWT
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            organization_id: user.org_id
        });

        res.status(201).json({
            message: 'User registered successfully',
            ...tokens,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /auth/phase4/login
 * Simplified login that works with existing schema
 */
router.post('/phase4/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get user
        const result = await req.db.query(
            `SELECT id, username, email, password_hash, role, org_id, department, is_active
             FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account is deactivated' });
        }

        // Verify password
        const isValid = await passwordManager.verifyPassword(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate tokens
        const tokens = jwtManager.generateTokenPair({
            user_id: user.id,
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            organization_id: user.org_id,
            department: user.department
        });

        // Save session
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await req.db.query(
            `INSERT INTO auth_sessions (user_id,refresh_token, expires_at, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [user.id, tokens.refreshToken, expiresAt, req.ip]
        );

        res.json({
            ...tokens,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                org_id: user.org_id,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * GET /auth/phase4/me
 * Get current user (simplified)
 */
router.get('/phase4/me', async (req, res) => {
    try {
        const authHeader = req.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.slice(7);
        const payload = jwtManager.verifyAccessToken(token);

        const result = await req.db.query(
            'SELECT id, username, email, role, org_id, department FROM users WHERE id = $1',
            [payload.user_id || payload.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
