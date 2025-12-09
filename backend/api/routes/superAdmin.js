const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/authMiddleware');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware to ensure user is Super Admin
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied: Super Admin only' });
    }
    next();
};

// Create Organization
router.post('/create', authMiddleware, requireSuperAdmin, async (req, res) => {
    const { name, type, domain, logo } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Organization name is required' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO organizations (name, type, domain, logo) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, type, domain, logo]
        );
        res.status(201).json({ success: true, organization: result.rows[0] });
    } catch (error) {
        console.error('Create Org Error:', error);
        res.status(500).json({ error: 'Failed to create organization', details: error.message });
    }
});

// List Organizations
router.get('/', authMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM organizations ORDER BY created_at DESC');
        res.json({ success: true, organizations: result.rows });
    } catch (error) {
        console.error('List Orgs Error:', error);
        res.status(500).json({ error: 'Failed to list organizations' });
    }
});

// Delete Organization
router.post('/delete/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM organizations WHERE id = $1', [id]);
        res.json({ success: true, message: 'Organization deleted' });
    } catch (error) {
        console.error('Delete Org Error:', error);
        res.status(500).json({ error: 'Failed to delete organization' });
    }
});

// Create Admin for an Organization
router.post('/admin/create', authMiddleware, requireSuperAdmin, async (req, res) => {
    const { org_id, email, password, name } = req.body;
    // ... (Implementation similar to register but forcing org_id and role='admin')
    // For brevity, assuming this will be implemented fully or reusing register logic
    res.status(501).json({ error: 'Not implemented yet' });
});

module.exports = router;
