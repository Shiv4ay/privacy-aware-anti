/**
 * FRESH SIMPLE AUTH SYSTEM
 * Clean, minimal, compatible with actual database
 * Mounted at /api/simple-auth/* to avoid conflicts
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * POST /simple-auth/login
 * Simple login that works with actual database columns
 */
router.post('/login', async (req, res) => {
    try {
        console.log('🔑 Simple login attempt:', req.body.email);

        const { email, password } = req.body;
        console.log('[DEBUG] Body:', JSON.stringify(req.body));
        console.log('[DEBUG] Pass type:', typeof password, 'Length:', password ? password.length : 0);

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

        // Generate JWT tokens
        const accessToken = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                role: user.role,
                org_id: user.org_id
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            {
                userId: user.user_id,
                email: user.email
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        console.log('✅ Login successful:', email);

        // Return success response matching Phase 4 format
        res.json({
            accessToken,
            refreshToken,
            user: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                org_id: user.org_id,
                department: user.department
            }
        });

    } catch (error) {
        console.error('💥 Simple login error:', error);
        res.status(500).json({
            error: 'Login failed',
            details: error.message
        });
    }
});

/**
 * GET /simple-auth/me
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

        // Verify and decode token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        // Get fresh user data from database
        const result = await req.db.query(
            `SELECT user_id, username, email, role, org_id, department, is_active
             FROM users WHERE user_id = $1`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        res.json({
            user: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                org_id: user.org_id,
                department: user.department
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
