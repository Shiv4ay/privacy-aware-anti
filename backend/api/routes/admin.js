const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware to ensure user is Admin or Super Admin
const requireAdmin = (req, res, next) => {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied: Admin only' });
    }
    next();
};

// Create User in own Org
// Note: Authentication is handled at mount level in index.js via authenticateJWT
router.post('/users/create', requireAdmin, async (req, res) => {
    const { name, email, password, department, user_category } = req.body;
    const org_id = req.user.org_id;

    if (!org_id) {
        return res.status(400).json({ error: 'Admin must belong to an organization' });
    }

    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, name, org_id, role, department, user_category) 
             VALUES ($1, $2, $3, $4, $5, 'user', $6, $7) RETURNING id, email, name, role`,
            [email.split('@')[0], email, passwordHash, name, org_id, department, user_category]
        );

        res.status(201).json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({ error: 'Failed to create user', details: error.message });
    }
});

// List Users in own Org
router.get('/users', requireAdmin, async (req, res) => {
    const org_id = req.user.org_id;
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, department, user_category, is_active FROM users WHERE org_id = $1 ORDER BY created_at DESC',
            [org_id]
        );
        res.json({ success: true, users: result.rows });
    } catch (error) {
        console.error('List Users Error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

module.exports = router;
