const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { authenticateJWT } = require('../middleware/authMiddleware');

// SECURITY NOTE (C2): All routes in this file are mounted at /api/user with
// authenticateJWT applied at the mount point in index.js (line ~191).
// req.user is always populated by the time any handler here runs.
// The per-route guard below is added as defence-in-depth so the route
// remains protected if the mount-point middleware is ever changed.

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// POST /api/user/setup
router.post('/setup', authenticateJWT, async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId || req.user.id;
        const { organizationType, organizationName, roleCategory, department } = req.body;

        if (!organizationType || !roleCategory) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // 1. Handle Organization
        let orgId = req.user.org_id; // Default to current if not changing

        // If user selected a specific type and provided a name, we might need to find or create it
        // For simplicity in this phase, if they select "General" or a type, we update their metadata
        // In a real app, this might trigger a request to join an org or create one.
        // Here we will assume they are updating their profile within their CURRENT org, 
        // OR if they are in a default org, they might be "claiming" a new one.

        // For this specific requirement: "Popup shows dropdown... Automatically update backend"
        // We will update the user's profile fields.

        // Update User Profile
        // M1-fix: use user_id (UUID column) consistently — not integer id PK
        const updateUserQuery = `
            UPDATE users
            SET user_category = $1,
                department = $2
            WHERE user_id = $3
            RETURNING id, username, email, role, org_id, department, user_category
        `;

        const result = await client.query(updateUserQuery, [
            roleCategory,
            department || 'General',
            userId
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('User setup error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    } finally {
        client.release();
    }
});

// ============================================================
// T9.4: Privacy Shield Toggle
// ============================================================

/**
 * GET /api/user/privacy-shield
 * Returns the current privacy shield state for the authenticated user.
 */
router.get('/privacy-shield', async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query(
            'SELECT privacy_shield_enabled FROM users WHERE user_id = $1',
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ privacy_shield_enabled: result.rows[0].privacy_shield_enabled });
    } catch (error) {
        console.error('[PrivacyShield] GET error:', error);
        res.status(500).json({ error: 'Failed to fetch privacy shield state' });
    }
});

/**
 * POST /api/user/privacy-shield/enable
 * Enable privacy shield — no password required (adding privacy is always safe).
 */
router.post('/privacy-shield/enable', async (req, res) => {
    try {
        const userId = req.user.userId;
        await pool.query(
            'UPDATE users SET privacy_shield_enabled = TRUE WHERE user_id = $1',
            [userId]
        );
        res.json({ success: true, privacy_shield_enabled: true });
    } catch (error) {
        console.error('[PrivacyShield] ENABLE error:', error);
        res.status(500).json({ error: 'Failed to enable privacy shield' });
    }
});

/**
 * POST /api/user/privacy-shield/disable
 * Disable privacy shield — requires the user's login password to confirm.
 * Google OAuth users (no password_hash) are allowed without verification (demo gap noted).
 */
router.post('/privacy-shield/disable', async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.userId;

        // Fetch stored password hash
        const userRes = await pool.query(
            'SELECT password_hash FROM users WHERE user_id = $1',
            [userId]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const storedHash = userRes.rows[0].password_hash;

        // If the user has a password hash, verify it
        if (storedHash) {
            if (!password) {
                return res.status(400).json({ error: 'Password required to disable privacy shield' });
            }
            const valid = await bcrypt.compare(password, storedHash);
            if (!valid) {
                return res.status(401).json({ error: 'Incorrect password' });
            }
        }
        // Google OAuth users have no password_hash — allow without verification (production gap)

        await pool.query(
            'UPDATE users SET privacy_shield_enabled = FALSE WHERE user_id = $1',
            [userId]
        );
        res.json({ success: true, privacy_shield_enabled: false });
    } catch (error) {
        console.error('[PrivacyShield] DISABLE error:', error);
        res.status(500).json({ error: 'Failed to disable privacy shield' });
    }
});

module.exports = router;
