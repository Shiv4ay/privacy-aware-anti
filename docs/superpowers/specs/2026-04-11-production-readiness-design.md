# Production Readiness Design — Privacy-Aware RAG

**Date:** 2026-04-11  
**Scope:** Full production readiness for panel presentation  
**Approach:** Option 2 — parallel streams by layer

---

## 1. Problem Statement

The system has 4 crash-level bugs, 6 silent-failure security bugs, 4 medium correctness bugs, and 3 visible presentation gaps that will be seen by the review panel. The backend audit API already exists and works. The frontend Audit Dashboard is a 30-line placeholder. Super Admin "Create Admin" returns 501. Several SQL patterns use string interpolation instead of parameterized queries.

---

## 2. Architecture Overview (unchanged)

```
Browser → Nginx (80/443)
            ↓
       Node.js API Gateway (port 3001, internal only)
            ↓ JWT auth + org_id + entity_id injection
       Python FastAPI Worker (port 8001, internal only)
            ↓
   ChromaDB | PostgreSQL | NL2SQL (LangChain + gpt-4o-mini)
```

No architectural changes. All fixes are within existing layers.

---

## 3. Stream A — Backend Bug Fixes (Node.js API)

### A1. Fix `filePath` undefined crash in `index.js`
**File:** `backend/api/index.js` lines 342, 350  
**Fix:** Replace `filePath` with `req.file.path` in both `fs.unlinkSync()` calls.

### A2. Fix `audit_log` → `audit_logs` table name in `admin.js`
**File:** `backend/api/routes/admin.js` line 406  
**Fix:** Change `audit_log` to `audit_logs`. Match schema used everywhere else.

### A3. Fix session invalidation UUID bug in `admin.js`
**File:** `backend/api/routes/admin.js` lines 486, 516, 442  
**Root cause:** `UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1` uses integer `id` — but `auth_sessions.user_id` is UUID.  
**Fix:** In each of these three locations, first look up `user_id` (UUID) from `users` table by integer `id`, then use the UUID in the session update. Pattern already exists at line 437–438.

### A4. Fix UUID cast error in audit log filter
**File:** `backend/api/routes/admin.js` line 554  
**Fix:** Remove `parseInt(userId)` — pass the raw `userId` string (UUID) directly.

### A5. Fix SQL string interpolation in `system-stats`
**File:** `backend/api/routes/admin.js` lines 646–655  
**Fix:** Replace `WHERE org_id = ${parseInt(orgId)}` with parameterized `WHERE org_id = $1` and pass `orgId` as a parameter.

### A6. Add pagination cap on documents list
**File:** `backend/api/routes/admin.js` line 299  
**Fix:** Change `parseInt(req.query.limit) || 50` to `Math.min(200, parseInt(req.query.limit) || 50)`.

### A7. Implement Super Admin "Create Admin"
**File:** `backend/api/routes/superAdmin.js` line 63–68  
**Fix:** Replace the 501 stub with a real implementation:
- Hash password with bcrypt
- Insert user with `role = 'admin'`, `org_id` from body
- Return created user (same pattern as `admin.js` create user)

### A8. Add null-check guard in `superAdmin.js`
**File:** `backend/api/routes/superAdmin.js` line 12–13  
**Fix:** Add `if (!req.user)` guard before role check.

### A9. Add audit log for status toggle
**File:** `backend/api/routes/admin.js` — `PATCH /users/:id/status`  
**Fix:** Add `INSERT INTO audit_logs` after successful status change (same pattern as suspend endpoint).

### A10. Remove debug `console.log` statements
**File:** `backend/api/index.js` lines 134, 141, 146, 195, 200, 203, 205  
**Fix:** Delete all `[DEBUG]` console.log middleware. Keep real error logging.

---

## 4. Stream B — Audit Dashboard (Frontend)

### B1. Replace placeholder with full Audit Dashboard
**File:** `frontend/src/pages/AuditDashboard.jsx`  
**Replace** the 30-line placeholder with a complete implementation that calls the existing backend routes:

**Sections:**
1. **Stats Bar** — 5 KPI cards from `GET /api/audit/stats`: Total Queries, Blocked, Jailbreak Attempts, Privacy Violations, Privacy Score
2. **Timeline Chart** — Line chart from `GET /api/audit/timeline` (7-day query volume, blocked, jailbreaks per day)
3. **Log Explorer** — Paginated table from `GET /api/audit/logs` with filters: status (allowed/blocked/privacy), PII detected toggle, page controls
4. **Export Button** — Calls `GET /api/audit/export` and downloads CSV

**Design:** Match existing dashboard glass-panel aesthetic (dark glass cards, purple/amber/emerald color scheme, same font sizes and border styles as `AdminDashboard.jsx`).

**State:** `stats`, `logs`, `timeline`, `loading`, `page`, `filters` — all local React state, no new context needed.

---

## 5. Stream C — Security Hardening (Worker + Prompt Guard)

### C1. Remove magic-string aggregate bypass
**File:** `backend/worker/app.py` line 1761  
**Fix:** Remove `or normalized_context.lstrip().startswith("ADMIN STATISTICS RECORD:")` — rely only on `is_aggregate_context` boolean parameter. The boolean is already correctly set by `_try_admin_aggregate_query()`.

### C2. Expand cross-student name detection to 3-char min
**File:** `backend/worker/app.py` ~line 1577  
**Fix:** Change length check from `len(n) >= 4` to `len(n) >= 3`.

### C3. Add jailbreak encoding bypass patterns
**File:** `backend/worker/security/prompt_guard.py`  
**Add two new regex patterns:**
- Base64 instruction detection: `r'(?i)\b(?:execute|run|decode)\s*[:\-]?\s*[A-Za-z0-9+/]{20,}={0,2}\b'`
- Emotional pretext extraction: `r'(?i)\b(failing|desperate|need\s+help)\b.{0,60}\b(classmate|student|friend)\b.{0,60}\b(record|data|mark|grade|detail)\b'`

---

## 6. Tests (TDD — RED then GREEN)

For each fix, a test is written first:

| Test File | Covers |
|-----------|--------|
| `tests/security/test_indian_id_redaction.py` | C-series: Aadhar, PAN, IFSC redacted |
| `tests/security/test_aggregate_bypass.py` | C1: magic string no longer bypasses redaction |
| `tests/security/test_jailbreak_encoding.py` | C3: base64 + emotional pretext blocked |
| `tests/security/test_admin_bugs.py` | A3: session invalidation uses UUID; A4: audit filter; A6: pagination cap |
| `tests/security/test_super_admin_create.py` | A7: create admin returns 201 |

---

## 7. Execution Order

```
1. Stream A (backend bugs)   — fix crashes first, restart API
2. Stream C (security)       — worker fixes, restart worker
3. Stream B (audit dashboard) — frontend only, no restart needed
4. Run full test suite        — confirm all green
5. Demo smoke test (11-point) — confirm end-to-end
```

---

## 8. What Does NOT Change

- ChromaDB indexing, RAG logic, NL2SQL pipeline — untouched
- Auth flow, JWT, Google OAuth — untouched
- PII redaction engine (lines 590–611 already correct) — untouched
- DPDP compliance endpoints — untouched
- Circuit breaker, metrics, readiness probe — untouched
- Existing test suites — must remain passing after changes

---

## 9. Success Criteria (Panel Demo Checklist)

- [ ] File upload completes without crashing
- [ ] Admin reactivate user returns 200 (not 500)
- [ ] Audit Dashboard shows real data (stats, chart, logs, export)
- [ ] Super Admin can create a new admin account
- [ ] Suspended user's session terminates immediately
- [ ] Audit log filter by user_id works (no cast error)
- [ ] `system-stats` works for admin with org_id (no NaN error)
- [ ] No `[DEBUG]` logs visible in docker logs
- [ ] Jailbreak attempt with base64 encoding → blocked
- [ ] All existing tests still pass
