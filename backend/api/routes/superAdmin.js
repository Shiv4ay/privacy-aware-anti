const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { authMiddleware } = require('../middleware/authMiddleware');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware to ensure user is Super Admin
const requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'super_admin') {
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

    if (!email || !password || !org_id) {
        return res.status(400).json({ error: 'email, password, and org_id are required' });
    }

    const parsedOrgId = parseInt(org_id);
    if (isNaN(parsedOrgId)) {
        return res.status(400).json({ error: 'org_id must be a valid integer' });
    }

    try {
        // Verify org exists
        const orgCheck = await pool.query('SELECT id FROM organizations WHERE id = $1', [parsedOrgId]);
        if (orgCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Check for duplicate email
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'A user with this email already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);
        const displayName = name || email.split('@')[0];

        // Insert admin user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, name, role, org_id, is_active, created_at)
             VALUES ($1, $2, $3, 'admin', $4, true, NOW())
             RETURNING id, email, name, role, org_id, is_active, created_at`,
            [email, passwordHash, displayName, parsedOrgId]
        );
        const newAdmin = result.rows[0];

        // Audit log
        try {
            await pool.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address, user_agent, created_at)
                 VALUES ($1, 'super_admin_create_admin', 'user', $2, $3, $4, NOW())`,
                [req.user.user_id || req.user.id,
                 JSON.stringify({ new_admin_id: newAdmin.id, email: newAdmin.email, org_id: newAdmin.org_id }),
                 req.ip, req.get('User-Agent')]
            );
        } catch (auditErr) {
            console.error('Audit log error (non-fatal):', auditErr.message);
        }

        res.status(201).json({ success: true, user: newAdmin });
    } catch (error) {
        console.error('Create Admin Error:', error);
        res.status(500).json({ error: 'Failed to create admin account', details: error.message });
    }
});

module.exports = router;
