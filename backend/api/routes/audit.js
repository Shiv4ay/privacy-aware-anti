const express = require('express');
const router = express.Router();

/**
 * GET /api/audit/stats
 *
 * audit_logs columns: id, user_id, action, resource_type, resource_id,
 *                     details (JSONB), ip_address, user_agent, created_at
 * NOTE: There is NO top-level `success` column.
 */
router.get('/stats', async (req, res) => {
    try {
        const db = req.db;

        const [totalRes, blockedRes, piiRes] = await Promise.all([
            db.query("SELECT COUNT(*) FROM audit_logs WHERE action IN ('search','chat')"),
            db.query("SELECT COUNT(*) FROM audit_logs WHERE action IN ('search','chat') AND details->>'success' = 'false'"),
            db.query("SELECT COUNT(*) FROM audit_logs WHERE details->>'pii_detected' = 'true'"),
        ]);

        const total = parseInt(totalRes.rows[0].count) || 1;
        const blocked = parseInt(blockedRes.rows[0].count) || 0;
        const score = Math.max(0, 100 - ((blocked / total) * 100)).toFixed(1);

        res.json({
            stats: {
                totalQueries: parseInt(totalRes.rows[0].count),
                blockedQueries: parseInt(blockedRes.rows[0].count),
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
 *
 * Fully null-safe — derives success from details->>'success' string comparison
 * (no ::boolean cast which throws when value is absent or malformed).
 */
router.get('/logs', async (req, res) => {
    try {
        const db = req.db;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;

        const { status, pii } = req.query;
        const conditions = [];

        // Use string comparison — no ::boolean that blows up on NULL
        if (status === 'allowed') conditions.push(`(details->>'success' IS NULL OR details->>'success' != 'false')`);
        if (status === 'blocked') conditions.push(`details->>'success' = 'false'`);
        if (pii === 'true') conditions.push(`details->>'pii_detected' = 'true'`);

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
            LEFT  JOIN users      u  ON a.user_id  = u.id
            LEFT  JOIN user_roles ur ON u.role_id   = ur.id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT  $1 OFFSET $2
        `, [limit, offset]);

        const countRes = await db.query(
            `SELECT COUNT(*) FROM audit_logs a ${whereClause}`
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
