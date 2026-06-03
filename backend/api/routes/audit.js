const express = require('express');
const router = express.Router();

/**
 * GET /api/audit/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const db = req.db;
        const orgId = req.user.org_id;
        const isSuperAdmin = req.user.role === 'super_admin';

        let joinClause = '';
        let whereClause = "WHERE a.action IN ('search', 'chat', 'jailbreak_attempt', 'privacy_violation')";
        let piiWhereClause = "WHERE a.details->>'pii_detected' = 'true'";
        const params = [];

        if (!isSuperAdmin) {
            joinClause = 'JOIN users u ON a.user_id = u.user_id JOIN user_org_mapping m ON u.user_id = m.user_id';
            whereClause += ' AND m.org_id = $1';
            piiWhereClause += ' AND m.org_id = $1';
            params.push(orgId);
        }

        const [totalRes, blockedRes, piiRes, jailbreakRes, privacyRes] = await Promise.all([
            db.query(`SELECT COUNT(*) FROM audit_logs a ${joinClause} ${whereClause}`, params),
            db.query(`SELECT COUNT(*) FROM audit_logs a ${joinClause} ${whereClause} AND a.details->>'success' = 'false'`, params),
            db.query(`SELECT COUNT(*) FROM audit_logs a ${joinClause} ${piiWhereClause}`, params),
            db.query(`SELECT COUNT(*) FROM audit_logs a ${joinClause} ${whereClause} AND a.action = 'jailbreak_attempt'`, params),
            db.query(`SELECT COUNT(*) FROM audit_logs a ${joinClause} ${whereClause} AND a.action = 'privacy_violation'`, params),
        ]);

        const total = parseInt(totalRes.rows[0].count) || 1;
        const blocked = parseInt(blockedRes.rows[0].count) || 0;
        const score = Math.max(0, 100 - ((blocked / total) * 100)).toFixed(1);

        res.json({
            stats: {
                totalQueries: parseInt(totalRes.rows[0].count),
                blockedQueries: parseInt(blockedRes.rows[0].count),
                jailbreakAttempts: parseInt(jailbreakRes.rows[0].count),
                privacyViolations: parseInt(privacyRes.rows[0].count),
                piiRedacted: parseInt(piiRes.rows[0].count),
                privacyScore: parseFloat(score)
            }
        });
    } catch (err) {
        console.error('Audit Stats Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch security stats', details: err.message });
    }
});

/**
 * GET /api/audit/logs
 */
router.get('/logs', async (req, res) => {
    try {
        const db = req.db;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const orgId = req.user.org_id;
        const isSuperAdmin = req.user.role === 'super_admin';

        const { status, pii } = req.query;
        const conditions = [];
        const params = [limit, offset];
        let pIdx = 3;

        if (!isSuperAdmin) {
            conditions.push(`m.org_id = $${pIdx++}`);
            params.push(orgId);
        }

        if (status === 'allowed') conditions.push(`(a.details->>'success' IS NULL OR a.details->>'success' != 'false')`);
        if (status === 'blocked') conditions.push(`a.details->>'success' = 'false'`);
        if (status === 'privacy') conditions.push(`a.action = 'privacy_violation'`);
        if (pii === 'true') conditions.push(`a.details->>'pii_detected' = 'true'`);

        const whereClause = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        const logsRes = await db.query(`
            SELECT
                a.id,
                a.user_id,
                a.action,
                a.resource_type,
                a.created_at,
                a.ip_address,
                a.details                                                   AS metadata,
                CASE WHEN a.details->>'success' = 'false'
                     THEN false ELSE true END                               AS success,
                COALESCE(u.username, 'System Agent')                        AS username,
                u.email,
                ur.name                                                     AS role
            FROM  audit_logs  a
            LEFT  JOIN users      u  ON a.user_id  = u.user_id
            LEFT  JOIN user_roles ur ON u.role_id   = ur.id
            LEFT  JOIN user_org_mapping m ON u.user_id = m.user_id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT  $1 OFFSET $2
        `, params);

        // Adjust params for count query (remove limit and offset)
        const countParams = params.slice(2);
        // Adjust the placeholders in whereClause incrementally since the first two (limit, offset) are dropped
        // Actually, easiest way is to rebuild conditions for Count with starting index 1
        const countConditions = [];
        let cpIdx = 1;
        const cleanCountParams = [];

        if (!isSuperAdmin) {
            countConditions.push(`m.org_id = $${cpIdx++}`);
            cleanCountParams.push(orgId);
        }
        if (status === 'allowed') countConditions.push(`(a.details->>'success' IS NULL OR a.details->>'success' != 'false')`);
        if (status === 'blocked') countConditions.push(`a.details->>'success' = 'false'`);
        if (status === 'privacy') countConditions.push(`a.action = 'privacy_violation'`);
        if (pii === 'true') countConditions.push(`a.details->>'pii_detected' = 'true'`);

        const countWhereClause = countConditions.length > 0 ? 'WHERE ' + countConditions.join(' AND ') : '';

        const countRes = await db.query(
            `SELECT COUNT(*) FROM audit_logs a LEFT JOIN users u ON a.user_id = u.user_id LEFT JOIN user_org_mapping m ON u.user_id = m.user_id ${countWhereClause}`, cleanCountParams
        );
        const total = parseInt(countRes.rows[0].count) || 0;

        res.json({
            logs: logsRes.rows,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error('Audit Logs Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch audit logs', details: err.message });
    }
});

/**
 * GET /api/audit/timeline
 * 7-day hourly query volume for charts
 */
router.get('/timeline', async (req, res) => {
    try {
        const db = req.db;
        const isSuperAdmin = req.user.role === 'super_admin';
        const orgId = req.user.org_id;
        const days = Math.min(30, parseInt(req.query.days) || 7);

        let joinClause = 'LEFT JOIN users u ON a.user_id = u.user_id LEFT JOIN user_org_mapping m ON u.user_id = m.user_id';
        let whereClause = `WHERE a.created_at >= NOW() - INTERVAL '${days} days'`;
        const params = [];

        if (!isSuperAdmin) {
            whereClause += ` AND m.org_id = $1`;
            params.push(orgId);
        }

        const [queryVol, actionDist] = await Promise.all([
            db.query(`
                SELECT
                    date_trunc('day', a.created_at) AS day,
                    COUNT(*) FILTER (WHERE a.action IN ('chat','search')) AS queries,
                    COUNT(*) FILTER (WHERE a.details->>'success' = 'false') AS blocked,
                    COUNT(*) FILTER (WHERE a.action = 'jailbreak_attempt') AS jailbreaks
                FROM audit_logs a
                ${joinClause}
                ${whereClause}
                GROUP BY day
                ORDER BY day ASC
            `, params),
            db.query(`
                SELECT a.action, COUNT(*)::int AS count
                FROM audit_logs a
                ${joinClause}
                ${whereClause}
                GROUP BY a.action
                ORDER BY count DESC
                LIMIT 10
            `, params),
        ]);

        res.json({
            timeline: queryVol.rows.map(r => ({
                day: r.day,
                queries: parseInt(r.queries) || 0,
                blocked: parseInt(r.blocked) || 0,
                jailbreaks: parseInt(r.jailbreaks) || 0,
            })),
            actionDistribution: actionDist.rows,
        });
    } catch (err) {
        console.error('Audit Timeline Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch timeline', details: err.message });
    }
});

/**
 * GET /api/audit/export
 * Download audit logs as CSV
 */
router.get('/export', async (req, res) => {
    try {
        const db = req.db;
        const isSuperAdmin = req.user.role === 'super_admin';
        const orgId = req.user.org_id;
        const { status, action, days = 7 } = req.query;

        const conditions = [`a.created_at >= NOW() - INTERVAL '${Math.min(90, parseInt(days))} days'`];
        const params = [];
        let pIdx = 1;

        if (!isSuperAdmin) {
            conditions.push(`m.org_id = $${pIdx++}`);
            params.push(orgId);
        }
        if (status === 'blocked') conditions.push(`a.details->>'success' = 'false'`);
        if (action) { conditions.push(`a.action = $${pIdx++}`); params.push(action); }

        const whereClause = 'WHERE ' + conditions.join(' AND ');

        const result = await db.query(`
            SELECT
                a.created_at,
                COALESCE(u.username, a.user_id, 'system') AS user,
                u.email,
                a.action,
                a.resource_type,
                a.ip_address,
                CASE WHEN a.details->>'success' = 'false' THEN 'BLOCKED' ELSE 'ALLOWED' END AS status,
                a.details->>'pii_detected' AS pii_detected
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.user_id
            LEFT JOIN user_org_mapping m ON u.user_id = m.user_id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT 5000
        `, params);

        const header = ['timestamp', 'user', 'email', 'action', 'resource', 'ip', 'status', 'pii_detected'];
        const rows = result.rows.map(r => [
            new Date(r.created_at).toISOString(),
            r.user || '',
            r.email || '',
            r.action || '',
            r.resource_type || '',
            r.ip_address || '',
            r.status || '',
            r.pii_detected || 'false',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

        const csv = [header.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-${Date.now()}.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Audit Export Error:', err.message);
        res.status(500).json({ error: 'Failed to export audit logs', details: err.message });
    }
});

module.exports = router;
