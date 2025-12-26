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
    if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied: Admin only' });
    }
    next();
};

// Create User
router.post('/users/create', requireAdmin, async (req, res) => {
    const { name, email, password, department, user_category, org_id: targetOrgId } = req.body;

    // Determine target organization
    // If super_admin, can create for any org (passed in body), otherwise use own org
    let finalOrgId = req.user.org_id;
    if (req.user.role === 'super_admin') {
        finalOrgId = targetOrgId || req.user.org_id; // Optional: allow creating global admins if no org
    }

    // Validation: Standard admins must have an org
    if (req.user.role === 'admin' && !finalOrgId) {
        return res.status(400).json({ error: 'Admin must belongs to an organization' });
    }

    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, org_id, role, department, user_category, is_active) 
             VALUES ($1, $2, $3, $4, 'user', $5, $6, true) RETURNING id, email, username, role`,
            [email.split('@')[0], email, passwordHash, finalOrgId, department, user_category]
        );

        res.status(201).json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({ error: 'Failed to create user', details: error.message });
    }
});

// List Users
router.get('/users', requireAdmin, async (req, res) => {
    let query = 'SELECT id, username as name, email, role, department, user_category, is_active, org_id FROM users';
    let params = [];

    // Filter by Org if not Super Admin
    if (req.user.role !== 'super_admin') {
        query += ' WHERE org_id = $1';
        params.push(req.user.org_id);
    }

    query += ' ORDER BY created_at DESC';

    try {
        const result = await pool.query(query, params);
        res.json({ success: true, users: result.rows });
    } catch (error) {
        console.error('List Users Error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', requireAdmin, async (req, res) => {
    const isSuperAdmin = req.user.role === 'super_admin';
    const org_id = req.user.org_id;

    try {
        let docsQuery = 'SELECT COUNT(*) as total FROM documents';
        let usersQuery = 'SELECT COUNT(*) as total FROM users';
        let filesQuery = 'SELECT filename, COUNT(*) as count FROM documents';
        let recentQuery = `SELECT COUNT(DISTINCT filename) as recent_uploads FROM documents WHERE created_at > NOW() - INTERVAL '24 hours'`;

        const params = [];

        if (!isSuperAdmin) {
            const clause = ' WHERE org_id = $1';
            docsQuery += clause;
            usersQuery += clause;
            filesQuery += clause;
            recentQuery = `SELECT COUNT(DISTINCT filename) as recent_uploads FROM documents WHERE org_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`;
            params.push(org_id);
        }

        filesQuery += ' GROUP BY filename ORDER BY count DESC LIMIT 10';

        const [docsResult, usersResult, recentResult, filesResult] = await Promise.all([
            pool.query(docsQuery, params),
            pool.query(usersQuery, params),
            pool.query(recentQuery, params),
            pool.query(filesQuery, params)
        ]);

        let orgName = 'Global Overview';
        if (!isSuperAdmin && org_id) {
            const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [org_id]);
            orgName = orgResult.rows[0]?.name || 'Unknown Org';
        }

        res.json({
            success: true,
            stats: {
                totalDocuments: parseInt(docsResult.rows[0]?.total || 0),
                totalUsers: parseInt(usersResult.rows[0]?.total || 0),
                organizationName: orgName,
                dataSourcesCount: filesResult.rows.length,
                recentUploads: parseInt(recentResult.rows[0]?.recent_uploads || 0),
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
    try {
        let query = `
            SELECT 
                filename,
                COUNT(*) as document_count,
                MAX(created_at) as uploaded_at,
                MIN(id) as first_id
             FROM documents 
        `;
        const params = [];

        if (req.user.role !== 'super_admin') {
            query += ' WHERE org_id = $1';
            params.push(req.user.org_id);
        }

        query += `
             GROUP BY filename 
             ORDER BY uploaded_at DESC 
             LIMIT 10
        `;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            uploads: result.rows
        });
    } catch (error) {
        console.error('Uploads Error:', error);
        res.status(500).json({ error: 'Failed to fetch uploads' });
    }
});

// GET /api/admin/documents/stats - Specific stats for documents page
// ALLOWED for all users (view restricted to own org)
router.get('/documents/stats', async (req, res) => {
    try {
        const params = [];
        let whereClause = '';

        // 1. Overall Stats
        let pIdx = 1;

        if (req.user.role !== 'super_admin') {
            whereClause = 'WHERE org_id = $1';
            params.push(req.user.org_id);
            pIdx++;

            // DATA INTEGRITY: Filter out raw data rows for stats/dropdowns
            // Only apply this to 'user' or 'student' roles. 'admin' should see everything in their org.
            if (req.user.role !== 'admin') {
                const hiddenTypes = ['attendance', 'results', 'users', 'students', 'alumni', 'companies'];
                const placeholders = hiddenTypes.map((_, i) => `$${pIdx + i}`).join(', ');
                hiddenTypes.forEach(type => params.push(type));
                whereClause += ` AND (metadata->>'record_type' IS NULL OR metadata->>'record_type' NOT IN (${placeholders}))`;
                pIdx += hiddenTypes.length;
            }

            // DEPARTMENT SCOPE
            if (req.user.department) {
                whereClause += ` AND (metadata->>'Department' IS NULL OR metadata->>'Department' = $${pIdx++})`;
                params.push(req.user.department);
            }
        }

        const overallQuery = `
            SELECT 
                COUNT(*) as total_documents,
                COUNT(DISTINCT filename) as total_files,
                COALESCE(SUM(file_size), 0) as total_storage,
                MAX(created_at) as latest_upload
            FROM documents
            ${whereClause}
        `;

        // 2. Stats per File (for filter dropdown)
        const fileStatsQuery = `
            SELECT 
                filename, 
                COUNT(*) as count
            FROM documents
            ${whereClause}
            GROUP BY filename
            ORDER BY count DESC
        `;

        const [overallRes, fileStatsRes] = await Promise.all([
            pool.query(overallQuery, params),
            pool.query(fileStatsQuery, params)
        ]);

        res.json({
            success: true,
            overallStats: {
                total_documents: parseInt(overallRes.rows[0].total_documents),
                total_files: parseInt(overallRes.rows[0].total_files),
                total_storage: parseInt(overallRes.rows[0].total_storage),
                latest_upload: overallRes.rows[0].latest_upload
            },
            fileStats: fileStatsRes.rows
        });

    } catch (error) {
        console.error('Doc Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch document stats' });
    }
});

// GET /api/admin/documents - List documents
// ALLOWED for all users (view restricted to own org)
router.get('/documents', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const { filename, search, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

        // Validate Sort
        const allowedSorts = ['id', 'filename', 'created_at', 'status', 'file_size'];
        const validSort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
        const validOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let whereClauses = [];
        let params = [];
        let pIdx = 1;

        if (req.user.role !== 'super_admin') {
            whereClauses.push(`org_id = $${pIdx++}`);
            params.push(req.user.org_id);

            // DATA INTEGRITY: Filter out raw data rows for standard users
            // Students/Faculty should only see "Resources" (Courses, Dept info, Placements), not raw DB rows
            // DATA INTEGRITY: Filter out raw data rows for standard users
            // Students/Faculty should only see "Resources" (Courses, Dept info, Placements), not raw DB rows
            // Admin should see EVERYTHING.
            if (req.user.role !== 'admin') {
                const hiddenTypes = ['attendance', 'results', 'users', 'students', 'alumni', 'companies'];
                // We use JSON containment to check if record_type is in the forbidden list
                // Postgres JSONB query: metadata->>'record_type' NOT IN (...)

                // Construct the NOT IN clause dynamically
                const placeholders = hiddenTypes.map((_, i) => `$${pIdx + i}`).join(', ');
                hiddenTypes.forEach(type => params.push(type));
                whereClauses.push(`(metadata->>'record_type' IS NULL OR metadata->>'record_type' NOT IN (${placeholders}))`);
                pIdx += hiddenTypes.length;
            }

            // DEPARTMENT SCOPE: If user belongs to a department, prioritize their department's data
            // (Optional: currently we enforce checking if the doc has a department tagline, it must match)
            if (req.user.department) {
                // Show general documents (no dept) OR documents matching user's department
                whereClauses.push(`(metadata->>'Department' IS NULL OR metadata->>'Department' = $${pIdx++})`);
                params.push(req.user.department);
            }
        }

        if (filename) {
            whereClauses.push(`filename = $${pIdx++}`);
            params.push(filename);
        }

        if (search) {
            whereClauses.push(`(metadata::text ILIKE $${pIdx} OR filename ILIKE $${pIdx})`);
            params.push(`%${search}%`);
            pIdx++;
        }

        const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countRes = await pool.query(`SELECT COUNT(*) as total FROM documents ${whereStr}`, params);
        const total = parseInt(countRes.rows[0].total);

        // Fetch Data
        params.push(limit, offset);
        const query = `
            SELECT id, filename, created_at, file_size, status, metadata
            FROM documents
            ${whereStr}
            ORDER BY ${validSort} ${validOrder}
            LIMIT $${pIdx} OFFSET $${pIdx + 1}
        `;

        const docsRes = await pool.query(query, params);

        res.json({
            success: true,
            documents: docsRes.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('List Docs Error:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

module.exports = router;
