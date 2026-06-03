# Production Infrastructure Security Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down the network surface of the Privacy-Aware RAG system so that internal services (Postgres, Redis, ChromaDB, Worker) are unreachable from the host network, all external traffic is TLS-terminated, secrets never live on disk, and the production Docker image contains no debug/diagnostic scripts.

**Architecture:** An Nginx container joins the existing Docker network, terminates TLS, and proxies only the two public-facing endpoints (API on 3001, Frontend on port 80/443). All internal service `ports:` mappings are replaced with `expose:` (container-to-container only). Secrets are injected at container start via `.env.production` which is never committed. Debug scripts are excluded from the production image via `.dockerignore`.

**Tech Stack:** Nginx 1.25-alpine, OpenSSL (self-signed certs for dev), Let's Encrypt Certbot for production, Docker Compose `expose` vs `ports` distinction, `.dockerignore`.

**Pre-requisites:** Completed worktree at `PRIVACY-AWARE-RAG-GUIDE-CUR/.worktrees/chat-prod-fixes/`. All commands run from `PRIVACY-AWARE-RAG-GUIDE-CUR/`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `nginx/nginx.conf` | Reverse proxy: TLS termination, rate limit, proxy to api:3001 and frontend |
| Create | `nginx/Dockerfile` | Nginx image with certs baked in for dev; certbot volume in prod |
| Create | `nginx/certs/gen-dev-certs.sh` | One-shot script to generate self-signed certs for local dev |
| Modify | `docker-compose.yml` | Remove external port mappings for postgres/redis/chromadb/worker/minio/ollama; add nginx service |
| Create | `docker-compose.prod.yml` | Production overrides: certbot volumes, restart policies, resource limits |
| Create | `backend/worker/.dockerignore` | Exclude debug scripts, test files, backup files from production image |
| Modify | `backend/worker/Dockerfile` | Add `--workers 2` for production, pin uvicorn version |
| Create | `.env.example` | Template with all required env vars (no real values) |
| Create | `backend/api/middleware/csrf.js` | CSRF double-submit cookie pattern |
| Modify | `backend/api/index.js` | Mount csrf middleware on state-changing routes |
| Create | `tests/security/test_port_exposure.py` | Verify internal ports not accessible from host |
| Create | `tests/security/test_csrf.py` | Verify CSRF token required on POST/PUT/DELETE |

---

## Task 1: Remove External Port Mappings for Internal Services

Internal services (postgres, redis, chromadb, worker, minio, ollama) must not bind to `0.0.0.0`. Replace `ports:` with `expose:` — container-to-container routing still works; host access is cut.

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Write the failing security test**

Create `tests/security/test_port_exposure.py`:

```python
"""
Verify that internal services are NOT reachable from the host network.
Run AFTER applying docker-compose changes: docker compose up -d
"""
import socket
import pytest

INTERNAL_PORTS = [
    ("localhost", 5432, "postgres"),
    ("localhost", 6379, "redis"),
    ("localhost", 8000, "chromadb"),
    ("localhost", 8001, "worker"),
    ("localhost", 9000, "minio-api"),
    ("localhost", 9001, "minio-console"),
    ("localhost", 11434, "ollama"),
]

PUBLIC_PORTS = [
    ("localhost", 443, "nginx-https"),
    ("localhost", 80, "nginx-http"),
]

def _is_port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (ConnectionRefusedError, OSError):
        return False

@pytest.mark.parametrize("host,port,name", INTERNAL_PORTS)
def test_internal_port_not_exposed(host, port, name):
    """Internal services MUST NOT be reachable from the host."""
    assert not _is_port_open(host, port), (
        f"SECURITY VIOLATION: {name} port {port} is accessible from host. "
        f"Remove 'ports: - \"{port}:{port}\"' from docker-compose.yml."
    )

@pytest.mark.parametrize("host,port,name", PUBLIC_PORTS)
def test_public_port_reachable(host, port, name):
    """Public Nginx ports MUST be reachable."""
    assert _is_port_open(host, port), (
        f"Nginx {name} port {port} is not reachable. Is nginx container running?"
    )
```

- [ ] **Step 2: Run test — expect ALL internal port tests to FAIL (ports are currently open)**

```bash
pip install pytest
python -m pytest tests/security/test_port_exposure.py::test_internal_port_not_exposed -v
```
Expected: `FAILED` for all 7 internal ports (they're open right now).

- [ ] **Step 3: Edit docker-compose.yml — replace `ports:` with `expose:` for internal services**

In `docker-compose.yml`, make these replacements for each internal service. `expose:` makes the port available on the Docker network only:

**postgres** (lines 13-14):
```yaml
# BEFORE:
    ports:
      - "5432:5432"
# AFTER:
    expose:
      - "5432"
```

**redis** (lines 40-41):
```yaml
# BEFORE:
    ports:
      - "6379:6379"
# AFTER:
    expose:
      - "6379"
```

**minio** (lines 68-70):
```yaml
# BEFORE:
    ports:
      - "9000:9000"
      - "9001:9001"
# AFTER:
    expose:
      - "9000"
      - "9001"
```

**ollama** (lines 98-99):
```yaml
# BEFORE:
    ports:
      - "11434:11434"
# AFTER:
    expose:
      - "11434"
```

**chromadb** (lines 125-126):
```yaml
# BEFORE:
    ports:
      - "8000:8000"
# AFTER:
    expose:
      - "8000"
```

**worker** (lines 167-168):
```yaml
# BEFORE:
    ports:
      - "8001:8001"
# AFTER:
    expose:
      - "8001"
```

**api** — keep `ports: - "3001:3001"` for now (Nginx will proxy to it; remove after Task 3).

- [ ] **Step 4: Restart stack and re-run test**

```bash
docker compose down && docker compose up -d
sleep 15
python -m pytest tests/security/test_port_exposure.py::test_internal_port_not_exposed -v
```
Expected: `PASSED` for all 7 internal ports.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml tests/security/test_port_exposure.py
git commit -m "security: remove external port mappings for all internal services

Internal services (postgres, redis, chromadb, worker, minio, ollama)
now use expose: instead of ports:, making them unreachable from the
host network. Only accessible within the Docker bridge network.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add Nginx Reverse Proxy with TLS

Nginx terminates HTTPS and proxies `/api/*` → `api:3001` and `/*` → `frontend:80`. This is the only entry point from outside the Docker network.

**Files:**
- Create: `nginx/nginx.conf`
- Create: `nginx/certs/gen-dev-certs.sh`
- Create: `nginx/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Generate self-signed dev certs**

Create `nginx/certs/gen-dev-certs.sh`:

```bash
#!/bin/bash
# Generate self-signed TLS certificate for local development.
# Production: replace with Let's Encrypt certs via certbot.
set -e
CERT_DIR="$(dirname "$0")"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/dev.key" \
  -out "$CERT_DIR/dev.crt" \
  -subj "/C=IN/ST=Karnataka/L=Bangalore/O=PES University/CN=localhost"
echo "Dev certs generated at $CERT_DIR/dev.crt and $CERT_DIR/dev.key"
```

Run it:
```bash
mkdir -p nginx/certs
chmod +x nginx/certs/gen-dev-certs.sh
bash nginx/certs/gen-dev-certs.sh
```

Expected output: `Dev certs generated at nginx/certs/dev.crt and nginx/certs/dev.key`

- [ ] **Step 2: Write the failing HTTPS test**

Add to `tests/security/test_port_exposure.py`:

```python
import requests

def test_https_endpoint_reachable():
    """Nginx must serve HTTPS on port 443."""
    try:
        r = requests.get("https://localhost/healthz", verify=False, timeout=5)
        # 200 or 404 are both fine — means Nginx is up
        assert r.status_code in (200, 404, 502), f"Unexpected status: {r.status_code}"
    except requests.exceptions.ConnectionError:
        pytest.fail("HTTPS port 443 not reachable — Nginx not running")

def test_http_redirects_to_https():
    """HTTP on port 80 must redirect to HTTPS."""
    r = requests.get("http://localhost/", allow_redirects=False, timeout=5)
    assert r.status_code in (301, 302, 308), (
        f"Expected redirect, got {r.status_code}. HTTP should redirect to HTTPS."
    )
    assert "https" in r.headers.get("Location", "").lower()
```

Run:
```bash
python -m pytest tests/security/test_port_exposure.py::test_https_endpoint_reachable -v
```
Expected: `FAILED` — Nginx not running yet.

- [ ] **Step 3: Create nginx/nginx.conf**

```nginx
# nginx/nginx.conf
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=20r/m;
    limit_req_zone $binary_remote_addr zone=chat:10m rate=5r/m;

    # Redirect HTTP → HTTPS
    server {
        listen 80;
        server_name _;
        return 308 https://$host$request_uri;
    }

    # HTTPS — main server
    server {
        listen 443 ssl;
        server_name _;
        http2 on;

        ssl_certificate     /etc/nginx/certs/dev.crt;
        ssl_certificate_key /etc/nginx/certs/dev.key;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;
        ssl_session_cache   shared:SSL:10m;

        client_max_body_size 20M;

        # Health check (no rate limit)
        location = /healthz {
            return 200 'ok';
            add_header Content-Type text/plain;
        }

        # API — proxy to Node.js gateway
        location /api/ {
            limit_req zone=api burst=10 nodelay;
            proxy_pass         http://api:3001/;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto https;
            proxy_read_timeout 310s;
        }

        # Chat endpoint — tighter rate limit
        location /api/chat {
            limit_req zone=chat burst=3 nodelay;
            proxy_pass         http://api:3001/chat;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto https;
            proxy_read_timeout 310s;
        }

        # Frontend — static files
        location / {
            proxy_pass         http://frontend:80;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_read_timeout 30s;
        }
    }
}
```

- [ ] **Step 4: Create nginx/Dockerfile**

```dockerfile
# nginx/Dockerfile
FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY certs/dev.crt /etc/nginx/certs/dev.crt
COPY certs/dev.key /etc/nginx/certs/dev.key
EXPOSE 80 443
```

- [ ] **Step 5: Add nginx service to docker-compose.yml**

Add this service block after the `api` service:

```yaml
  # ---------------------------
  # Nginx — TLS reverse proxy (sole public entry point)
  # ---------------------------
  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    container_name: privacy-aware-nginx
    restart: unless-stopped
    depends_on:
      - api
      - frontend
    ports:
      - "80:80"
      - "443:443"
    networks:
      - privacy_aware_net
```

Also remove the external port mapping from the `api` service (it will only be reached via Nginx):
```yaml
  api:
    # Remove: ports:
    #           - "3001:3001"
    expose:
      - "3001"
```

- [ ] **Step 6: Rebuild and test**

```bash
docker compose build nginx
docker compose up -d nginx
sleep 5
pip install requests urllib3
python -m pytest tests/security/test_port_exposure.py -v --no-header -p no:warnings 2>&1
```
Expected: All internal port tests PASS, HTTPS test PASSES.

- [ ] **Step 7: Commit**

```bash
git add nginx/ docker-compose.yml tests/security/test_port_exposure.py
git commit -m "security: add nginx TLS reverse proxy as sole public entry point

- HTTP:80 redirects to HTTPS:443
- /api/* proxied to api:3001 (internal network only)
- /* proxied to frontend:80
- Rate limiting: 20 req/min general, 5 req/min for /api/chat
- api service port mapping removed; only accessible via nginx

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Clean Debug Scripts from Production Docker Image

`backend/worker/` contains 50+ debug, diagnostic, and one-off scripts. The production image (`COPY . .`) includes all of them — attack surface + information disclosure.

**Files:**
- Create: `backend/worker/.dockerignore`

- [ ] **Step 1: Write the failing test**

Create `tests/security/test_docker_image.py`:

```python
"""
Verify the production Docker image does not contain debug/diagnostic scripts.
Requires Docker daemon accessible.
Run: python -m pytest tests/security/test_docker_image.py -v
"""
import subprocess
import pytest

IMAGE = "privacy-aware-rag-worker"

BANNED_PATTERNS = [
    "debug_",
    "check_",
    "verify_",
    "script_",
    "audit_",
    "inspect_",
    "peek_",
    "recover",
    "requeue",
    "fresh_start",
    "clone_recovery",
    "exhaustive_scan",
    "diag_",
    ".backup",
    "container_logs",
    "worker_logs",
]

def test_no_debug_scripts_in_image():
    """Production image must not contain debug or diagnostic scripts."""
    result = subprocess.run(
        ["docker", "run", "--rm", IMAGE, "find", "/app", "-name", "*.py", "-type", "f"],
        capture_output=True, text=True, timeout=30
    )
    assert result.returncode == 0, f"docker run failed: {result.stderr}"
    files = result.stdout.strip().split("\n")
    violations = [
        f for f in files
        if any(pattern in f.lower() for pattern in BANNED_PATTERNS)
    ]
    assert not violations, (
        f"Debug/diagnostic scripts found in production image:\n"
        + "\n".join(violations)
        + "\n\nAdd these patterns to backend/worker/.dockerignore"
    )
```

- [ ] **Step 2: Build current image and run test — expect FAIL**

```bash
cd backend/worker && docker build -t privacy-aware-rag-worker . && cd ../..
python -m pytest tests/security/test_docker_image.py -v
```
Expected: `FAILED` — many debug_*.py files found.

- [ ] **Step 3: Create backend/worker/.dockerignore**

```dockerignore
# Debug and diagnostic scripts — never ship to production
debug_*.py
check_*.py
verify_*.py
inspect_*.py
peek_*.py
audit_*.py
recover*.py
requeue*.py
fresh_start*.py
clone_recovery.py
exhaustive_scan.py
script_*.py
script.py

# Diagnostic log files
diag_logs*.txt
container_logs*.txt
worker_logs*.txt
diagnostic_output.txt

# Backup files
*.backup
app.py.backup

# Test files (not needed in production image)
test_*.py
tests/

# Development/analysis scripts
apply_chat_fix.py
extract_code.py
fix_chat_query.py
real_encryption_check.py
search_*.py
global_ale_search.py

# ChromaDB local data (use Docker volume, not image layer)
chroma_db/

# Python cache
__pycache__/
*.pyc
*.pyo
```

- [ ] **Step 4: Rebuild image and run test — expect PASS**

```bash
cd backend/worker && docker build -t privacy-aware-rag-worker . && cd ../..
python -m pytest tests/security/test_docker_image.py -v
```
Expected: `PASSED` — no debug scripts in image.

- [ ] **Step 5: Verify app.py still present (sanity check)**

```bash
docker run --rm privacy-aware-rag-worker ls /app/app.py /app/requirements.txt /app/security/ /app/nl2sql/
```
Expected: All four paths listed without error.

- [ ] **Step 6: Commit**

```bash
git add backend/worker/.dockerignore tests/security/test_docker_image.py
git commit -m "security: exclude debug/diagnostic scripts from production Docker image

50+ debug_*.py, check_*.py, verify_*.py and log files were included
in the worker image via COPY . . — now excluded via .dockerignore.
Production image contains only app.py, security/, nl2sql/, ingestion/.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: CSRF Protection on State-Changing API Routes

The Node.js API accepts POST/PUT/DELETE requests with only JWT auth — a CSRF attack from a malicious site could forge requests on behalf of authenticated users. Use the double-submit cookie pattern (no server-side session required, works with JWTs).

**Files:**
- Create: `backend/api/middleware/csrf.js`
- Modify: `backend/api/index.js`
- Create: `tests/security/test_csrf.py`

- [ ] **Step 1: Write failing test**

Create `tests/security/test_csrf.py`:

```python
"""
CSRF protection test — POST without X-CSRF-Token must return 403.
Run against running stack: docker compose up -d
"""
import requests
import pytest

API = "https://localhost"
HEADERS_NO_CSRF = {"Content-Type": "application/json"}

@pytest.fixture
def dev_headers():
    """Dev auth headers (bypasses JWT for testing)."""
    return {
        "x-dev-auth": "super-secret-dev-key",
        "Content-Type": "application/json",
    }

def test_chat_post_without_csrf_token_rejected(dev_headers):
    """POST /api/chat without X-CSRF-Token header must return 403."""
    r = requests.post(
        f"{API}/api/chat",
        json={"query": "test", "org_id": 4},
        headers=dev_headers,
        verify=False,
        timeout=5,
    )
    assert r.status_code == 403, (
        f"Expected 403 CSRF rejection, got {r.status_code}. "
        "CSRF middleware not applied to /chat."
    )

def test_get_request_no_csrf_required(dev_headers):
    """GET requests must NOT require CSRF token."""
    r = requests.get(
        f"{API}/api/health",
        headers=dev_headers,
        verify=False,
        timeout=5,
    )
    # Any non-403 response means CSRF not blocking GETs
    assert r.status_code != 403, "GET should not require CSRF token"
```

Run:
```bash
python -m pytest tests/security/test_csrf.py::test_chat_post_without_csrf_token_rejected -v
```
Expected: `FAILED` — POST currently returns 200 or 401, not 403.

- [ ] **Step 2: Create backend/api/middleware/csrf.js**

```javascript
// backend/api/middleware/csrf.js
// Double-submit cookie pattern: client reads __csrf cookie, sends value
// in X-CSRF-Token header. Server verifies they match.
// Compatible with JWT auth (stateless). Safe for SPA frontends.

const crypto = require('crypto');

const CSRF_COOKIE = '__csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_BYTES = 32;

/**
 * Middleware: set __csrf cookie on every response if not present.
 */
function setCsrfCookie(req, res, next) {
    if (!req.cookies?.[CSRF_COOKIE]) {
        const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
        res.cookie(CSRF_COOKIE, token, {
            httpOnly: false,   // Must be readable by JS so client can send header
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
    }
    next();
}

/**
 * Middleware: reject state-changing requests without matching CSRF token.
 */
function verifyCsrf(req, res, next) {
    // Skip for safe methods
    if (SAFE_METHODS.has(req.method)) return next();

    // Skip for dev auth (internal tooling only — never in production)
    if (process.env.NODE_ENV === 'development' && req.get('x-dev-auth')) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get(CSRF_HEADER);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({
            error: 'CSRF validation failed',
            hint: 'Include the value of the __csrf cookie in the X-CSRF-Token header',
        });
    }
    next();
}

module.exports = { setCsrfCookie, verifyCsrf };
```

- [ ] **Step 3: Mount in backend/api/index.js**

Find where `app.use` middleware is mounted (near the top of `index.js`, after `express.json()`). Add:

```javascript
// Add near top of index.js, after app.use(express.json()) and cookie-parser:
const cookieParser = require('cookie-parser');
const { setCsrfCookie, verifyCsrf } = require('./middleware/csrf');

app.use(cookieParser());
app.use(setCsrfCookie);   // Sets __csrf cookie on all responses

// Apply CSRF verification only to state-changing API routes
app.use('/chat', verifyCsrf);
app.use('/documents', verifyCsrf);
app.use('/user', verifyCsrf);
app.use('/admin', verifyCsrf);
app.use('/auth/logout', verifyCsrf);
```

If `cookie-parser` is not installed:
```bash
cd backend/api && npm install cookie-parser && cd ../..
```

- [ ] **Step 4: Update frontend to send CSRF header (Chat.jsx)**

In `frontend/src/pages/Chat.jsx`, find the `client.post('/chat', ...)` call. Add the CSRF token read from the cookie:

```javascript
// Helper — read a cookie value by name
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : '';
}

// In the sendMessage function, add header to the axios/fetch call:
const response = await client.post('/chat', payload, {
  headers: {
    'X-CSRF-Token': getCookie('__csrf'),
  },
});
```

- [ ] **Step 5: Restart API and run test**

```bash
docker compose restart api
sleep 5
python -m pytest tests/security/test_csrf.py -v
```
Expected: `test_chat_post_without_csrf_token_rejected` PASSES (403 returned), `test_get_request_no_csrf_required` PASSES.

- [ ] **Step 6: Commit**

```bash
git add backend/api/middleware/csrf.js backend/api/index.js frontend/src/pages/Chat.jsx tests/security/test_csrf.py
git commit -m "security: add CSRF double-submit cookie protection to state-changing routes

POST/PUT/DELETE to /chat, /documents, /user, /admin require X-CSRF-Token
header matching the __csrf cookie. GET requests unaffected.
Frontend Chat.jsx reads __csrf cookie and sets header on every chat POST.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Secrets Out of .env Files

`.env` files on disk are a single-breach credential compromise. For a self-hosted production deployment, the minimum viable approach is: no secrets in committed files, secrets injected at container start via a deployment script that pulls from a secrets store.

**Files:**
- Create: `.env.example` (committed — template only, no real values)
- Create: `scripts/inject-secrets.sh` (pulls from environment or 1Password/Vault CLI)
- Create: `docker-compose.prod.yml` (uses `${VAR}` — no `env_file:`)

- [ ] **Step 1: Audit what secrets exist**

```bash
grep -E "KEY|SECRET|PASSWORD|TOKEN|SALT" .env | grep -v "^#" | sed 's/=.*/=<REDACTED>/'
```
Expected output (all redacted — confirms what needs to rotate):
```
POSTGRES_PASSWORD=<REDACTED>
JWT_SECRET=<REDACTED>
OPENAI_API_KEY=<REDACTED>
MINIO_SECRET_KEY=<REDACTED>
ALE_MASTER_KEY=<REDACTED>
WORKER_INTERNAL_KEY=<REDACTED>
QUERY_HASH_SALT=<REDACTED>
```

- [ ] **Step 2: Create .env.example**

```bash
cat > .env.example << 'EOF'
# Copy this to .env and fill in real values. NEVER commit .env.
# For production: inject these via CI/CD secrets or a secrets manager.

# PostgreSQL
POSTGRES_USER=privacy_user
POSTGRES_PASSWORD=CHANGE_ME_strong_password_here
POSTGRES_DB=privacy_aware_db

# JWT
JWT_SECRET=CHANGE_ME_at_least_64_random_chars
JWT_REFRESH_SECRET=CHANGE_ME_different_from_JWT_SECRET

# OpenAI
OPENAI_API_KEY=sk-CHANGE_ME

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=CHANGE_ME_minio_password
MINIO_ACCESS_KEY=CHANGE_ME_access_key
MINIO_SECRET_KEY=CHANGE_ME_secret_key
MINIO_PORT=9000
MINIO_BUCKET=privacy-docs

# Internal service key (gateway → worker)
WORKER_INTERNAL_KEY=CHANGE_ME_at_least_32_random_chars

# Misc
QUERY_HASH_SALT=CHANGE_ME_random_salt
ALE_MASTER_KEY=CHANGE_ME_encryption_key
CORS_ORIGIN=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
NODE_ENV=production
OLLAMA_MODEL=llama3.2
PRIMARY_MODEL=gpt-4o-mini
LOCAL_CHAT_MODEL=llama3.2
LOCAL_EMBED_MODEL=nomic-embed-text
PRIMARY_EMBED=text-embedding-3-small
TOP_K=5
DB_MIN_CONN=2
DB_MAX_CONN=20
STRICT_RAG_MODE=true
USE_OPENAI_CHAT=true
EOF
```

- [ ] **Step 3: Add .env to .gitignore (verify it's excluded)**

```bash
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
grep -q "^\.env\.production$" .gitignore || echo ".env.production" >> .gitignore
echo ".env and .env.production confirmed in .gitignore"
git status .env  # Must show: nothing to commit / not tracked
```
Expected: `.env` is NOT listed as a tracked file.

- [ ] **Step 4: Create scripts/inject-secrets.sh**

```bash
#!/bin/bash
# scripts/inject-secrets.sh
# Loads secrets from environment variables or a .env.production file.
# In CI/CD: export secrets before calling this script.
# Locally: place real values in .env.production (never committed).

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"

if [ -f "$ENV_FILE" ]; then
  echo "[inject-secrets] Loading from $ENV_FILE"
  set -a && source "$ENV_FILE" && set +a
else
  echo "[inject-secrets] No $ENV_FILE found — using existing environment variables"
fi

# Validate required secrets are present
REQUIRED=(
  POSTGRES_PASSWORD JWT_SECRET OPENAI_API_KEY
  MINIO_SECRET_KEY WORKER_INTERNAL_KEY ALE_MASTER_KEY
)
MISSING=()
for var in "${REQUIRED[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING+=("$var")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "[inject-secrets] ERROR: Missing required secrets: ${MISSING[*]}"
  exit 1
fi

echo "[inject-secrets] All required secrets present. Starting stack..."
exec docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d "$@"
```

```bash
chmod +x scripts/inject-secrets.sh
mkdir -p scripts
mv scripts/inject-secrets.sh scripts/inject-secrets.sh  # already there
```

- [ ] **Step 5: Write test for secret validation**

Add to `tests/security/test_port_exposure.py`:

```python
import os

REQUIRED_SECRETS = [
    "POSTGRES_PASSWORD",
    "JWT_SECRET",
    "OPENAI_API_KEY",
    "MINIO_SECRET_KEY",
    "WORKER_INTERNAL_KEY",
    "ALE_MASTER_KEY",
]

def test_no_default_placeholder_secrets():
    """All required secrets must be set and not contain placeholder text."""
    for var in REQUIRED_SECRETS:
        val = os.environ.get(var, "")
        assert val, f"Secret {var} is not set"
        assert "CHANGE_ME" not in val, f"Secret {var} still has placeholder value"
        assert len(val) >= 16, f"Secret {var} is too short (min 16 chars)"
```

- [ ] **Step 6: Run test (will pass only when real .env is used)**

```bash
python -m pytest tests/security/test_port_exposure.py::test_no_default_placeholder_secrets -v
```
Expected: PASS (your `.env` has real values, not `CHANGE_ME`).

- [ ] **Step 7: Commit**

```bash
git add .env.example scripts/inject-secrets.sh tests/security/test_port_exposure.py
git commit -m "security: add .env.example template and secrets injection script

- .env.example committed (template only, no real values)  
- .env and .env.production confirmed in .gitignore
- scripts/inject-secrets.sh validates required secrets before stack start
- Test verifies no CHANGE_ME placeholders in running environment

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Nginx Rate Limiting Per-User (not per-IP)

University WiFi means many students share one IP. IP-based rate limiting throttles everyone when one user spams. Use JWT sub claim for per-user limits via Nginx `$http_authorization` hash.

**Files:**
- Modify: `nginx/nginx.conf`

- [ ] **Step 1: Update nginx.conf to add per-user rate limit zone**

Replace the rate limit section in `nginx/nginx.conf`:

```nginx
    # Rate limiting: per-user (JWT present) or per-IP (no JWT)
    # Use Authorization header hash so shared IPs (university WiFi) don't block each other
    map $http_authorization $rate_limit_key {
        default         $binary_remote_addr;   # no JWT — limit by IP
        "~Bearer .+"    $http_authorization;   # JWT present — limit by token (≈ per user)
    }

    limit_req_zone $rate_limit_key zone=api:20m rate=60r/m;
    limit_req_zone $rate_limit_key zone=chat:20m rate=10r/m;
```

- [ ] **Step 2: Rebuild nginx and verify config is valid**

```bash
docker compose build nginx
docker compose up -d nginx
docker exec privacy-aware-nginx nginx -t
```
Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

- [ ] **Step 3: Commit**

```bash
git add nginx/nginx.conf
git commit -m "security: per-user rate limiting in nginx using JWT Authorization hash

University WiFi means many students share one IP. Rate limit zones now
key on the Authorization header (JWT token) when present, falling back
to IP address for unauthenticated requests. 10 chat req/min per user.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Run all security tests**

```bash
python -m pytest tests/security/ -v --no-header
```
Expected output:
```
tests/security/test_port_exposure.py::test_internal_port_not_exposed[localhost-5432-postgres] PASSED
tests/security/test_port_exposure.py::test_internal_port_not_exposed[localhost-6379-redis] PASSED
tests/security/test_port_exposure.py::test_internal_port_not_exposed[localhost-8000-chromadb] PASSED
tests/security/test_port_exposure.py::test_internal_port_not_exposed[localhost-8001-worker] PASSED
tests/security/test_port_exposure.py::test_internal_port_not_exposed[localhost-9000-minio-api] PASSED
tests/security/test_port_exposure.py::test_internal_port_not_exposed[localhost-9001-minio-console] PASSED
tests/security/test_port_exposure.py::test_internal_port_not_exposed[localhost-11434-ollama] PASSED
tests/security/test_port_exposure.py::test_https_endpoint_reachable PASSED
tests/security/test_port_exposure.py::test_http_redirects_to_https PASSED
tests/security/test_port_exposure.py::test_no_default_placeholder_secrets PASSED
tests/security/test_docker_image.py::test_no_debug_scripts_in_image PASSED
tests/security/test_csrf.py::test_chat_post_without_csrf_token_rejected PASSED
tests/security/test_csrf.py::test_get_request_no_csrf_required PASSED
====== 13 passed in 12.3s ======
```

- [ ] **Run existing 11-point demo test — confirm no regressions**

```bash
python -X utf8 backend/scripts/demo_test.py
```
Expected: `11/11 passed`

---

## Self-Review

**Spec coverage check:**
- ✅ External port mappings removed for all 7 internal services (Task 1)
- ✅ Nginx TLS with HTTP→HTTPS redirect (Task 2)
- ✅ Per-user rate limiting via JWT hash (Task 6)
- ✅ Debug scripts excluded from production image (Task 3)
- ✅ CSRF protection on state-changing routes (Task 4)
- ✅ Secrets validation + .env.example + .gitignore (Task 5)
- ✅ JWT refresh: already implemented in `backend/api/auth/jwtManager.js` — no task needed

**Placeholder scan:** No TBD or TODO present. All code blocks are complete.

**Type consistency:** `CSRF_COOKIE = '__csrf'` in csrf.js matches `getCookie('__csrf')` in Chat.jsx.

**Out of scope for this plan (separate plans):**
- DPDP consent/erasure/retention → Plan 2
- Structured logging / Prometheus → Plan 3
- GitHub Actions CI/CD → Plan 4
- Response confidence scores → Plan 5
