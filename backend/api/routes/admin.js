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

    // If super admin has no org_id, return empty list (they should use super admin dashboard)
    if (!org_id) {
        return res.json({ success: true, users: [] });
    }

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

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', requireAdmin, async (req, res) => {
    const org_id = req.user.org_id;

    // If no org_id (super admin), return empty stats
    if (!org_id) {
        return res.json({
            success: true,
            stats: {
                totalDocuments: 0,
                totalUsers: 0,
                organizationName: 'No Organization',
                dataSourcesCount: 0,
                recentUploads: 0,
                dataSources: []
            }
        });
    }

    try {
        // Get total documents for this organization
        const docsResult = await pool.query(
            'SELECT COUNT(*) as total FROM documents WHERE org_id = $1',
            [org_id]
        );

        // Get total users in organization
        const usersResult = await pool.query(
            'SELECT COUNT(*) as total FROM users WHERE org_id = $1',
            [org_id]
        );

        // Get document count by filename (data sources)
        const filesResult = await pool.query(
            'SELECT filename, COUNT(*) as count FROM documents WHERE org_id = $1 GROUP BY filename ORDER BY count DESC',
            [org_id]
        );

        // Get recent upload count (last 24 hours)
        const recentResult = await pool.query(
            `SELECT COUNT(DISTINCT filename) as recent_uploads 
             FROM documents 
             WHERE org_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
            [org_id]
        );

        // Get organization name
        const orgResult = await pool.query(
            'SELECT name FROM organizations WHERE id = $1',
            [org_id]
        );

        res.json({
            success: true,
            stats: {
                totalDocuments: parseInt(docsResult.rows[0].total),
                totalUsers: parseInt(usersResult.rows[0].total),
                organizationName: orgResult.rows[0]?.name || 'Unknown',
                dataSourcesCount: filesResult.rows.length,
                recentUploads: parseInt(recentResult.rows[0].recent_uploads),
                dataSources: filesResult.rows
            }
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/admin/uploads - Recent upload history
router.get('/uploads', requireAdmin, async (req, res) => {
    const org_id = req.user.org_id;

    // If no org_id, return empty array
    if (!org_id) {
        return res.json({ success: true, uploads: [] });
    }

    try {
        // Get distinct uploads grouped by filename with latest timestamp
        const result = await pool.query(
            `SELECT 
                filename,
                COUNT(*) as document_count,
                MAX(created_at) as uploaded_at,
                MIN(id) as first_id
             FROM documents 
             WHERE org_id = $1 
             GROUP BY filename 
             ORDER BY uploaded_at DESC 
             LIMIT 10`,
            [org_id]
        );

        res.json({
            success: true,
            uploads: result.rows
        });
    } catch (error) {
        console.error('Uploads Error:', error);
        res.status(500).json({ error: 'Failed to fetch uploads' });
    }
});

// GET /api/admin/documents - List documents with pagination and filtering
router.get('/documents', requireAdmin, async (req, res) => {
    const org_id = req.user.org_id;

    if (!org_id) {
        return res.json({ success: true, documents: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 0 } });
    }

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const filename = req.query.filename || null;
        const search = req.query.search || null;
        const sortBy = req.query.sortBy || 'created_at';
        const sortOrder = req.query.sortOrder || 'DESC';

        // Build WHERE clause
        let whereClause = 'WHERE org_id = $1';
        const params = [org_id];
        let paramIndex = 2;

        if (filename) {
            whereClause += ` AND filename = $${paramIndex}`;
            params.push(filename);
            paramIndex++;
        }

        if (search) {
            whereClause += ` AND (metadata::text ILIKE $${paramIndex} OR filename ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM documents ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        // Get documents
        const validSortColumns = ['created_at', 'filename', 'file_size', 'id'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        params.push(limit, offset);
        const docsResult = await pool.query(
            `SELECT 
                id, 
                filename, 
                file_key,
                metadata,
                created_at,
                file_size,
                status
             FROM documents 
             ${whereClause}
             ORDER BY ${sortColumn} ${order}
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            params
        );

        res.json({
            success: true,
            documents: docsResult.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (error) {
        console.error('List Documents Error:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

// GET /api/admin/documents/stats - Detailed file statistics
router.get('/documents/stats', requireAdmin, async (req, res) => {
    const org_id = req.user.org_id;

    if (!org_id) {
        return res.json({ success: true, fileStats: [], overallStats: { totalDocuments: 0, totalFiles: 0 } });
    }

    try {
        // Get per-file statistics
        const fileStatsResult = await pool.query(
            `SELECT 
                filename,
                COUNT(*) as count,
                MIN(created_at) as first_upload,
                MAX(created_at) as last_upload,
                AVG(file_size) as avg_size,
                SUM(file_size) as total_size
             FROM documents
             WHERE org_id = $1
             GROUP BY filename
             ORDER BY count DESC`,
            [org_id]
        );

        // Get overall statistics
        const overallResult = await pool.query(
            `SELECT 
                COUNT(*) as total_documents,
                COUNT(DISTINCT filename) as total_files,
                MIN(created_at) as earliest_upload,
                MAX(created_at) as latest_upload,
                SUM(file_size) as total_storage
             FROM documents
             WHERE org_id = $1`,
            [org_id]
        );

        res.json({
            success: true,
            fileStats: fileStatsResult.rows,
            overallStats: overallResult.rows[0]
        });
    } catch (error) {
        console.error('Documents Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch document statistics' });
    }
});

module.exports = router;

