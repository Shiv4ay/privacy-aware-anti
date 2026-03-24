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

module.exports = router;
