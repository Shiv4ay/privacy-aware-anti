const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/orgs
 * List all organizations (super admin only)
 */
router.get('/', async (req, res) => {
    try {
        // Only super admin can list all orgs
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Super admin access required' });
        }

        const result = await pool.query(`
            SELECT id, name, type, domain, created_at
            FROM organizations
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            organizations: result.rows
        });

    } catch (error) {
        console.error('[Orgs] List error:', error);
        res.status(500).json({ error: 'Failed to list organizations' });
    }
});

/**
 * POST /api/orgs/create
 * Create a new organization (super admin only)
 */
router.post('/create', async (req, res) => {
    try {
        // Only super admin can create orgs
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Super admin access required' });
        }

        const { name, type, domain } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Organization name is required' });
        }

        // Check if org with this name already exists
        const existing = await pool.query(
            'SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)',
            [name]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Organization with this name already exists' });
        }

        // Create organization
        const result = await pool.query(`
            INSERT INTO organizations (name, type, domain, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, name, type, domain, created_at
        `, [name, type || null, domain || null]);

        const newOrg = result.rows[0];

        console.log(`[Orgs] Created organization: ${newOrg.name} (ID: ${newOrg.id})`);

        res.json({
            success: true,
            organization: newOrg,
            message: `Organization "${newOrg.name}" created successfully`
        });

    } catch (error) {
        console.error('[Orgs] Create error:', error);
        res.status(500).json({ error: 'Failed to create organization' });
    }
});

/**
 * POST /api/orgs/delete/:id
 * Delete an organization (super admin only)
 * WARNING: This will delete all associated data!
 */
router.post('/delete/:id', async (req, res) => {
    try {
        // Only super admin can delete orgs
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Super admin access required' });
        }

        const orgId = parseInt(req.params.id);

        if (isNaN(orgId)) {
            return res.status(400).json({ error: 'Invalid organization ID' });
        }

        // Check if org exists
        const org = await pool.query(
            'SELECT name FROM organizations WHERE id = $1',
            [orgId]
        );

        if (org.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const orgName = org.rows[0].name;

        // Delete organization (cascade will handle related data)
        await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);

        console.log(`[Orgs] Deleted organization: ${orgName} (ID: ${orgId})`);

        res.json({
            success: true,
            message: `Organization "${orgName}" deleted successfully`
        });

    } catch (error) {
        console.error('[Orgs] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete organization' });
    }
});

/**
 * GET /api/orgs/me
 * Get current user's organization details
 */
router.get('/me', async (req, res) => {
    try {
        if (!req.user.org_id) {
            return res.status(404).json({ error: 'User does not belong to an organization' });
        }

        const result = await pool.query(
            'SELECT id, name, type, domain, created_at FROM organizations WHERE id = $1',
            [req.user.org_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Get member count
        const countRes = await pool.query(
            'SELECT COUNT(*) as count FROM users WHERE org_id = $1',
            [req.user.org_id]
        );

        const org = result.rows[0];
        org.member_count = parseInt(countRes.rows[0].count);

        res.json({ success: true, organization: org });
    } catch (error) {
        console.error('[Orgs] Get Me Error:', error);
        res.status(500).json({ error: 'Failed to fetch organization details' });
    }
});

/**
 * PUT /api/orgs/me
 * Update current user's organization details (Admin only)
 */
router.put('/me', async (req, res) => {
    try {
        if (!req.user.org_id) {
            return res.status(400).json({ error: 'No organization to update' });
        }

        // Only Admin or Super Admin can update org details
        if (!['admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied: Admin only' });
        }

        const { name, domain } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Organization name is required' });
        }

        const result = await pool.query(
            `UPDATE organizations 
             SET name = $1, domain = $2
             WHERE id = $3
             RETURNING id, name, type, domain, created_at`,
            [name, domain, req.user.org_id]
        );

        res.json({
            success: true,
            organization: result.rows[0],
            message: 'Organization updated successfully'
        });

    } catch (error) {
        console.error('[Orgs] Update Me Error:', error);
        res.status(500).json({ error: 'Failed to update organization' });
    }
});

module.exports = router;
