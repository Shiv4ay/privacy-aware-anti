// backend/api/routes/privacy.js
// DPDP Act 2023 compliance endpoints.
'use strict';

const express = require('express');
const axios   = require('axios');

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
        const rawOrgId = Number(req.user?.org_id ?? req.user?.organizationId);
        const orgId = Number.isInteger(rawOrgId) && rawOrgId > 0 ? rawOrgId : null;
        if (!orgId) {
            return res.status(400).json({ error: 'Could not determine org_id from session' });
        }
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

    // Fix 4: safe org_id — guard against falsy coercion when org_id === 0
    const rawOrgId = Number(req.user?.org_id ?? req.user?.organizationId);
    const orgId = Number.isInteger(rawOrgId) && rawOrgId > 0 ? rawOrgId : null;
    if (!orgId) {
        return res.status(400).json({ error: 'Could not determine org_id from session' });
    }

    // Fix 2: validate WORKER_INTERNAL_KEY before proceeding
    const internalKey = process.env.WORKER_INTERNAL_KEY;
    if (!internalKey) {
        console.error('[Privacy] WORKER_INTERNAL_KEY is not configured');
        return res.status(500).json({ error: 'Erasure service misconfigured: WORKER_INTERNAL_KEY not set' });
    }

    // userId from JWT may be a UUID string or a legacy string like 'dev-user-1'
    const userId   = req.user?.userId || req.user?.user_id;
    const entityId = req.user?.entityId || req.user?.entity_id;
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

        // Fix 3: wrap all 4 DB steps + audit entry in a transaction
        const client = await req.db.connect();
        try {
            await client.query('BEGIN');

            // 1. Delete search queries (integer FK)
            if (dbIntId !== null) {
                const sqResult = await client.query(
                    'DELETE FROM search_queries WHERE user_id = $1 RETURNING id', [dbIntId]
                );
                erased.search_queries = sqResult.rowCount;
            } else {
                erased.search_queries = 0;
            }

            // 2. Anonymise audit logs (uuid FK — preserve record structure, remove PII detail)
            if (dbUuidId !== null) {
                const alResult = await client.query(
                    `UPDATE audit_logs SET details = '{"erased":true}'::jsonb
                     WHERE user_id = $1 RETURNING id`, [dbUuidId]
                );
                erased.audit_logs = alResult.rowCount;
            } else {
                erased.audit_logs = 0;
            }

            // 3. Delete consent records (varchar FK — userId works directly)
            const crResult = await client.query(
                'DELETE FROM consent_records WHERE user_id = $1 RETURNING id', [userId]
            );
            erased.consent_records = crResult.rowCount;

            // 4. Deactivate account, clear PII fields (uuid FK)
            if (dbUuidId !== null) {
                await client.query(
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

            // 6. Audit entry (no user_id since account is deactivated) — inside transaction
            const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
            await client.query(
                `INSERT INTO audit_logs (action, resource_type, details, ip_address)
                 VALUES ('erasure_completed', 'user', $1, $2)`,
                [JSON.stringify({ org_id: orgId, erased_keys: Object.keys(erased) }), ip]
            );

            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }

        // Fix 5: ChromaDB purge stays OUTSIDE the transaction (network I/O, not SQL)
        if (entityId) {
            const workerUrl = process.env.WORKER_URL || 'http://worker:8001';
            try {
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
                erased.partial = true;
            }
        } else {
            erased.chromadb_vectors = 'skipped_no_entity_id';
        }

        // Fix 5: use 207 if partial (ChromaDB purge failed), 200 otherwise
        const statusCode = erased.partial ? 207 : 200;
        res.status(statusCode).json({ message: 'Erasure complete', erased });
    } catch (err) {
        console.error('[Privacy] POST /erasure error:', err.message);
        // Fix 6: don't leak err.message to client
        res.status(500).json({ error: 'Erasure failed' });
    }
});

// GET /export — Right to Access (DPDP Act 2023 §11)
router.get('/export', async (req, res) => {
    const userId = req.user?.userId || req.user?.user_id;

    // Resolve DB integer id for FK-typed columns
    let dbIntId = null;
    let dbLookupFailed = false;
    try {
        const uRow = await req.db.query(
            `SELECT id FROM users WHERE user_id::text = $1 OR username = $2 LIMIT 1`,
            [userId, req.user?.username || '']
        );
        if (uRow.rows.length > 0) {
            dbIntId = uRow.rows[0].id;
        }
    } catch (lookupErr) {
        console.warn('[Privacy] /export user lookup warning:', lookupErr.message);
        dbLookupFailed = true;
    }

    // Fetch profile — 404 if user not found (unless dev-bypass user)
    let profile = null;
    try {
        const pRow = await req.db.query(
            `SELECT id, username, email, role, created_at, is_active
             FROM users WHERE user_id::text = $1 OR username = $2 LIMIT 1`,
            [userId, req.user?.username || '']
        );
        if (pRow.rows.length === 0) {
            // Dev auth bypass: user exists in JWT but not in DB — return synthetic profile
            if (req.user?.isDev) {
                profile = {
                    id: null,
                    username: req.user.username || userId,
                    email: req.user.email || null,
                    role: req.user.role || null,
                    created_at: null,
                    is_active: true,
                };
            } else {
                return res.status(404).json({ error: 'User not found' });
            }
        } else {
            profile = pRow.rows[0];
        }
    } catch (profileErr) {
        console.error('[Privacy] /export profile error:', profileErr.message);
        return res.status(500).json({ error: 'Failed to retrieve user profile' });
    }

    // consent_records — varchar FK, use userId directly
    let consent_records = [];
    try {
        const cr = await req.db.query(
            `SELECT purpose, granted, granted_at, withdrawn_at, updated_at
             FROM consent_records WHERE user_id = $1 ORDER BY purpose`,
            [userId]
        );
        consent_records = cr.rows;
    } catch (err) {
        console.warn('[Privacy] /export consent_records error:', err.message);
    }

    // search_queries — integer FK
    let search_queries = [];
    try {
        if (dbIntId !== null) {
            const sq = await req.db.query(
                `SELECT query_text, created_at, response_time_ms
                 FROM search_queries WHERE user_id = $1
                 ORDER BY created_at DESC LIMIT 100`,
                [dbIntId]
            );
            search_queries = sq.rows;
        }
    } catch (err) {
        console.warn('[Privacy] /export search_queries error:', err.message);
    }

    // audit_logs — integer FK
    // audit_logs.user_id is INTEGER FK (users.id) per init.sql schema
    let audit_logs = [];
    try {
        if (dbIntId !== null) {
            const al = await req.db.query(
                `SELECT action, resource_type, details, created_at, ip_address
                 FROM audit_logs WHERE user_id = $1
                 ORDER BY created_at DESC LIMIT 100`,
                [dbIntId]
            );
            audit_logs = al.rows;
        }
    } catch (err) {
        console.warn('[Privacy] /export audit_logs error:', err.message);
    }

    // documents — integer FK via uploaded_by
    let documents = [];
    try {
        if (dbIntId !== null) {
            const docs = await req.db.query(
                `SELECT filename, status, created_at, file_size
                 FROM documents WHERE uploaded_by = $1
                 ORDER BY created_at DESC LIMIT 500`,
                [dbIntId]
            );
            documents = docs.rows;
        }
    } catch (err) {
        console.warn('[Privacy] /export documents error:', err.message);
    }

    const documentsTruncated = documents.length === 500;

    res.json({
        exported_at: new Date().toISOString(),
        profile,
        consent_records,
        search_queries,
        audit_logs,
        documents,
        ...(dbLookupFailed ? { data_warning: 'Partial export — database error during user resolution' } : {}),
        ...(documentsTruncated ? { documents_truncated: true } : {}),
    });
});

module.exports = router;
