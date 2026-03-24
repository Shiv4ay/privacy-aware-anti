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

        // Calculate processing counts
        let procQuery = "SELECT status, COUNT(*) as count FROM documents";
        if (!isSuperAdmin) procQuery += " WHERE org_id = $1";
        procQuery += " GROUP BY status";
        const procRes = await pool.query(procQuery, params);
        const procStats = { processed: 0, pending: 0 };
        procRes.rows.forEach(r => {
            if (r.status === 'processed') procStats.processed = parseInt(r.count);
            else procStats.pending += parseInt(r.count);
        });

        let orgName = 'Global Overview';
        if (!isSuperAdmin && org_id) {
            const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [org_id]);
            orgName = orgResult.rows[0]?.name || 'Unknown Org';
        }

        res.json({
            success: true,
            stats: {
                totalDocuments: parseInt(docsResult.rows[0]?.total || 0),
                processedDocuments: procStats.processed,
                pendingDocuments: procStats.pending,
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

// GET /api/admin/threats - Recent security threats and jailbreak attempts
router.get('/threats', requireAdmin, async (req, res) => {
    try {
        const isSuperAdmin = req.user.role === 'super_admin';
        const orgId = req.user.org_id;

        let query = `
            SELECT 
                al.id,
                al.created_at as time,
                al.user_id,
                u.username,
                u.email,
                al.action,
                al.details,
                al.details->>'error_message' as error_message
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.user_id
            WHERE al.action IN ('jailbreak_attempt', 'privacy_violation')
        `;
        const params = [];

        if (!isSuperAdmin) {
            query += ' AND u.org_id = $1';
            params.push(orgId);
        }

        query += ' ORDER BY al.created_at DESC LIMIT 50';

        const result = await pool.query(query, params);
        res.json({ success: true, threats: result.rows });
    } catch (error) {
        console.error('Threats Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch threats' });
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
                MIN(id) as first_id,
                BOOL_OR(is_toxic) as has_toxic_content
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

// PUT /api/admin/users/:id/reactivate - Manually unblock a suspended user
router.put('/users/:id/reactivate', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        // Verify the admin has permission to modify this user
        if (req.user.role !== 'super_admin') {
            const userCheck = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0 || userCheck.rows[0].org_id !== req.user.org_id) {
                return res.status(403).json({ error: 'Access denied: User belongs to a different organization' });
            }
        }

        // Reactivate the user and reset their failed attempts/locks
        await pool.query(
            'UPDATE users SET is_active = TRUE, failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
            [userId]
        );

        // Audit log
        await pool.query(
            `INSERT INTO audit_log (user_id, action, resource_type, resource_id, success, error_message, ip_address, user_agent, metadata)
             VALUES ($1, 'admin_reactivate_user', 'users', $2, TRUE, 'User manually reactivated by Admin', $3, $4, $5)`,
            [req.user.id, userId, req.ip, req.get('User-Agent'), { admin_id: req.user.id }]
        );

        res.json({ success: true, message: 'User successfully reactivated' });
    } catch (error) {
        console.error('Reactivate User Error:', error);
        res.status(500).json({ error: 'Failed to reactivate user' });
    }
});

// PUT /api/admin/users/:id/suspend - Manually suspend a user
router.put('/users/:id/suspend', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        // Protect super_admin from suspension by lower admins
        const targetUser = await pool.query('SELECT role, org_id FROM users WHERE id = $1', [userId]);
        if (targetUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        if (targetUser.rows[0].role === 'super_admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Cannot suspend a super admin' });
        }

        if (req.user.role !== 'super_admin' && targetUser.rows[0].org_id !== req.user.org_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Suspend user and invalidate existing refresh tokens to force kill sessions
        const userRes = await pool.query('SELECT user_id FROM users WHERE id = $1', [userId]);
        const uuid = userRes.rows[0]?.user_id;

        await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [userId]);
        if (uuid) {
            await pool.query('UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1', [uuid]);
        }

        // Audit log
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address, user_agent, created_at)
             VALUES ($1, 'admin_suspend_user', 'users', $2, $3, $4, NOW())`,
            [req.user.user_id, JSON.stringify({ target_id: userId, message: 'User manually suspended by Admin' }), req.ip, req.get('User-Agent')]
        );

        res.json({ success: true, message: 'User successfully suspended' });
    } catch (error) {
        console.error('Suspend User Error:', error);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});


// ─────────────────────────────────────────────
// SUPER ADMIN EXCLUSIVE ENDPOINTS
// ─────────────────────────────────────────────
const requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Super Admin access required' });
    }
    next();
};

// PATCH /api/admin/users/:id/role — Change user role (super_admin only)
router.patch('/users/:id/role', requireSuperAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;
        const allowedRoles = ['user', 'student', 'faculty', 'researcher', 'admin', 'super_admin'];
        if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, email, role, org_id',
            [role, userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        // Invalidate sessions so new role takes effect on next login
        await pool.query('UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1', [userId]);

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address, user_agent, created_at)
             VALUES ($1, 'admin_role_change', 'users', $2, $3, $4, NOW())`,
            [req.user.id, JSON.stringify({ target_user_id: userId, new_role: role }), req.ip, req.get('User-Agent')]
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Role Change Error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// PATCH /api/admin/users/:id/status — toggle active/suspended
router.patch('/users/:id/status', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { is_active } = req.body;
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const targetUser = await pool.query('SELECT role, org_id FROM users WHERE id = $1', [userId]);
        if (targetUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        if (targetUser.rows[0].role === 'super_admin' && req.user.role !== 'super_admin')
            return res.status(403).json({ error: 'Cannot modify a super admin' });
        if (req.user.role !== 'super_admin' && targetUser.rows[0].org_id !== req.user.org_id)
            return res.status(403).json({ error: 'Access denied' });

        await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, userId]);
        if (!is_active) await pool.query('UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1', [userId]);

        res.json({ success: true, is_active });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// DELETE /api/admin/users/:id — Permanently delete user (super_admin only)
router.delete('/users/:id', requireSuperAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (userId === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
        await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// GET /api/admin/audit-logs — Paginated audit log explorer (super_admin)
router.get('/audit-logs', requireSuperAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;
        const action = req.query.action || null;
        const userId = req.query.user_id || null;
        const from = req.query.from || null;
        const to = req.query.to || null;

        const conditions = [];
        const params = [];
        let pIdx = 1;

        if (action) { conditions.push(`al.action = $${pIdx++}`); params.push(action); }
        if (userId) { conditions.push(`al.user_id = $${pIdx++}`); params.push(parseInt(userId)); }
        if (from) { conditions.push(`al.created_at >= $${pIdx++}`); params.push(new Date(from)); }
        if (to) { conditions.push(`al.created_at <= $${pIdx++}`); params.push(new Date(to)); }

        const whereStr = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countRes = await pool.query(`SELECT COUNT(*) as total FROM audit_logs al ${whereStr}`, params);
        const total = parseInt(countRes.rows[0].total);

        params.push(limit, offset);
        const logsRes = await pool.query(`
            SELECT al.id, al.created_at, al.action, al.resource_type, al.details,
                   al.ip_address, u.username, u.email, u.role,
                   o.name as org_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.user_id
            LEFT JOIN organizations o ON u.org_id = o.id
            ${whereStr}
            ORDER BY al.created_at DESC
            LIMIT $${pIdx} OFFSET $${pIdx + 1}
        `, params);

        res.json({ success: true, logs: logsRes.rows, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Audit Log Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// GET /api/admin/org-analytics — Per-org stats for analytics tab
router.get('/org-analytics', requireSuperAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                o.id, o.name, o.type, o.privacy_level,
                COUNT(DISTINCT u.id) as user_count,
                COUNT(DISTINCT d.id) as doc_count,
                COUNT(DISTINCT CASE WHEN d.is_toxic = TRUE THEN d.id END) as toxic_doc_count,
                COALESCE(SUM(d.file_size), 0) as storage_bytes,
                COUNT(DISTINCT CASE WHEN al.action = 'jailbreak_attempt' THEN al.id END) as threat_count,
                COUNT(DISTINCT CASE WHEN al.action IN ('chat','search') THEN al.id END) as query_count
            FROM organizations o
            LEFT JOIN users u ON u.org_id = o.id
            LEFT JOIN documents d ON d.org_id = o.id
            LEFT JOIN audit_logs al ON u.user_id = al.user_id
            GROUP BY o.id, o.name, o.type
            ORDER BY user_count DESC
        `);
        res.json({ success: true, orgs: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch org analytics' });
    }
});

// PATCH /api/admin/orgs/:id/privacy — Update org privacy level (admin or super_admin)
router.patch('/orgs/:id/privacy', async (req, res) => {
    try {
        const orgId = parseInt(req.params.id);
        const { privacy_level } = req.body;

        if (!['standard', 'strict'].includes(privacy_level)) {
            return res.status(400).json({ error: 'Invalid privacy level' });
        }

        // Authorization check: User must be super_admin, OR an admin of this specific org
        if (req.user.role !== 'super_admin' && (req.user.role !== 'admin' || parseInt(req.user.org_id) !== orgId)) {
            return res.status(403).json({ error: 'Forbidden. You can only manage privacy settings for your own organization.' });
        }

        const result = await pool.query(
            'UPDATE organizations SET privacy_level = $1 WHERE id = $2 RETURNING id, privacy_level',
            [privacy_level, orgId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Organization not found' });

        res.json({ success: true, privacy_level: result.rows[0].privacy_level });
    } catch (error) {
        console.error('Privacy update error:', error);
        res.status(500).json({ error: 'Failed to update privacy level' });
    }
});

module.exports = router;

