'use strict';
const express = require('express');
const router  = express.Router();

/**
 * GET /api/notifications/security
 * Returns recent jailbreak_attempt + privacy_violation events from audit_logs.
 * Admin/super_admin → all events for their org.
 * Others          → only their own events.
 */
router.get('/security', async (req, res) => {
    const { userId, role, org_id } = req.user || {};
    const isAdmin = role === 'admin' || role === 'super_admin';

    try {
        const db = req.app.locals.db || req.db;
        if (!db) return res.status(503).json({ error: 'DB unavailable' });

        let query, params;
        if (isAdmin) {
            query = `
                SELECT a.id, a.action, a.created_at, a.details,
                       u.email, u.role as user_role
                FROM   audit_logs a
                LEFT JOIN users u ON u.user_id = a.user_id
                WHERE  a.action IN ('jailbreak_attempt','privacy_violation')
                  AND  ($1::int IS NULL OR u.org_id = $1)
                ORDER  BY a.created_at DESC
                LIMIT  50
            `;
            params = [org_id || null];
        } else {
            query = `
                SELECT a.id, a.action, a.created_at, a.details,
                       u.email, u.role as user_role
                FROM   audit_logs a
                LEFT JOIN users u ON u.user_id = a.user_id
                WHERE  a.action IN ('jailbreak_attempt','privacy_violation')
                  AND  a.user_id = $1
                ORDER  BY a.created_at DESC
                LIMIT  20
            `;
            params = [userId];
        }

        const result = await db.query(query, params);

        const events = result.rows.map(row => ({
            id:        row.id,
            type:      row.action === 'jailbreak_attempt' ? 'jailbreak' : 'privacy',
            severity:  row.action === 'jailbreak_attempt' ? 'high' : 'medium',
            email:     row.email || 'unknown',
            user_role: row.user_role || 'unknown',
            detail:    (row.details?.query_redacted || row.details?.query || row.details?.reason || '').slice(0, 120),
            timestamp: row.created_at,
        }));

        // Unread = events in last 24 hours
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const unread = events.filter(e => new Date(e.timestamp) > cutoff).length;

        res.json({ events, unread });
    } catch (err) {
        console.error('[Notifications] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch security alerts' });
    }
});

/**
 * GET /api/notifications (legacy — redirect to /security for compatibility)
 */
router.get('/', async (req, res) => {
    res.redirect('/api/notifications/security');
});

module.exports = router;
