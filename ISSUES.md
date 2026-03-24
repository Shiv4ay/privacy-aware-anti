# Known Issues

## OPEN

### [DESIGN NOTE] NLU `\baddress\b` alias is broad (2026-03-20)
**Status**: Accepted risk. The `address` NLU alias in `_NLU_ALIASES` expands any occurrence of "address" to "address residence location", including non-residential uses like "IP address" or "email address". In the university RAG context this is unlikely to cause wrong results (vector search is robust to extra terms). If false positives appear in technical queries, narrow the pattern to `\b(?:home\s+)?address\b` and exclude "email address" / "IP address".

### [RESOLVED] PII Token Fragment Corruption in LLM Response
**Status (2026-03-20)**: Token fragment cleanup now runs BEFORE de-anonymization inside `generate_chat_response()` (line ~1100). Clean dates confirmed: `Date Of Birth: 2001-08-15`, `Enrollment Date: 2023-07-15` with zero fragments.

### [RESOLVED] "First Name" Field Shows Full Name
**Status (2026-03-20)**: Context assembly now splits `First Name: Siba Sundar` → `First Name: Siba` + `Middle Name: Sundar` via regex before sending to LLM. Students with single-word first names unaffected.

### [RESOLVED] Swiggy Detected as PERSON by Presidio
**Status**: Bulk company resolver populates `id_to_name` before Presidio runs. TYPE_MAP maps ORGANIZATION → COMPANY so companies.csv names now correctly appear as `[COMPANY:idx_N]`.

## RESOLVED

### [FIXED] Explicit SRN Placement Query Returns "No Information" (2026-03-20)
Admin querying "give pes1pg24ca169 placement details" directly (no prior conversation) failed because `_injection_entity` was None — targeted injection was skipped. Fixed by adding a 3rd fallback: extract SRN via `\b(PES\d[A-Z0-9]+)\b` regex from the raw query string. Placement data now loads on explicit SRN queries without requiring conversation history.

### [FIXED] Course Sub-Words Redacted as COMPANY Badges (2026-03-20)
Presidio classified sub-words within resolved course names as ORGANIZATION entities. E.g., "Databases and Applications" became "Databases and [COMPANY:idx_1]"; "Cloud Computing and DevOps" lost both halves. Protected values guard in `redact_text` was updated from exact-match (`val in _protected`) to substring-match (`any(val in pterm for pterm in _protected)`). All course names now render as plain text.

### [FIXED] Course Codes Instead of Names (2026-03-20)
Bulk course resolver now reads all `courses.csv` chunks and maps MCA*/CSE* codes → names before context reaches LLM.

### [FIXED] Placement Table Empty (2026-03-20)
Targeted injection ensures placement chunk is always in context for placement-keyword queries. Bulk company resolver resolves COMP_MCA015 → Swiggy.

### [FIXED] Metadata Missing on Targeted Injection (2026-03-20)
Injected placement/internship chunks now carry actual ChromaDB metadata (including `doc_id`) to enable correct dedup in RRR.

### [FIXED] 1 Failed Document in Org 4 (ongoing)
1 document remains in `failed` state in Postgres for org_id=4. Query: `SELECT filename FROM documents WHERE org_id=4 AND status='failed'`.

---

## Phase 9 CodeRabbit Review Fixes (2026-03-21)

### [FIXED] C1 — privacy_mode Untrusted Body Value
**File**: `backend/worker/app.py` lines 3904, 4278
**Problem**: Worker read `privacy_mode` directly from request body without validation. Any caller bypassing the Node gateway could force `privacy_mode = 'normal'` to extract de-anonymized data even with the privacy shield enabled.
**Fix**: Added strict allowlist: `privacy_mode = "hidden" if _raw_mode == "hidden" else "normal"` at both `/chat` and `/chat/stream` parse sites.

### [FIXED] C2 — authMiddleware Import Commented Out in userSetup.js
**File**: `backend/api/routes/userSetup.js` line 5
**Problem**: `authenticateJWT` import was commented out. Routes depended entirely on mount-point middleware in `index.js` — no local guard if mounting changes.
**Fix**: Restored import; added `authenticateJWT` directly on the `/setup` route handler; added comment documenting the mount-point dependency.

### [FIXED] H1 — Cross-Tenant Data Leak When org_id is Null
**File**: `backend/worker/app.py` — audit log (line ~3631) and active users (line ~3759) blocks
**Problem**: When `org_id` is None, audit log and login history queries returned all-tenant data.
**Fix**: Added explicit `if not org_id:` guard returning an informational error; active-users block now always uses `AND org_id = %s`.

### [FIXED] H2 — Faculty Aggregate Function Lacked Role Check
**File**: `backend/worker/app.py` `_try_faculty_aggregate_query`
**Problem**: Function had no `user_role` parameter and no internal role guard.
**Fix**: Added `user_role` parameter; function returns `""` immediately for any role outside `faculty/admin/super_admin`.

### [FIXED] H3 — Identity Anchor Injected Before Security Scans
**File**: `backend/worker/app.py` — both `/chat` and `/chat/stream`
**Problem**: Anchor appended `entity_id` to query text before `scan_prompt`, `GuardrailManager`, and AI Judge ran.
**Fix**: Moved anchor injection to after all security scans complete in both endpoints.

### [FIXED] H4 — Duplicate privacy_mode / privacy_level DB Lookups
**File**: `backend/api/routes/chat.js`
**Problem**: Identical 8-line blocks in `/chat` and `/chat/stream` fetched `privacy_shield_enabled`.
**Fix**: Extracted `fetchUserPrivacyMode(db, userId)` and `fetchOrgPrivacyLevel(db, org_id)` shared helpers.

### [FIXED] M1 — /setup UPDATE Used Integer PK Instead of UUID user_id
**File**: `backend/api/routes/userSetup.js` `/setup` handler
**Problem**: `WHERE id = $3` used integer PK; all other handlers in same file use `WHERE user_id = $1` (UUID).
**Fix**: Changed to `WHERE user_id = $3` with `req.user.userId`.

### [FIXED] M2 — Legal-Pretext Jailbreak Regex Had Word-Gap Bypass
**File**: `backend/worker/security/prompt_guard.py`
**Problem**: `\s+\w*\s*` between authority keyword and verb cannot span two+ filler words.
**Fix**: Changed to `.{0,40}` (consistent with all other T9.6 patterns).

### [FIXED] M3 — De-Anonymization Gate Swallowed Privacy-Shield Log
**File**: `backend/worker/app.py` line 1506
**Problem**: `elif privacy_mode == 'hidden'` was unreachable when `pii_session_map` was empty.
**Fix**: Restructured to check `privacy_mode == 'hidden'` first, then `elif` for normal de-anon.
