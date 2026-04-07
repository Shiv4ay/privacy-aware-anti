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

// POST /erasure
router.post('/erasure', async (req, res) => {
    const { confirm } = req.body;
    if (confirm !== true) {
        return res.status(400).json({
            error: 'Set "confirm": true to proceed. This action is irreversible.',
        });
    }

    // userId from JWT may be a UUID string or a legacy string like 'dev-user-1'
    const userId   = req.user?.userId || req.user?.user_id;
    const entityId = req.user?.entityId || req.user?.entity_id;
    const orgId    = Number(req.user?.org_id) || 1;
    const erased   = {};

    try {
        // Resolve DB integer id and uuid for this user (needed for FK-typed columns)
        // consent_records.user_id is varchar — use userId directly
        // search_queries.user_id is integer FK to users.id
        // audit_logs.user_id is uuid FK to users.user_id
        let dbIntId  = null; // users.id (integer)
        let dbUuidId = null; // users.user_id (uuid)
        try {
            const uRow = await req.db.query(
                `SELECT id, user_id FROM users WHERE user_id::text = $1 OR username = $2 LIMIT 1`,
                [userId, req.user?.username || '']
            );
            if (uRow.rows.length > 0) {
                dbIntId  = uRow.rows[0].id;
                dbUuidId = uRow.rows[0].user_id;
            }
        } catch (lookupErr) {
            console.warn('[Privacy] User lookup warning:', lookupErr.message);
        }

        // 1. Delete search queries (integer FK)
        if (dbIntId !== null) {
            const sqResult = await req.db.query(
                'DELETE FROM search_queries WHERE user_id = $1 RETURNING id', [dbIntId]
            );
            erased.search_queries = sqResult.rowCount;
        } else {
            erased.search_queries = 0;
        }

        // 2. Anonymise audit logs (uuid FK — preserve record structure, remove PII detail)
        if (dbUuidId !== null) {
            const alResult = await req.db.query(
                `UPDATE audit_logs SET details = '{"erased":true}'::jsonb
                 WHERE user_id = $1 RETURNING id`, [dbUuidId]
            );
            erased.audit_logs = alResult.rowCount;
        } else {
            erased.audit_logs = 0;
        }

        // 3. Delete consent records (varchar FK — userId works directly)
        const crResult = await req.db.query(
            'DELETE FROM consent_records WHERE user_id = $1 RETURNING id', [userId]
        );
        erased.consent_records = crResult.rowCount;

        // 4. Purge ChromaDB vectors via worker
        erased.chromadb_vectors = 0;
        if (entityId) {
            const workerUrl    = process.env.WORKER_URL || 'http://worker:8001';
            const internalKey  = process.env.WORKER_INTERNAL_KEY || '';
            try {
                const axios = require('axios');
                const purgeRes = await axios.delete(
                    `${workerUrl}/admin/purge/${encodeURIComponent(entityId)}`,
                    {
                        headers: {
                            'X-Internal-Key': internalKey,
                            'X-Org-Id': String(orgId),
                        },
                        timeout: 30000,
                    }
                );
                erased.chromadb_vectors = purgeRes.data?.deleted_vectors ?? 0;
            } catch (purgeErr) {
                console.warn('[Privacy] ChromaDB purge warning:', purgeErr.message);
                erased.chromadb_vectors = 'purge_unavailable';
            }
        }

        // 5. Deactivate account, clear PII fields (uuid FK)
        if (dbUuidId !== null) {
            await req.db.query(
                `UPDATE users SET
                    is_active     = FALSE,
                    email         = NULL,
                    username      = 'erased_' || id::text,
                    password_hash = NULL
                 WHERE user_id = $1`, [dbUuidId]
            );
            erased.account = 'deactivated';
        } else {
            erased.account = 'not_found';
        }

        // 6. Audit entry (no user_id since account is deactivated)
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
        await req.db.query(
            `INSERT INTO audit_logs (action, resource_type, details, ip_address)
             VALUES ('erasure_completed', 'user', $1, $2)`,
            [JSON.stringify({ org_id: orgId, erased_keys: Object.keys(erased) }), ip]
        );

        res.json({ message: 'Erasure complete', erased });
    } catch (err) {
        console.error('[Privacy] POST /erasure error:', err.message);
        res.status(500).json({ error: 'Erasure failed', detail: err.message });
    }
});

module.exports = router;
