const express = require('express');
const router = express.Router();

/**
 * GET /api/audit/stats
 * Real-time security metrics
 */
router.get('/stats', async (req, res) => {
    try {
        const { organizationId } = req.query;
        // Base query conditions
        let whereClause = '';
        let params = [];

        if (organizationId) {
            // If we had org_id in audit_log or joined with users, we'd filter here.
            // For now, simpler implementation or join users if needed.
            // Assuming basic system-wide stats if super_admin, or filter by user's actions if regular admin?
            // Let's stick to system-wide for Super Admin, and maybe implemented later for Org Admin.
        }

        // 1. Total Queries (actions='search' or 'chat')
        const totalQueries = await req.db.query(
            "SELECT COUNT(*) FROM audit_log WHERE action IN ('search', 'chat')"
        );

        // 2. Blocked Queries (success=false AND action IN ('search', 'chat'))
        const blockedQueries = await req.db.query(
            "SELECT COUNT(*) FROM audit_log WHERE action IN ('search', 'chat') AND success = FALSE"
        );

        // 3. PII Redacted (count where metadata->>'pii_detected' is true or not null)
        // Adjust based on actual metadata structure. Assuming metadata has { "pii_detected": true } or similar.
        const piiRedacted = await req.db.query(
            "SELECT COUNT(*) FROM audit_log WHERE metadata->>'pii_detected' = 'true'"
        );

        // 4. Privacy Score (Mock calculation for now, or derived from % allowed vs blocked)
        const total = parseInt(totalQueries.rows[0].count) || 1;
        const blocked = parseInt(blockedQueries.rows[0].count) || 0;
        const score = Math.max(0, 100 - ((blocked / total) * 100)).toFixed(1);

        res.json({
            stats: {
                totalQueries: parseInt(totalQueries.rows[0].count),
                blockedQueries: parseInt(blockedQueries.rows[0].count),
                piiRedacted: parseInt(piiRedacted.rows[0].count),
                privacyScore: parseFloat(score)
            }
        });
    } catch (error) {
        console.error('Audit Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch security stats' });
    }
});

/**
 * GET /api/audit/logs
 * Paginated access logs
 */
router.get('/logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const { status, pii } = req.query;
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (status === 'allowed') {
            whereConditions.push(`a.success = TRUE`);
        } else if (status === 'blocked') {
            whereConditions.push(`a.success = FALSE`);
        }

        if (pii === 'true') {
            whereConditions.push(`a.metadata->>'pii_detected' = 'true'`);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // pagination params
        params.push(limit); // $1
        params.push(offset); // $2

        // Adjust params indexing for the main query if we had strict param usage, 
        // but here the WHERE clause is literal string injection for conditions (safe internal values) 
        // or we could use parameterized queries for status/pii if they were user inputs. 
        // Since status/pii are controlled enums effectively, we'll keep it simple for now but using params is better.
        // Let's stick to the previous pattern but insert the WHERE clause.

        const query = `
            SELECT a.id, a.action, a.resource_type, a.created_at, a.success, a.error_message, a.metadata,
                   u.username, u.email, u.role
            FROM audit_log a
            LEFT JOIN users u ON a.user_id = u.user_id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await req.db.query(query, [limit, offset]);
        const countResult = await req.db.query(`SELECT COUNT(*) FROM audit_log a ${whereClause}`);

        res.json({
            logs: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page,
                limit,
                pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            }
        });
    } catch (error) {
        console.error('Audit Logs Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

module.exports = router;
