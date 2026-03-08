# Task List

## Phase 1: Document-Level RBAC 🔐

### [x] Task 1.1: Ingestion Script Update for RBAC Metadata
Description: Update the python data ingestion scripts (`backend/scripts/ingest_university_data.py` or similar) to inject `{"access_level": "role_name"}` into ChromaDB metadata for each document.
Expected Output: Ingestion scripts successfully attach role-based metadata to vector chunks.
Validation Method: Run ingestion script and inspect ChromaDB to verify `access_level` exists in metadata.

### [x] Task 1.2: Python Worker Search Update
Description: Update `backend/worker/app.py` `generate_chat_response` and ChromaDB query logic to filter results using `where={"access_level": request.user_role}` based on the incoming user role.
Expected Output: Python worker strictly filters vector queries by the `user_role` passed from the API.
Validation Method: Issue test queries as 'student' and 'faculty'. Verify 'student' cannot retrieve vectors tagged with `access_level: faculty`.

## Phase 2: Attack Simulation / Jailbreak Dashboard 🛡️

### [x] Task 2.1: Prompt Injection Heuristics / Guardrails API
Description: Implement a guardrail function in `backend/worker/app.py` that checks incoming queries against a list of known prompt injection patterns and jailbreak keywords before generating a response.
Expected Output: A function `check_prompt_injection(query)` that returns a boolean indicating malicious intent.
Validation Method: Pass known jailbreak strings. Verify the function flags them successfully.

### [x] Task 2.2: Admin Dashboard Threat Intelligence Tab
Description: Add a "Threat Intelligence" tab to `AdminDashboard.jsx`. Create a backend route `GET /api/security/threats` to retrieve intercepted prompt injections.
Expected Output: Admin UI displays a table/feed of blocked malicious prompts.
Validation Method: Verify the tab renders correctly and fetches data from the API endpoint.

### [x] Task 2.3: Integrate Guardrail Logging & Simulation Button
Description: When a prompt is flagged by `check_prompt_injection`, log it to the database (or a threats table) and return a custom error. Add a "Simulate Attack" button to the Admin UI that triggers a test injection.
Expected Output: Blocked queries trigger an immediate "Request blocked by security policy" response, and the attempt is logged and visible in the admin UI.
Validation Method: Click the simulation button in the UI, verify the request is blocked, and verify the threat appears in the threat feed.

## Phase 3: "Why was this redacted?" Explainer Tooltip 🕵️‍♂️

### Task 3.1: Presidio Metadata Retention
Description: Update the Presidio redaction logic in the Python worker to format redacted items with metadata, e.g., `<redacted type="EMAIL" score="0.99">[EMAIL]</redacted>`.
Expected Output: The AI response string contains structured metadata behind redactions instead of just plain `[EMAIL]`.
Validation Method: Send an email in a prompt and verify the backend returns the structured redaction tag.

### Task 3.2: Frontend PIIText Component Update
Description: Update `frontend/src/components/ui/PIIText.jsx` to parse the structured tags and render them as interactive hover tooltips showing the entity type and confidence score.
Expected Output: `[EMAIL]` is clickable/hoverable in the chat, displaying an explainer popover.
Validation Method: Hover over a redacted item in the UI and verify the tooltip displays the correct Presidio metadata.

## Phase 4: Configurable "Privacy Dial" 🎚️

### Task 4.1: Backend Privacy Severity Logic
Description: Update the Python worker to accept a `privacy_level` (1, 2, or 3) parameter. Map these levels to specific Presidio entities and Differential Privacy noise scales.
Expected Output: Worker dynamically applies redaction strictness based on the requested level.
Validation Method: Send queries with different `privacy_level` values and verify changes in the amount of redaction.

### Task 4.2: Frontend Settings Slider
Description: Add a range slider (1-3) to the User Settings or Admin panel that updates a `privacy_level` context or user preference in the DB. Send this parameter in `/chat` requests.
Expected Output: A functional UI slider that dictates how strictly the backend redacts data.
Validation Method: Adjust slider, send a query, and verify the frontend payload includes the correct `privacy_level`.

## Phase 5: Toxicity Analysis on Ingestion 📊

### Task 5.1: Toxicity Filtering in Document Pipeline
Description: Add a lightweight toxicity checker (e.g., HuggingFace `toxitox` or simple list matching) to the ingestion pipeline before embedding documents into ChromaDB.
Expected Output: Documents flagged as toxic are skipped and logged to a rejection file/table.
Validation Method: Ingest a mock document with toxic keywords and verify it is not stored in ChromaDB.
