'use strict';
// POST /api/feedback          — record user thumbs-up/down rating on a RAG response
// GET  /api/admin/feedback/stats — admin aggregate satisfaction stats

const express = require('express');
const router = express.Router();
const { logger } = require('../middleware/logger');

const VALID_RATINGS = new Set(['up', 'down']);

// POST /api/feedback — store a thumbs-up/down rating
router.post('/', async (req, res) => {
    try {
        const { query_hash, rating, comment } = req.body;

        if (!query_hash || typeof query_hash !== 'string' || query_hash.length > 128) {
            return res.status(400).json({ error: 'query_hash is required and must be a string ≤ 128 chars' });
        }
        if (!VALID_RATINGS.has(rating)) {
            return res.status(400).json({ error: "rating must be 'up' or 'down'" });
        }

        const userId   = req.user?.userId || req.user?.user_id || 'anonymous';
        const rawOrgId = Number(req.user?.org_id ?? req.user?.organizationId);
        const orgId    = Number.isInteger(rawOrgId) && rawOrgId > 0 ? rawOrgId : 1;
        const cleanComment = comment ? String(comment).slice(0, 500) : null;

        const result = await req.db.query(
            `INSERT INTO response_feedback (user_id, org_id, query_hash, rating, comment)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
            [userId, orgId, query_hash, rating, cleanComment]
        );

        logger.info('Feedback recorded', { rating, org_id: orgId, query_hash: query_hash.slice(0, 8) });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        logger.error('POST /feedback error', { error: err.message });
        res.status(500).json({ error: 'Failed to record feedback' });
    }
});

// GET /stats — aggregate feedback stats (admin/super_admin only)
// Mounted at /api/admin/feedback, so this path is /api/admin/feedback/stats
router.get('/stats', async (req, res) => {
    try {
        const role = req.user?.role || req.user?.user_role || '';
        if (!['admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const rawOrgId = Number(req.user?.org_id ?? req.user?.organizationId);
        const orgFilter = Number.isInteger(rawOrgId) && rawOrgId > 0;

        const [totals, recent] = await Promise.all([
            req.db.query(
                orgFilter
                    ? `SELECT rating, COUNT(*)::int AS count FROM response_feedback WHERE org_id = $1 GROUP BY rating`
                    : `SELECT rating, COUNT(*)::int AS count FROM response_feedback GROUP BY rating`,
                orgFilter ? [rawOrgId] : []
            ),
            req.db.query(
                orgFilter
                    ? `SELECT id, rating, query_hash, comment, created_at FROM response_feedback WHERE org_id = $1 ORDER BY created_at DESC LIMIT 10`
                    : `SELECT id, rating, query_hash, comment, created_at FROM response_feedback ORDER BY created_at DESC LIMIT 10`,
                orgFilter ? [rawOrgId] : []
            ),
        ]);

        const counts = { up: 0, down: 0 };
        for (const row of totals.rows) {
            counts[row.rating] = row.count;
        }
        const total = counts.up + counts.down;

        res.json({
            total,
            thumbs_up:         counts.up,
            thumbs_down:       counts.down,
            satisfaction_rate: total > 0 ? Math.round((counts.up / total) * 100) : null,
            recent:            recent.rows,
        });
    } catch (err) {
        logger.error('GET /admin/feedback/stats error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch feedback stats' });
    }
});

module.exports = router;
