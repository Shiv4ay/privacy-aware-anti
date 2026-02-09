const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/authMiddleware');

/**
 * GET /api/notifications
 * Fetch recent priority notifications derived from audit logs
 */
router.get('/', authenticateJWT, async (req, res) => {
    try {
        const { userId, role } = req.user;

        // Fetch recent priority logs (blocks or PII detections)
        // If super_admin, show system alerts. If user, show personal alerts.
        let query = `
            SELECT id, action, resource_type, created_at, success, metadata
            FROM audit_log
            WHERE (success = FALSE OR metadata->>'pii_detected' = 'true')
        `;

        let params = [];
        if (role !== 'super_admin') {
            query += " AND user_id = $1";
            params.push(userId);
        }

        query += " ORDER BY created_at DESC LIMIT 10";

        const result = await req.db.query(query, params);

        // Format into user-friendly notifications
        const notifications = result.rows.map(log => {
            let message = '';
            let type = 'info';

            if (log.success === false) {
                message = `Blocked ${log.action} attempt on ${log.resource_type}`;
                type = 'warning';
            } else if (log.metadata?.pii_detected === 'true') {
                message = `PII redacted during ${log.action}`;
                type = 'security';
            } else {
                message = `Security event: ${log.action}`;
            }

            return {
                id: log.id,
                message,
                type,
                timestamp: log.created_at,
                is_read: false // In a real app, you'd track this in a separate table
            };
        });

        res.json({
            success: true,
            notifications
        });
    } catch (error) {
        console.error('Notifications Error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

module.exports = router;
