# Architectural Decisions

## RRR Security Guard Scope (2026-03-20)
**Decision**: The security guard in `recursive_resolve_links` blocks cross-student SRN resolution for PES-prefixed IDs only, NOT for PLC/COMP/COURSE/DEPT bridge IDs.

**Rationale**: Blocking all bridge IDs broke relationship resolution. A student querying their own data legitimately needs `PLC00028 → Placement record`, `COMP_MCA015 → Swiggy`, `MCA601B → course name`. These IDs are relational pointers, not another student's identity. Cross-student leakage is still blocked via the `where_filter = {source_id: entity_id}` constraint at the ChromaDB layer.

**Risk**: If a student forges a query containing another student's PLC ID, the PLC lookup still returns 0 results (no chunk is indexed under PLC as source_id). Zero exposure.

---

## Targeted Placement/Internship Injection (2026-03-20)
**Decision**: After hybrid vector search, explicitly inject placement/internship chunks via direct ChromaDB metadata filter (`source_id = entity_id`) when query contains placement/internship keywords.

**Rationale**: results.csv contributes 23 chunks per student. With top_k=10-15, these crowd out the single placement chunk. Vector similarity for "give placement details" is high for result chunks that contain the SRN. Targeted injection guarantees the placement record is always in context.

**Trade-off**: Adds 1 extra ChromaDB call per query that mentions placement/internship keywords. Acceptable latency cost (~10ms).

---

## Bulk ID Resolvers (2026-03-20)
**Decision**: Replaced per-bridge N+1 ChromaDB queries for course/company name resolution with a single bulk fetch of all `courses.csv` / `companies.csv` chunks.

**Rationale**: The per-bridge approach used `where={source_id: "MCA601B"}` but course chunks are indexed under `source_id = student_SRN`, not the course code. Zero results returned. Bulk fetch reads all chunks of a given filename and parses ID→Name pairs from structured text — more reliable and faster.

---

## Phase 8 PII Redaction Guards — Guard Execution Order (2026-03-20)
**Decision**: `redact_text()` applies guards in a specific priority order before any token is emitted:
1. COURSE CODE GUARD — skip raw MCA*/CSE* codes
2. STRUCTURAL LABEL GUARD — skip field-name strings (USN, GPA, etc.)
3. ACADEMIC TERMS GUARD — skip curriculum words Presidio misclassifies (Computer, Computing, Cloud…)
4. GEOGRAPHY GUARD — skip Indian states/cities/neighborhoods for ORGANIZATION+LOCATION+PERSON types
5. PROTECTED VALUES GUARD — skip sub-words of resolved course/company names for all types except hard PII
6. EMAIL PRIORITY (pre-loop) — remove entities overlapping with EMAIL_ADDRESS spans before redaction

**Rationale**: Later guards can only see entities that earlier guards did not drop. Ordering from most-specific to least-specific minimises false-positive PII tokens inside course names, addresses, and company names.

---

## Security Alert Streaming vs. HTTPException (2026-03-20)
**Decision**: In `/chat/stream`, security violations return `StreamingResponse(_security_alert_stream(...))` instead of `raise HTTPException(403)`.

**Rationale**: `HTTPException` terminates the SSE connection before any frames are sent, so the frontend receives a network error with no user-visible message. Streaming an SSE alert frame allows the frontend to display an inline warning card in the chat UI. The `/chat` (non-streaming) endpoint was already returning JSON with `status: "security_blocked"` — the frontend now checks this field and renders those messages with an amber warning style.

---

## NLU Query Normalization Scope (2026-03-20)
**Decision**: NLU normalization runs at the start of `build_search_query()` and modifies only `search_query` (the vector search input). The original `query` string sent to the LLM and used for PII redaction is never altered by NLU normalization.

**Rationale**: Modifying the user's original message before Presidio runs could corrupt PII detection. Normalization is applied only to the vector search path where approximate keyword matching is beneficial.

---

## Substitution Pass Order (2026-03-20)
**Decision**: The ID→Name substitution runs BEFORE `generate_chat_response`, so LLM context contains "Swiggy" not "COMP_MCA015". Presidio then redacts "Swiggy" → `[PERSON:idx_N]`. Frontend de-anonymizes via pii_map.

**Rationale**: The LLM system prompt instructs it to "NEVER SHOW RAW IDs" for COMP_/MCA_ IDs. If raw IDs reach the LLM, it either hallucinates names or omits the field. Substituting before Presidio ensures the LLM sees resolved names (even if Presidio then wraps them in tokens for privacy).

---

## Admin Context PII Bypass — Cloud LLM Privacy Trade-off (2026-03-21)
**Decision**: When `user_role` is `admin` or `super_admin`, `generate_chat_response()` and `/chat/stream` skip Presidio PII redaction entirely. Raw (un-tokenized) context is sent to the LLM.

**Rationale**: Admin role requires analytical reasoning over real data — counts, placement rankings, salary ranges. When context is fully tokenized (`[PERSON:idx_0]`, `[COMPANY:idx_1]` for every name and number), the LLM cannot synthesize aggregate answers and responds "I could not find information." This was the root cause of the "all queries return no results" bug. Admins are authorized to see all data in their organization; the privacy protection for admins is enforced at the RBAC/ABAC layer in the API gateway, not via Presidio.

**Compliance implications (FERPA / GDPR)**:
- **Local Ollama deployment**: No data leaves the institution's infrastructure. No compliance issue.
- **OpenAI API deployment** (`USE_OPENAI_CHAT=TRUE`): Raw student PII (names, SRNs, salaries, emails) is transmitted to OpenAI servers when an admin queries. This requires a Data Processing Agreement (DPA) with OpenAI and must be disclosed in the institution's privacy policy. Before enabling `USE_OPENAI_CHAT=TRUE` in a production environment, legal review is mandatory.

**Mitigations in place**:
- Admin access is authenticated via JWT with role verification in `authMiddleware.js`
- Admin accounts are subject to the same jailbreak detection as all roles (no bypass in `scan_prompt()`)
- All admin queries are written to the audit log (`audit_logs` table)
- `org_id` scoping prevents cross-tenant data leakage in all SQL queries

**Non-admin path**: Students and faculty continue to have their context redacted by Presidio before it reaches the LLM. The query itself is also redacted (`redacted_query`) when using the OpenAI cloud path.

**References**: `backend/worker/app.py` → `generate_chat_response()` lines ~1143-1151, `/chat/stream` redaction block.

---

## Privacy Shield — Server-Side Persistence (2026-03-21)
**Decision**: `privacy_shield_enabled` is stored in the `users` table (server-side DB), not in localStorage or a session cookie.

**Rationale**: A client-side flag can be forged or cleared by anyone with device access — the exact attack vector the feature is designed to prevent (shared device). Server-side state means the shield applies to all sessions and all devices simultaneously.

**Limitation**: Google OAuth users have no `password_hash`. The disable endpoint allows them to bypass password verification (noted production gap). In production, OAuth users should be required to re-authenticate via Google OAuth flow before disabling.

---

## Identity Anchor — Security Scan Ordering (2026-03-21)
**Decision**: The T9.3 identity anchor (appending `entity_id` to query) runs AFTER all security scans (Layer 1 regex, GuardrailManager, Layer 5 AI Judge), not before.

**Rationale**: Security scanners must evaluate the raw, user-supplied query text. Augmenting the query before scanning could mask borderline patterns or allow crafted inputs that only become malicious after the anchor is appended.

**Reference**: `backend/worker/app.py` — anchor injection moved to after the GuardrailManager block in both `/chat` and `/chat/stream`.

---

## Faculty Aggregate Query Role Enforcement (2026-03-21)
**Decision**: `_try_faculty_aggregate_query()` enforces its own role check (`user_role not in faculty/admin/super_admin → return ""`), independent of the call-site dispatch.

**Rationale**: Defence-in-depth. If the dispatch logic in `chat_with_documents` ever incorrectly routes a student query to the faculty aggregate function (e.g., due to a future refactor), the function itself refuses to return any data. No single point of failure controls access.
