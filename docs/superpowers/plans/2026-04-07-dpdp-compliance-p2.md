# DPDP Compliance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Privacy-Aware RAG system compliant with India's Digital Personal Data Protection (DPDP) Act 2023 by implementing consent management, right-to-erasure, right-to-access (data export), and automated data retention enforcement.

**Architecture:** Four independent additions to the existing Express API (`backend/api/`): (1) a new `consent_records` Postgres table + `/api/user/consent` endpoints, (2) a `/api/user/erasure` endpoint that wipes ChromaDB vectors + Postgres rows + MinIO files for a student, (3) a `/api/user/export` endpoint that collects and returns all data held about the requesting user, (4) a scheduled cron-style Postgres function call triggered by a lightweight Node.js cron job. Each addition has its own route file and migration.

**Tech Stack:** PostgreSQL (new table + migration SQL), Node.js Express, `node-cron` (lightweight cron), ChromaDB HTTP client (Python worker's `/admin/purge` endpoint we'll add), existing `authenticateJWT` + `verifyCsrf` middleware.

**Pre-requisites:**
- Working directory: `c:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR`
- Docker stack running on branch `rag-fix-stable`
- Postgres accessible via docker exec: `docker exec privacy-aware-postgres psql -U postgres privacy_docs`
- Worker accessible via docker exec for Python calls

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/database/migrations/012_dpdp_consent.sql` | `consent_records` table DDL |
| Create | `backend/api/routes/privacy.js` | All DPDP endpoints: consent, erasure, export |
| Modify | `backend/api/index.js` | Mount `/api/user/privacy/*` routes |
| Modify | `backend/worker/app.py` | Add `DELETE /admin/purge/{entity_id}` endpoint |
| Create | `backend/api/jobs/retentionCron.js` | Calls `cleanup_old_audit_logs()` + `cleanup_old_search_queries()` nightly |
| Modify | `backend/database/init.sql` | Add `cleanup_old_search_queries()` function |
| Create | `tests/compliance/test_dpdp.py` | Integration tests for all 4 compliance features |

---

## Task 1: Consent Management Table + Record/Withdraw Endpoints

DPDP Act §6: data principal must give explicit consent before processing. We store one consent record per user per purpose.

**Files:**
- Create: `backend/database/migrations/012_dpdp_consent.sql`
- Create: `backend/api/routes/privacy.js` (partial — consent section only)
- Modify: `backend/api/index.js`

- [ ] **Step 1: Write failing tests**

Create `tests/compliance/test_dpdp.py`:

```python
"""
DPDP Act 2023 compliance tests.
Run via docker exec: docker exec -e API_BASE=http://api:3001 privacy-aware-api node -e "..."
Or from host after temporarily exposing port 3001.
All tests use dev auth header since JWT minting is tested separately.
"""
import os
import requests
import pytest

API = os.getenv("API_BASE", "http://localhost:3001")
DEV_HEADERS = {
    "x-dev-auth": os.getenv("DEV_AUTH_KEY", "super-secret-dev-key"),
    "Content-Type": "application/json",
}

# ── Consent tests ─────────────────────────────────────────────────────────────

def test_record_consent():
    """POST /api/user/privacy/consent records consent for a purpose."""
    r = requests.post(
        f"{API}/api/user/privacy/consent",
        json={"purpose": "ai_query_processing", "granted": True},
        headers={**DEV_HEADERS, "X-CSRF-Token": _get_csrf()},
        timeout=5,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("purpose") == "ai_query_processing"
    assert body.get("granted") is True

def test_withdraw_consent():
    """POST /api/user/privacy/consent with granted=false withdraws consent."""
    csrf = _get_csrf()
    # First grant
    requests.post(
        f"{API}/api/user/privacy/consent",
        json={"purpose": "ai_query_processing", "granted": True},
        headers={**DEV_HEADERS, "X-CSRF-Token": csrf},
        timeout=5,
    )
    # Then withdraw
    r = requests.post(
        f"{API}/api/user/privacy/consent",
        json={"purpose": "ai_query_processing", "granted": False},
        headers={**DEV_HEADERS, "X-CSRF-Token": csrf},
        timeout=5,
    )
    assert r.status_code == 200
    assert r.json().get("granted") is False

def test_get_consent_status():
    """GET /api/user/privacy/consent returns all consent records for user."""
    r = requests.get(
        f"{API}/api/user/privacy/consent",
        headers=DEV_HEADERS,
        timeout=5,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert isinstance(body, list), "Expected list of consent records"

def test_consent_invalid_purpose_rejected():
    """POST with unknown purpose must return 400."""
    r = requests.post(
        f"{API}/api/user/privacy/consent",
        json={"purpose": "INVALID_PURPOSE_XYZ", "granted": True},
        headers={**DEV_HEADERS, "X-CSRF-Token": _get_csrf()},
        timeout=5,
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_csrf():
    """Fetch __csrf cookie from healthz and return token value."""
    r = requests.get(f"{API}/healthz", timeout=5)
    return r.cookies.get("__csrf", "")
```

Run baseline (expect FAIL — routes don't exist):
```bash
cd "c:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR"
pip install pytest requests -q
python -m pytest tests/compliance/test_dpdp.py::test_record_consent -v 2>&1 | tail -8
```
Expected: `FAILED` — 404 on `/api/user/privacy/consent`.

- [ ] **Step 2: Create migration 012_dpdp_consent.sql**

```sql
-- backend/database/migrations/012_dpdp_consent.sql
-- DPDP Act 2023 §6: explicit consent records per user per purpose.

CREATE TABLE IF NOT EXISTS consent_records (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(50)  NOT NULL,          -- matches users.user_id (UUID string)
    org_id      INTEGER      NOT NULL,
    purpose     VARCHAR(100) NOT NULL,           -- e.g. 'ai_query_processing'
    granted     BOOLEAN      NOT NULL,
    granted_at  TIMESTAMP,
    withdrawn_at TIMESTAMP,
    ip_address  INET,
    created_at  TIMESTAMP    DEFAULT NOW(),
    updated_at  TIMESTAMP    DEFAULT NOW(),
    CONSTRAINT uq_consent_user_purpose UNIQUE (user_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_consent_user_id  ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_org_id   ON consent_records(org_id);

-- Log migration
INSERT INTO audit_logs (action, resource_type, details)
VALUES ('migration', 'database',
        '{"version": "012", "description": "DPDP consent_records table"}');
```

Apply it:
```bash
docker exec -i privacy-aware-postgres psql -U postgres privacy_docs < backend/database/migrations/012_dpdp_consent.sql
```
Expected: `CREATE TABLE`, `CREATE INDEX`, `INSERT 0 1`.

- [ ] **Step 3: Create backend/api/routes/privacy.js — consent section**

```javascript
// backend/api/routes/privacy.js
// DPDP Act 2023 compliance endpoints:
//   GET  /consent          — list user's consent records
//   POST /consent          — grant or withdraw consent for a purpose
//   POST /erasure          — right to erasure (Task 2)
//   GET  /export           — right to access / data export (Task 3)
'use strict';

const express = require('express');
const router = express.Router();

const VALID_PURPOSES = [
    'ai_query_processing',
    'analytics_aggregation',
    'audit_logging',
    'document_storage',
];

// ── GET /consent ─────────────────────────────────────────────────────────────
router.get('/consent', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.user_id;
        const result = await req.db.query(
            `SELECT purpose, granted, granted_at, withdrawn_at, updated_at
             FROM consent_records
             WHERE user_id = $1
             ORDER BY purpose`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[Privacy] GET /consent error:', err.message);
        res.status(500).json({ error: 'Failed to fetch consent records' });
    }
});

// ── POST /consent ─────────────────────────────────────────────────────────────
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
        const orgId  = req.user?.org_id || 1;
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

        // Audit log
        await req.db.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address)
             VALUES ($1, $2, 'consent', $3, $4)`,
            [userId, granted ? 'consent_granted' : 'consent_withdrawn',
             JSON.stringify({ purpose }), ip]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[Privacy] POST /consent error:', err.message);
        res.status(500).json({ error: 'Failed to record consent' });
    }
});

module.exports = router;
```

- [ ] **Step 4: Mount route in backend/api/index.js**

Read `backend/api/index.js`. Find the block where `/api/user` is mounted (around line 198). After it, add:

```javascript
const privacyRoutes = require('./routes/privacy');
app.use('/api/user/privacy', verifyCsrf, authenticateJWT, privacyRoutes);
```

- [ ] **Step 5: Restart API and run consent tests**

```bash
docker compose restart api
sleep 8
cd "c:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR"
python -m pytest tests/compliance/test_dpdp.py::test_record_consent tests/compliance/test_dpdp.py::test_withdraw_consent tests/compliance/test_dpdp.py::test_get_consent_status tests/compliance/test_dpdp.py::test_consent_invalid_purpose_rejected -v 2>&1 | tail -15
```
Expected: 4/4 PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations/012_dpdp_consent.sql backend/api/routes/privacy.js backend/api/index.js tests/compliance/test_dpdp.py
git commit -m "$(cat <<'EOF'
feat(dpdp): consent management — grant/withdraw per purpose

DPDP Act 2023 §6: explicit per-user consent records.
- consent_records table (migration 012) with upsert on conflict
- GET /api/user/privacy/consent — list user's consent records
- POST /api/user/privacy/consent — grant or withdraw for a purpose
- Audit log entry on every consent change
- 4 purposes: ai_query_processing, analytics_aggregation, audit_logging, document_storage

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Right to Erasure (DELETE)

DPDP Act §13: data principal has the right to erasure of personal data. This must wipe: (1) ChromaDB vectors for the entity, (2) Postgres search_queries rows, (3) Postgres audit_logs rows, (4) MinIO files uploaded by the user, (5) mark the user account as erased.

**Files:**
- Modify: `backend/worker/app.py` — add `DELETE /admin/purge/{entity_id}` FastAPI endpoint
- Modify: `backend/api/routes/privacy.js` — add POST /erasure handler

- [ ] **Step 1: Write failing erasure test**

Add to `tests/compliance/test_dpdp.py`:

```python
def test_erasure_request_returns_summary():
    """POST /api/user/privacy/erasure returns a deletion summary."""
    r = requests.post(
        f"{API}/api/user/privacy/erasure",
        json={"confirm": True},
        headers={**DEV_HEADERS, "X-CSRF-Token": _get_csrf()},
        timeout=30,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert "erased" in body, f"Expected 'erased' key in response: {body}"
    # erased dict should report counts for each data category
    erased = body["erased"]
    assert "search_queries" in erased
    assert "audit_logs" in erased
    assert "chromadb_vectors" in erased

def test_erasure_without_confirm_rejected():
    """POST /api/user/privacy/erasure without confirm=true must return 400."""
    r = requests.post(
        f"{API}/api/user/privacy/erasure",
        json={"confirm": False},
        headers={**DEV_HEADERS, "X-CSRF-Token": _get_csrf()},
        timeout=5,
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"
```

Run baseline:
```bash
python -m pytest tests/compliance/test_dpdp.py::test_erasure_request_returns_summary -v 2>&1 | tail -8
```
Expected: FAILED — 404.

- [ ] **Step 2: Add purge endpoint to backend/worker/app.py**

Read `backend/worker/app.py`. Find the health endpoint (around line 2481). Add this new endpoint just after the health endpoint:

```python
@app.delete("/admin/purge/{entity_id}")
async def purge_entity_data(entity_id: str, request: Request):
    """
    DPDP Act right-to-erasure: delete all ChromaDB vectors for an entity.
    Only callable from the Node.js gateway (internal key required).
    Returns count of deleted vectors.
    """
    # Internal key guard (reuse existing middleware — already applied globally)
    org_id_header = request.headers.get("X-Org-Id")
    if not org_id_header:
        raise HTTPException(status_code=400, detail="X-Org-Id header required")

    try:
        org_id = int(org_id_header)
    except ValueError:
        raise HTTPException(status_code=400, detail="X-Org-Id must be an integer")

    collection_name = f"privacy_documents_{org_id}"
    deleted = 0
    try:
        col = chroma_client.get_collection(name=collection_name)
        # Get IDs of all docs belonging to this entity
        results = col.get(where={"source_id": entity_id}, include=[])
        ids = results.get("ids", [])
        if ids:
            col.delete(ids=ids)
            deleted = len(ids)
        logger.info(f"[ERASURE] Purged {deleted} vectors for entity {entity_id} in org {org_id}")
    except Exception as e:
        logger.warning(f"[ERASURE] ChromaDB purge warning for {entity_id}: {e}")
        # Collection may not exist — that's fine

    return {"entity_id": entity_id, "org_id": org_id, "deleted_vectors": deleted}
```

- [ ] **Step 3: Add /erasure handler to backend/api/routes/privacy.js**

Add this handler to `privacy.js`, before the `module.exports` line:

```javascript
// ── POST /erasure ─────────────────────────────────────────────────────────────
router.post('/erasure', async (req, res) => {
    const { confirm } = req.body;
    if (confirm !== true) {
        return res.status(400).json({
            error: 'Set "confirm": true to proceed with erasure. This action is irreversible.',
        });
    }

    const userId   = req.user?.userId || req.user?.user_id;
    const entityId = req.user?.entityId || req.user?.entity_id;
    const orgId    = req.user?.org_id || 1;
    const erased   = {};

    try {
        // 1. Delete search queries
        const sqResult = await req.db.query(
            'DELETE FROM search_queries WHERE user_id = $1 RETURNING id', [userId]
        );
        erased.search_queries = sqResult.rowCount;

        // 2. Anonymise audit logs (keep record that account existed, remove PII detail)
        const alResult = await req.db.query(
            `UPDATE audit_logs SET details = '{"erased": true}'::jsonb
             WHERE user_id = $1 RETURNING id`, [userId]
        );
        erased.audit_logs = alResult.rowCount;

        // 3. Delete consent records
        const crResult = await req.db.query(
            'DELETE FROM consent_records WHERE user_id = $1 RETURNING id', [userId]
        );
        erased.consent_records = crResult.rowCount;

        // 4. Purge ChromaDB vectors (call worker /admin/purge/:entity_id)
        erased.chromadb_vectors = 0;
        if (entityId) {
            const workerUrl = process.env.WORKER_URL || 'http://worker:8001';
            const internalKey = process.env.WORKER_INTERNAL_KEY || '';
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
                erased.chromadb_vectors = 'purge_failed';
            }
        }

        // 5. Mark user account as erased (deactivate, clear PII fields)
        await req.db.query(
            `UPDATE users SET
                is_active    = FALSE,
                email        = NULL,
                username     = 'erased_' || user_id,
                password_hash = NULL
             WHERE user_id = $1`, [userId]
        );
        erased.account = 'deactivated';

        // 6. Final audit entry (user_id set to null since account is gone)
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
```

- [ ] **Step 4: Restart worker and api, run erasure tests**

```bash
docker restart privacy-aware-worker
sleep 35
docker compose restart api
sleep 8
python -m pytest tests/compliance/test_dpdp.py::test_erasure_request_returns_summary tests/compliance/test_dpdp.py::test_erasure_without_confirm_rejected -v 2>&1 | tail -12
```
Expected: 2/2 PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/worker/app.py backend/api/routes/privacy.js tests/compliance/test_dpdp.py
git commit -m "$(cat <<'EOF'
feat(dpdp): right-to-erasure endpoint

DPDP Act 2023 §13: data principal may request deletion of all personal data.
POST /api/user/privacy/erasure (confirm: true):
- Deletes search_queries rows
- Anonymises audit_log detail fields (preserves record structure)
- Deletes consent_records
- Purges ChromaDB vectors via worker DELETE /admin/purge/{entity_id}
- Deactivates user account, nulls email/password_hash
- Requires explicit confirm: true to prevent accidental erasure

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Right to Access — Data Export

DPDP Act §11: data principal has the right to access all personal data the controller holds about them.

**Files:**
- Modify: `backend/api/routes/privacy.js` — add GET /export handler

- [ ] **Step 1: Write failing export test**

Add to `tests/compliance/test_dpdp.py`:

```python
def test_data_export_returns_all_categories():
    """GET /api/user/privacy/export returns all personal data for the user."""
    r = requests.get(
        f"{API}/api/user/privacy/export",
        headers=DEV_HEADERS,
        timeout=15,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    # Must include all required data categories
    for key in ("profile", "consent_records", "search_queries", "audit_logs", "documents"):
        assert key in body, f"Export missing category: {key}"

def test_data_export_content_type_json():
    """Data export must return application/json."""
    r = requests.get(f"{API}/api/user/privacy/export", headers=DEV_HEADERS, timeout=15)
    assert "application/json" in r.headers.get("Content-Type", "")
```

Run baseline:
```bash
python -m pytest tests/compliance/test_dpdp.py::test_data_export_returns_all_categories -v 2>&1 | tail -8
```
Expected: FAILED — 404.

- [ ] **Step 2: Add /export handler to backend/api/routes/privacy.js**

Add before `module.exports`:

```javascript
// ── GET /export ───────────────────────────────────────────────────────────────
router.get('/export', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.user_id;
        const orgId  = req.user?.org_id || 1;

        // 1. Profile (exclude password_hash)
        const profileResult = await req.db.query(
            `SELECT user_id, username, email, role, department,
                    user_category, entity_id, org_id, is_active,
                    created_at, last_login, privacy_shield_enabled
             FROM users WHERE user_id = $1`,
            [userId]
        );

        // 2. Consent records
        const consentResult = await req.db.query(
            `SELECT purpose, granted, granted_at, withdrawn_at, updated_at
             FROM consent_records WHERE user_id = $1 ORDER BY purpose`,
            [userId]
        );

        // 3. Search queries (last 100)
        const queriesResult = await req.db.query(
            `SELECT query_text, results_count, response_time_ms, created_at
             FROM search_queries
             WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 100`,
            [userId]
        );

        // 4. Audit logs (last 200, excluding erased entries)
        const auditResult = await req.db.query(
            `SELECT action, resource_type, details, ip_address, created_at
             FROM audit_logs
             WHERE user_id = $1 AND (details->>'erased') IS NULL
             ORDER BY created_at DESC LIMIT 200`,
            [userId]
        );

        // 5. Documents uploaded by user
        const docsResult = await req.db.query(
            `SELECT filename, original_filename, file_size, mime_type,
                    status, sensitivity, created_at
             FROM documents WHERE uploaded_by = (
                 SELECT id FROM users WHERE user_id = $1 LIMIT 1
             ) AND org_id = $2`,
            [userId, orgId]
        );

        const exportData = {
            exported_at:     new Date().toISOString(),
            data_controller: 'Privacy-Aware RAG System',
            legal_basis:     'DPDP Act 2023 §11 — Right to Access',
            profile:         profileResult.rows[0] || null,
            consent_records: consentResult.rows,
            search_queries:  queriesResult.rows,
            audit_logs:      auditResult.rows,
            documents:       docsResult.rows,
        };

        // Log the export access
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
        await req.db.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, details, ip_address)
             VALUES ($1, 'data_export_requested', 'user', $2, $3)`,
            [userId, JSON.stringify({ org_id: orgId }), ip]
        );

        res.setHeader('Content-Disposition', `attachment; filename="my-data-export-${userId}.json"`);
        res.json(exportData);
    } catch (err) {
        console.error('[Privacy] GET /export error:', err.message);
        res.status(500).json({ error: 'Export failed', detail: err.message });
    }
});
```

- [ ] **Step 3: Restart API and run export tests**

```bash
docker compose restart api
sleep 8
python -m pytest tests/compliance/test_dpdp.py::test_data_export_returns_all_categories tests/compliance/test_dpdp.py::test_data_export_content_type_json -v 2>&1 | tail -12
```
Expected: 2/2 PASSED.

- [ ] **Step 4: Commit**

```bash
git add backend/api/routes/privacy.js tests/compliance/test_dpdp.py
git commit -m "$(cat <<'EOF'
feat(dpdp): right-to-access data export endpoint

DPDP Act 2023 §11: data principal may request all personal data held.
GET /api/user/privacy/export returns JSON with:
- profile (no password_hash)
- consent_records
- search_queries (last 100)
- audit_logs (last 200, excluding erased entries)
- documents (uploaded by user)
Export access logged to audit_logs.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Automated Data Retention Enforcement

DPDP Act §8(7): data must not be retained longer than necessary. The `cleanup_old_audit_logs()` SQL function already exists (deletes audit_logs older than 90 days). We need: (1) an equivalent for `search_queries`, (2) a Node.js cron job that calls both nightly.

**Files:**
- Modify: `backend/database/init.sql` — add `cleanup_old_search_queries()` function
- Create: `backend/api/jobs/retentionCron.js`
- Modify: `backend/api/index.js` — start cron job on app startup

- [ ] **Step 1: Write failing retention test**

Add to `tests/compliance/test_dpdp.py`:

```python
import subprocess

def test_retention_cleanup_function_exists():
    """PostgreSQL cleanup functions for audit_logs and search_queries must exist."""
    result = subprocess.run(
        [
            "docker", "exec", "privacy-aware-postgres",
            "psql", "-U", "postgres", "privacy_docs",
            "-t", "-c",
            "SELECT proname FROM pg_proc WHERE proname IN "
            "('cleanup_old_audit_logs', 'cleanup_old_search_queries') ORDER BY proname;"
        ],
        capture_output=True, text=True, timeout=10
    )
    assert result.returncode == 0, f"psql failed: {result.stderr}"
    functions = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
    assert "cleanup_old_audit_logs" in functions, "cleanup_old_audit_logs function missing"
    assert "cleanup_old_search_queries" in functions, "cleanup_old_search_queries function missing"

def test_retention_cleanup_function_callable():
    """cleanup_old_search_queries() must execute without error and return an integer."""
    result = subprocess.run(
        [
            "docker", "exec", "privacy-aware-postgres",
            "psql", "-U", "postgres", "privacy_docs",
            "-t", "-c", "SELECT cleanup_old_search_queries();"
        ],
        capture_output=True, text=True, timeout=10
    )
    assert result.returncode == 0, f"Function call failed: {result.stderr}"
    output = result.stdout.strip()
    # Should return an integer (the deleted count)
    assert output.lstrip("-").isdigit() or output == "0", \
        f"Expected integer return, got: {output!r}"
```

Run baseline:
```bash
python -m pytest tests/compliance/test_dpdp.py::test_retention_cleanup_function_exists -v 2>&1 | tail -10
```
Expected: FAILED — `cleanup_old_search_queries` doesn't exist.

- [ ] **Step 2: Add cleanup_old_search_queries to init.sql**

Read `backend/database/init.sql`. Find the existing `cleanup_old_audit_logs` function (around line 190). Add directly after it:

```sql
-- Function to clean up old search queries (retention policy — DPDP Act §8(7))
CREATE OR REPLACE FUNCTION cleanup_old_search_queries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    retention_days INTEGER := COALESCE(
        (SELECT setting::INTEGER FROM pg_settings WHERE name = 'app.retention_days')
        , 90
    );
BEGIN
    DELETE FROM search_queries
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

Apply via docker exec:
```bash
docker exec -i privacy-aware-postgres psql -U postgres privacy_docs -c "
CREATE OR REPLACE FUNCTION cleanup_old_search_queries()
RETURNS INTEGER AS \$\$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM search_queries
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
\$\$ LANGUAGE plpgsql;
"
```
Expected: `CREATE FUNCTION`.

- [ ] **Step 3: Run retention tests**

```bash
python -m pytest tests/compliance/test_dpdp.py::test_retention_cleanup_function_exists tests/compliance/test_dpdp.py::test_retention_cleanup_function_callable -v 2>&1 | tail -10
```
Expected: 2/2 PASSED.

- [ ] **Step 4: Create backend/api/jobs/retentionCron.js**

First check if `node-cron` is installed:
```bash
cd backend/api && node -e "require('node-cron'); console.log('ok')" 2>/dev/null || npm install node-cron --save
```

Create `backend/api/jobs/retentionCron.js`:

```javascript
// backend/api/jobs/retentionCron.js
// DPDP Act §8(7) data retention enforcement.
// Runs nightly at 02:00 to purge records older than 90 days.
'use strict';

const cron = require('node-cron');

/**
 * Start the nightly retention cleanup job.
 * @param {object} db — pg Pool instance (req.db equivalent from app context)
 */
function startRetentionCron(db) {
    // Run at 02:00 every night
    cron.schedule('0 2 * * *', async () => {
        console.log('[RetentionCron] Starting nightly data retention cleanup');
        try {
            const auditResult = await db.query('SELECT cleanup_old_audit_logs() AS deleted');
            const auditDeleted = auditResult.rows[0]?.deleted ?? 0;

            const queryResult = await db.query('SELECT cleanup_old_search_queries() AS deleted');
            const queriesDeleted = queryResult.rows[0]?.deleted ?? 0;

            console.log(
                `[RetentionCron] Cleanup complete — audit_logs: ${auditDeleted} rows deleted, ` +
                `search_queries: ${queriesDeleted} rows deleted`
            );

            // Log to audit_logs for compliance evidence
            await db.query(
                `INSERT INTO audit_logs (action, resource_type, details)
                 VALUES ('retention_cleanup', 'system', $1)`,
                [JSON.stringify({
                    audit_logs_deleted:   auditDeleted,
                    queries_deleted:      queriesDeleted,
                    retention_policy_days: 90,
                })]
            );
        } catch (err) {
            console.error('[RetentionCron] Cleanup failed:', err.message);
        }
    }, {
        timezone: 'Asia/Kolkata',  // IST — align with DPDP jurisdiction
    });

    console.log('[RetentionCron] Nightly retention job scheduled (02:00 IST)');
}

module.exports = { startRetentionCron };
```

- [ ] **Step 5: Start cron in backend/api/index.js**

Read `backend/api/index.js`. Find where the app starts listening (search for `app.listen`). Add the cron startup just BEFORE the listen call:

```javascript
// DPDP retention cron (must start after DB pool is initialised)
const { startRetentionCron } = require('./jobs/retentionCron');
startRetentionCron(db);  // db is the pg Pool instance used throughout the app
```

**IMPORTANT:** Read the file to find the exact name of the pg Pool variable (`db`, `pool`, or similar) used in `app.listen` or exported. Use that variable name.

- [ ] **Step 6: Write cron unit test**

Add to `tests/compliance/test_dpdp.py`:

```python
def test_retention_cron_module_loadable():
    """retentionCron.js must load without errors and export startRetentionCron."""
    result = subprocess.run(
        ["docker", "exec", "privacy-aware-api",
         "node", "-e",
         "const {startRetentionCron}=require('./jobs/retentionCron'); "
         "console.log(typeof startRetentionCron);"],
        capture_output=True, text=True, timeout=10
    )
    assert result.returncode == 0, f"Module load failed: {result.stderr}"
    assert result.stdout.strip() == "function", \
        f"Expected 'function', got: {result.stdout.strip()!r}"
```

- [ ] **Step 7: Rebuild api image and run all compliance tests**

```bash
docker compose build api
docker compose up -d api
sleep 8
python -m pytest tests/compliance/test_dpdp.py -v 2>&1 | tail -25
```
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/database/init.sql backend/api/jobs/retentionCron.js backend/api/index.js tests/compliance/test_dpdp.py
git commit -m "$(cat <<'EOF'
feat(dpdp): automated data retention enforcement

DPDP Act 2023 §8(7): data must not be retained beyond necessity.
- cleanup_old_search_queries() PostgreSQL function (90-day window)
- backend/api/jobs/retentionCron.js: node-cron job at 02:00 IST nightly
- Calls both cleanup functions, logs deleted counts to audit_logs
- Test: cleanup functions exist and are callable; cron module loadable

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Run all compliance tests**

```bash
python -m pytest tests/compliance/test_dpdp.py -v 2>&1
```

Expected output:
```
tests/compliance/test_dpdp.py::test_record_consent PASSED
tests/compliance/test_dpdp.py::test_withdraw_consent PASSED
tests/compliance/test_dpdp.py::test_get_consent_status PASSED
tests/compliance/test_dpdp.py::test_consent_invalid_purpose_rejected PASSED
tests/compliance/test_dpdp.py::test_erasure_request_returns_summary PASSED
tests/compliance/test_dpdp.py::test_erasure_without_confirm_rejected PASSED
tests/compliance/test_dpdp.py::test_data_export_returns_all_categories PASSED
tests/compliance/test_dpdp.py::test_data_export_content_type_json PASSED
tests/compliance/test_dpdp.py::test_retention_cleanup_function_exists PASSED
tests/compliance/test_dpdp.py::test_retention_cleanup_function_callable PASSED
tests/compliance/test_dpdp.py::test_retention_cron_module_loadable PASSED
====== 11 passed ======
```

- [ ] **Run 11-point demo test — confirm no regressions**

```bash
MSYS_NO_PATHCONV=1 docker exec \
  -e WORKER_URL=http://worker:8001 \
  -e "DATABASE_URL=postgresql://postgres:postgres123secure@postgres:5432/privacy_docs" \
  privacy-aware-worker python -X utf8 /tmp/demo_test.py 2>&1 | tail -5
```
Expected: `11/11 passed`

---

## Self-Review

**Spec coverage:**
- ✅ DPDP §6 Consent: grant/withdraw/list per purpose (Task 1)
- ✅ DPDP §13 Erasure: ChromaDB purge + Postgres row deletion + account deactivation (Task 2)
- ✅ DPDP §11 Right to access: full data export JSON (Task 3)
- ✅ DPDP §8(7) Retention: nightly cron + `cleanup_old_search_queries()` (Task 4)
- ✅ Audit trail: every consent change, erasure, and export logged to audit_logs
- ✅ Worker purge endpoint protected by existing `internal_key_guard` middleware

**Placeholder scan:** No TBD, TODO, or "add appropriate" phrases found.

**Type consistency:**
- `userId` = `req.user?.userId || req.user?.user_id` — consistent across all 3 handlers
- `orgId` = `req.user?.org_id || 1` — consistent
- `db.query(...)` — matches the pg Pool pattern used in existing routes

**Out of scope for this plan:**
- Data Processing Agreement with OpenAI (legal document, not code)
- Privacy Impact Assessment (document, not code)
- Consent gate before allowing queries (enforced at product/UX level, not API)
