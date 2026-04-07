// backend/api/routes/privacy.js
// DPDP Act 2023 compliance endpoints.
'use strict';

const express = require('express');
const router = express.Router();

const VALID_PURPOSES = [
    'ai_query_processing',
    'analytics_aggregation',
    'audit_logging',
    'document_storage',
];

// GET /consent — list user's consent records
router.get('/consent', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.user_id;
        const result = await req.db.query(
            `SELECT purpose, granted, granted_at, withdrawn_at, updated_at
             FROM consent_records WHERE user_id = $1 ORDER BY purpose`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[Privacy] GET /consent error:', err.message);
        res.status(500).json({ error: 'Failed to fetch consent records' });
    }
});

// POST /consent — grant or withdraw consent
router.post('/consent', async (req, res) => {
    try {
        const { purpose, granted } = req.body;
        if (!VALID_PURPOSES.includes(purpose)) {
            return res.status(400).json({
                error: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(', ')}`,
            });
        }
        if (typeof granted !== 'boolean') {
            return res.status(400).json({ error: '"granted" must be a boolean' });
        }
        const userId = req.user?.userId || req.user?.user_id;
        const rawOrgId = req.user?.org_id || req.user?.organizationId || 1;
        const orgId = Number.isInteger(Number(rawOrgId)) && !isNaN(Number(rawOrgId)) ? Number(rawOrgId) : 1;
        const ip     = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
        const now    = new Date();

        const result = await req.db.query(
            `INSERT INTO consent_records
                 (user_id, org_id, purpose, granted, granted_at, withdrawn_at, ip_address, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (user_id, purpose) DO UPDATE SET
                 granted      = EXCLUDED.granted,
                 granted_at   = CASE WHEN EXCLUDED.granted THEN NOW() ELSE consent_records.granted_at END,
                 withdrawn_at = CASE WHEN NOT EXCLUDED.granted THEN NOW() ELSE NULL END,
                 ip_address   = EXCLUDED.ip_address,
                 updated_at   = NOW()
             RETURNING purpose, granted, granted_at, withdrawn_at`,
            [userId, orgId, purpose, granted, granted ? now : null, granted ? null : now, ip]
        );

        // Audit log — best-effort; uuid cast may fail for dev users
        try {
            await req.db.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address)
                 VALUES ($1::uuid, $2, 'consent', $3, $4)`,
                [userId, granted ? 'consent_granted' : 'consent_withdrawn',
                 JSON.stringify({ purpose }), ip]
            );
        } catch (auditErr) {
            console.warn('[Privacy] Audit log insert skipped:', auditErr.message);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Privacy] POST /consent error:', err.message);
        res.status(500).json({ error: 'Failed to record consent' });
    }
});

module.exports = router;
