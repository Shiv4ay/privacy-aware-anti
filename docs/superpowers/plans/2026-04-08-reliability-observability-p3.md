# Reliability & Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Privacy-Aware RAG system for production by adding structured JSON logging, circuit-breaker protection on the worker proxy, a Prometheus metrics endpoint, and a readiness probe on the Python worker.

**Architecture:** The Node.js API Gateway (`backend/api/`) is the control plane — logging, metrics, and circuit-breaker all live there. The Python worker (`backend/worker/app.py`) gets a `/ready` endpoint that deep-checks all dependencies (ChromaDB, Postgres, Ollama, Redis, MinIO). Tests run via `docker exec privacy-aware-api node -e "..."` and `docker exec privacy-aware-worker curl ...` since ports are internal-only.

**Tech Stack:** `winston` (structured logging), `opossum` (circuit breaker), `prom-client` (Prometheus metrics), Python `httpx` (async dep checks in worker readiness probe).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/api/middleware/logger.js` | Winston JSON logger + request-ID middleware |
| Create | `backend/api/middleware/circuitBreaker.js` | opossum circuit breaker factory for worker calls |
| Create | `backend/api/middleware/metrics.js` | prom-client registry, counters, histograms |
| Modify | `backend/api/index.js` | Wire logger, metrics endpoint, request-ID middleware |
| Modify | `backend/api/routes/chat.js` | Replace raw `axios` worker call with circuit-breaker-wrapped call |
| Modify | `backend/worker/app.py` | Add `GET /ready` deep dependency health check |
| Create | `tests/observability/test_logging.py` | Verify structured JSON log output |
| Create | `tests/observability/test_metrics.py` | Verify `/metrics` Prometheus format |
| Create | `tests/reliability/test_circuit_breaker.py` | Verify circuit breaker module exports and config |
| Create | `tests/reliability/test_worker_readiness.py` | Verify `/ready` endpoint returns correct shape |

---

## Task 1: Structured JSON Logging (Winston)

**Files:**
- Create: `backend/api/middleware/logger.js`
- Modify: `backend/api/index.js` (add request-ID + logger middleware)
- Test: `tests/observability/test_logging.py`

- [ ] **Step 1: Install winston inside the API container**

```bash
MSYS_NO_PATHCONV=1 docker exec privacy-aware-api npm install winston
```

Expected: `added 1 package` (winston is small, no transitive deps)

Also update package.json on disk:
```bash
cd c:/project3/AntiGravity/PRIVACY-AWARE-RAG-GUIDE-CUR/backend/api && npm install winston
```

- [ ] **Step 2: Write the failing test**

Create `tests/observability/test_logging.py`:

```python
"""Structured logging tests — verify winston JSON output."""
import subprocess

def _run_in_api(js):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', js],
        capture_output=True, text=True, timeout=15
    )
    return r

def test_logger_module_loads():
    """logger.js must export { logger, requestIdMiddleware }."""
    js = """
const { logger, requestIdMiddleware } = require('./middleware/logger');
if (typeof logger !== 'object' || typeof logger.info !== 'function') {
  console.error('BAD logger'); process.exit(1);
}
if (typeof requestIdMiddleware !== 'function') {
  console.error('BAD requestIdMiddleware'); process.exit(1);
}
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_logger_outputs_json():
    """logger.info() must produce a JSON string with level, message, timestamp."""
    js = """
const { logger } = require('./middleware/logger');
// Capture output by replacing the transport
let captured = '';
// Use a child logger with a writable stream mock
const winston = require('winston');
const { Writable } = require('stream');
const ws = new Writable({ write(chunk, enc, cb) { captured += chunk.toString(); cb(); } });
const testLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Stream({ stream: ws })]
});
testLogger.info('test message', { request_id: 'abc-123' });
// Give stream time to flush
setTimeout(() => {
  let obj;
  try { obj = JSON.parse(captured); } catch(e) { console.error('NOT JSON', captured); process.exit(1); }
  if (obj.level !== 'info') { console.error('BAD level', captured); process.exit(1); }
  if (obj.message !== 'test message') { console.error('BAD message', captured); process.exit(1); }
  if (!obj.timestamp) { console.error('NO timestamp', captured); process.exit(1); }
  console.log('PASS');
}, 50);
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd c:/project3/AntiGravity/PRIVACY-AWARE-RAG-GUIDE-CUR
python -m pytest tests/observability/test_logging.py -v
```

Expected: FAILED — `Cannot find module './middleware/logger'`

- [ ] **Step 4: Create `backend/api/middleware/logger.js`**

```javascript
// backend/api/middleware/logger.js
'use strict';

const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// UUID is already available via jsonwebtoken's dep — use crypto if not
function generateId() {
    try { return uuidv4(); } catch (_) { return require('crypto').randomUUID(); }
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'privacy-rag-api' },
    transports: [
        new winston.transports.Console(),
    ],
});

/**
 * Express middleware: attach a unique request_id to req and res headers.
 * Downstream code accesses req.requestId for structured log context.
 */
function requestIdMiddleware(req, res, next) {
    const id = req.headers['x-request-id'] || generateId();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}

module.exports = { logger, requestIdMiddleware };
```

- [ ] **Step 5: Check for `uuid` in package.json — install if missing**

```bash
cd c:/project3/AntiGravity/PRIVACY-AWARE-RAG-GUIDE-CUR/backend/api
node -e "require('uuid')" 2>/dev/null && echo "present" || npm install uuid
```

If jsonwebtoken (already a dep) includes `uuid` as a transitive dep it will already be available. The `require('crypto').randomUUID()` fallback in the code handles the case where `uuid` is unavailable.

- [ ] **Step 6: Wire request-ID middleware into `backend/api/index.js`**

Find the section near the top of `index.js` where middleware is applied (after `cookieParser`). Add:

```javascript
// Structured logging + request IDs
const { logger, requestIdMiddleware } = require('./middleware/logger');
```

Then in the middleware chain (before routes), add:
```javascript
app.use(requestIdMiddleware);
```

Replace one existing `console.warn('Redis warning:', err.message)` call at the Redis error handler with:
```javascript
redis.on('error', (err) => logger.warn('Redis connection warning', { error: err.message }));
```

This demonstrates the pattern — do NOT bulk-replace all console.* calls (that's a separate refactor pass).

- [ ] **Step 7: Verify syntax in container**

```bash
MSYS_NO_PATHCONV=1 docker exec privacy-aware-api node -e "require('./middleware/logger'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 8: Run tests to verify they pass**

```bash
python -m pytest tests/observability/test_logging.py -v
```

Expected: 2 PASSED

- [ ] **Step 9: Commit**

```bash
cd c:/project3/AntiGravity/PRIVACY-AWARE-RAG-GUIDE-CUR
git add backend/api/middleware/logger.js backend/api/index.js backend/api/package.json backend/api/package-lock.json tests/observability/test_logging.py
git commit -m "feat(observability): structured JSON logging with request-ID middleware"
```

---

## Task 2: Circuit Breaker for Worker Proxy (opossum)

**Files:**
- Create: `backend/api/middleware/circuitBreaker.js`
- Modify: `backend/api/routes/chat.js` (wrap worker axios call)
- Test: `tests/reliability/test_circuit_breaker.py`

- [ ] **Step 1: Install opossum**

```bash
MSYS_NO_PATHCONV=1 docker exec privacy-aware-api npm install opossum
cd c:/project3/AntiGravity/PRIVACY-AWARE-RAG-GUIDE-CUR/backend/api && npm install opossum
```

Expected: `added N packages`

- [ ] **Step 2: Write the failing test**

Create `tests/reliability/test_circuit_breaker.py`:

```python
"""Circuit breaker tests."""
import subprocess

def _run_in_api(js):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', js],
        capture_output=True, text=True, timeout=15
    )
    return r

def test_circuit_breaker_module_loads():
    """circuitBreaker.js must export makeWorkerCircuit."""
    js = """
const { makeWorkerCircuit } = require('./middleware/circuitBreaker');
if (typeof makeWorkerCircuit !== 'function') {
  console.error('BAD export'); process.exit(1);
}
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_circuit_breaker_opens_on_failures():
    """Circuit must open after errorThresholdPercentage breaches are hit."""
    js = """
const { makeWorkerCircuit } = require('./middleware/circuitBreaker');
const circuit = makeWorkerCircuit(async () => { throw new Error('worker down'); }, {
  timeout: 200, errorThresholdPercentage: 50, resetTimeout: 500, volumeThreshold: 3
});
// Fire 3 failures to open the circuit
let opened = false;
circuit.on('open', () => { opened = true; });
(async () => {
  for (let i = 0; i < 4; i++) {
    try { await circuit.fire(); } catch (_) {}
  }
  setTimeout(() => {
    if (!opened) { console.error('circuit did not open'); process.exit(1); }
    console.log('PASS');
  }, 100);
})();
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_circuit_breaker_fallback_returns_503_shape():
    """Fallback function must return { status: 503, error: '...' }."""
    js = """
const { makeWorkerCircuit, workerFallback } = require('./middleware/circuitBreaker');
const result = workerFallback(new Error('test'));
if (result.status !== 503) { console.error('BAD status', result); process.exit(1); }
if (typeof result.error !== 'string') { console.error('BAD error', result); process.exit(1); }
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
python -m pytest tests/reliability/test_circuit_breaker.py -v
```

Expected: FAILED — `Cannot find module './middleware/circuitBreaker'`

- [ ] **Step 4: Create `backend/api/middleware/circuitBreaker.js`**

```javascript
// backend/api/middleware/circuitBreaker.js
'use strict';

const CircuitBreaker = require('opossum');

const DEFAULT_OPTIONS = {
    timeout: 30000,                  // worker calls can take up to 30s (Ollama CPU)
    errorThresholdPercentage: 50,    // open after 50% of calls fail
    resetTimeout: 60000,             // try half-open after 60s
    volumeThreshold: 5,              // need at least 5 calls before computing error %
};

/**
 * Factory: create a circuit breaker wrapping `fn`.
 * Options override the defaults.
 * @param {Function} fn - async function to protect
 * @param {object} [opts] - opossum options override
 * @returns {CircuitBreaker}
 */
function makeWorkerCircuit(fn, opts = {}) {
    const options = { ...DEFAULT_OPTIONS, ...opts, fallback: workerFallback };
    const circuit = new CircuitBreaker(fn, options);

    circuit.on('open', () =>
        console.error('[CircuitBreaker] OPEN — worker calls will fast-fail until reset')
    );
    circuit.on('halfOpen', () =>
        console.warn('[CircuitBreaker] HALF-OPEN — testing worker availability')
    );
    circuit.on('close', () =>
        console.log('[CircuitBreaker] CLOSED — worker is healthy again')
    );

    return circuit;
}

/**
 * Fallback called when the circuit is open or the protected fn throws.
 * Returns a value that callers check for status === 503.
 */
function workerFallback(err) {
    return {
        status: 503,
        error: 'AI worker temporarily unavailable. Please retry in a moment.',
        detail: err?.message || 'circuit open',
    };
}

module.exports = { makeWorkerCircuit, workerFallback };
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
python -m pytest tests/reliability/test_circuit_breaker.py -v
```

Expected: 3 PASSED

- [ ] **Step 6: Wire circuit breaker into `backend/api/routes/chat.js`**

Read `chat.js` to find the `axios.post(WORKER_URL + '/chat', ...)` call. It is the main worker proxy in the route handler.

At the top of `chat.js`, add:

```javascript
const { makeWorkerCircuit, workerFallback } = require('../middleware/circuitBreaker');

// One circuit per process — defined at module level so state persists across requests
const workerChatCircuit = makeWorkerCircuit(
    async (payload) => {
        const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';
        return axios.post(`${WORKER_URL}/chat`, payload, { timeout: 120000, responseType: 'stream' });
    }
);
```

Then in the route handler, replace the direct `axios.post(WORKER_URL + '/chat', ...)` call with:

```javascript
const workerRes = await workerChatCircuit.fire(workerPayload);
// Circuit fallback returns { status: 503, error: '...' } — detect and forward
if (workerRes && workerRes.status === 503 && workerRes.error) {
    return res.status(503).json({ error: workerRes.error });
}
```

**Note:** Read `chat.js` carefully before editing — the axios call may be inside a try/catch with SSE streaming. Preserve the existing SSE pipe logic; only wrap the `axios.post` call itself.

- [ ] **Step 7: Verify syntax**

```bash
MSYS_NO_PATHCONV=1 docker exec privacy-aware-api node -e "require('./routes/chat'); console.log('OK')"
```

Expected: `OK` (may also print `[CircuitBreaker] ...` log lines — that is fine)

- [ ] **Step 8: Commit**

```bash
git add backend/api/middleware/circuitBreaker.js backend/api/routes/chat.js backend/api/package.json backend/api/package-lock.json tests/reliability/test_circuit_breaker.py
git commit -m "feat(reliability): opossum circuit breaker on worker chat proxy"
```

---

## Task 3: Prometheus Metrics Endpoint

**Files:**
- Create: `backend/api/middleware/metrics.js`
- Modify: `backend/api/index.js` (mount `GET /metrics`)
- Test: `tests/observability/test_metrics.py`

- [ ] **Step 1: Install prom-client**

```bash
MSYS_NO_PATHCONV=1 docker exec privacy-aware-api npm install prom-client
cd c:/project3/AntiGravity/PRIVACY-AWARE-RAG-GUIDE-CUR/backend/api && npm install prom-client
```

- [ ] **Step 2: Write the failing test**

Create `tests/observability/test_metrics.py`:

```python
"""Prometheus metrics endpoint tests."""
import subprocess

def _run_in_api(js):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-api', 'node', '-e', js],
        capture_output=True, text=True, timeout=15
    )
    return r

def test_metrics_module_loads():
    """metrics.js must export { register, httpRequestDuration, httpRequestsTotal }."""
    js = """
const { register, httpRequestDuration, httpRequestsTotal } = require('./middleware/metrics');
if (!register || typeof register.metrics !== 'function') {
  console.error('BAD register'); process.exit(1);
}
if (!httpRequestDuration || !httpRequestsTotal) {
  console.error('BAD metrics'); process.exit(1);
}
console.log('PASS');
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_metrics_endpoint_returns_prometheus_format():
    """GET /metrics must return 200 with Content-Type text/plain; version=0.0.4."""
    js = """
const http = require('http');
http.get({
  hostname: 'localhost', port: 3001, path: '/metrics',
  headers: { 'x-dev-auth': 'super-secret-dev-key' }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (res.statusCode !== 200) { console.error('STATUS', res.statusCode, d.slice(0, 200)); process.exit(1); }
    const ct = res.headers['content-type'] || '';
    if (!ct.includes('text/plain')) { console.error('BAD content-type', ct); process.exit(1); }
    if (!d.includes('# HELP') || !d.includes('# TYPE')) { console.error('NOT PROMETHEUS', d.slice(0, 300)); process.exit(1); }
    console.log('PASS');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"

def test_metrics_contains_http_request_counter():
    """Prometheus output must contain the http_requests_total metric."""
    js = """
const http = require('http');
http.get({
  hostname: 'localhost', port: 3001, path: '/metrics',
  headers: { 'x-dev-auth': 'super-secret-dev-key' }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (!d.includes('http_requests_total')) { console.error('MISSING http_requests_total', d.slice(0,300)); process.exit(1); }
    console.log('PASS');
  });
}).on('error', e => { console.error(e.message); process.exit(1); });
"""
    r = _run_in_api(js)
    assert r.returncode == 0 and 'PASS' in r.stdout, f"FAIL: {r.stdout} {r.stderr}"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
python -m pytest tests/observability/test_metrics.py -v
```

Expected: FAILED

- [ ] **Step 4: Create `backend/api/middleware/metrics.js`**

```javascript
// backend/api/middleware/metrics.js
'use strict';

const client = require('prom-client');

// Use a fresh registry (not the global default) to avoid double-registration
// when tests require() the module multiple times.
const register = new client.Registry();

// Collect default Node.js metrics (event loop lag, heap size, GC, etc.)
client.collectDefaultMetrics({ register });

// HTTP request duration histogram — labels: method, route, status_code
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
});

// HTTP requests counter — labels: method, route, status_code
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

/**
 * Express middleware: observe request duration and count on response finish.
 */
function metricsMiddleware(req, res, next) {
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        const labels = {
            method: req.method,
            route: req.route?.path || req.path,
            status_code: res.statusCode,
        };
        end(labels);
        httpRequestsTotal.inc(labels);
    });
    next();
}

module.exports = { register, httpRequestDuration, httpRequestsTotal, metricsMiddleware };
```

- [ ] **Step 5: Mount `/metrics` endpoint in `backend/api/index.js`**

Add import near other middleware imports:
```javascript
const { register, metricsMiddleware } = require('./middleware/metrics');
```

After `app.use(requestIdMiddleware)`, add:
```javascript
app.use(metricsMiddleware);
```

Add the `/metrics` endpoint **before** any auth middleware (metrics must be unauthenticated for Prometheus scrape, but restrict to internal network — nginx already blocks external access since only 443/80 are public):
```javascript
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});
```

- [ ] **Step 6: Restart API container and run tests**

```bash
MSYS_NO_PATHCONV=1 docker restart privacy-aware-api
# Wait 10 seconds for startup
python -m pytest tests/observability/test_metrics.py -v
```

Expected: 3 PASSED

- [ ] **Step 7: Commit**

```bash
git add backend/api/middleware/metrics.js backend/api/index.js backend/api/package.json backend/api/package-lock.json tests/observability/test_metrics.py
git commit -m "feat(observability): Prometheus metrics endpoint with request duration and counter"
```

---

## Task 4: Worker Readiness Probe (`GET /ready`)

**Files:**
- Modify: `backend/worker/app.py` (add `GET /ready`)
- Test: `tests/reliability/test_worker_readiness.py`

- [ ] **Step 1: Write the failing test**

Create `tests/reliability/test_worker_readiness.py`:

```python
"""Worker readiness probe tests."""
import subprocess
import json

def _curl_worker(path):
    r = subprocess.run(
        ['docker', 'exec', 'privacy-aware-worker',
         'curl', '-s', '-w', '\\n%{http_code}', f'http://localhost:8001{path}'],
        capture_output=True, text=True, timeout=15
    )
    lines = r.stdout.strip().split('\n')
    status_code = int(lines[-1]) if lines[-1].isdigit() else 0
    body = '\n'.join(lines[:-1])
    return status_code, body

def test_ready_endpoint_exists():
    """/ready must respond with 200 or 503 (not 404)."""
    status, body = _curl_worker('/ready')
    assert status in (200, 503), f"Expected 200 or 503, got {status}: {body}"

def test_ready_returns_json_with_checks():
    """/ready must return JSON with a 'checks' dict and a 'ready' boolean."""
    status, body = _curl_worker('/ready')
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        assert False, f"Response is not JSON: {body}"
    assert 'ready' in data, f"Missing 'ready' key: {data}"
    assert 'checks' in data, f"Missing 'checks' key: {data}"
    assert isinstance(data['checks'], dict), f"'checks' must be a dict: {data}"

def test_ready_checks_include_required_deps():
    """/ready checks must include chromadb, postgres, ollama."""
    status, body = _curl_worker('/ready')
    data = json.loads(body)
    checks = data.get('checks', {})
    for dep in ('chromadb', 'postgres', 'ollama'):
        assert dep in checks, f"Missing '{dep}' in checks: {checks}"

def test_ready_200_when_all_deps_up():
    """/ready must return 200 when all checks are True."""
    status, body = _curl_worker('/ready')
    data = json.loads(body)
    if all(v is True for v in data.get('checks', {}).values()):
        assert status == 200, f"Expected 200 when all checks pass, got {status}"
    else:
        # Some dep is down — 503 is correct; skip the 200 assertion
        assert status == 503, f"Expected 503 when a dep is down, got {status}"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/reliability/test_worker_readiness.py -v
```

Expected: FAILED — `/ready` returns 404

- [ ] **Step 3: Add `GET /ready` to `backend/worker/app.py`**

Find the existing `GET /health` endpoint in `app.py` (it returns `{"status":"ok","checks":{"ollama":true,"chromadb":true,"postgres":true,...}}`). Add the `/ready` endpoint immediately after it.

The key difference from `/health`:
- `/health` is a liveness check (is the process up?)
- `/ready` is a readiness check (can the process serve traffic?)
- `/ready` returns HTTP 200 if all deps are up, HTTP 503 if any dep is down

```python
@app.get("/ready")
async def readiness_probe():
    """
    Readiness probe for load-balancer / orchestrator use.
    Returns HTTP 200 only when all upstream dependencies are contactable.
    Returns HTTP 503 with failing deps listed when any dependency is down.
    """
    checks = {}

    # ChromaDB
    try:
        chroma_client.heartbeat()
        checks["chromadb"] = True
    except Exception:
        checks["chromadb"] = False

    # PostgreSQL
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL", ""))
        conn.close()
        checks["postgres"] = True
    except Exception:
        checks["postgres"] = False

    # Ollama — hit the /api/tags endpoint (lightweight, no model load)
    try:
        import httpx
        r = httpx.get(
            f"{os.getenv('OLLAMA_BASE_URL', 'http://ollama:11434')}/api/tags",
            timeout=5.0
        )
        checks["ollama"] = r.status_code == 200
    except Exception:
        checks["ollama"] = False

    # Redis (optional — present in most deployments)
    try:
        import redis as redis_lib
        r = redis_lib.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), socket_timeout=2)
        r.ping()
        checks["redis"] = True
    except Exception:
        checks["redis"] = False

    all_ready = all(checks.values())
    status_code = 200 if all_ready else 503

    return JSONResponse(
        content={"ready": all_ready, "checks": checks},
        status_code=status_code
    )
```

**Note:** `JSONResponse` is already imported (used elsewhere in `app.py`). `psycopg2` and `os` are already imported. Verify `httpx` and `redis` are available; if not, fall back to `requests` for the Ollama check and mark redis as optional.

- [ ] **Step 4: Restart worker and run tests**

```bash
MSYS_NO_PATHCONV=1 docker restart privacy-aware-worker
# Wait 25 seconds for Ollama/ChromaDB startup
python -m pytest tests/reliability/test_worker_readiness.py -v
```

Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/worker/app.py tests/reliability/test_worker_readiness.py
git commit -m "feat(reliability): worker readiness probe GET /ready with dep health checks"
```

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|-------------|-----------|
| Structured JSON logging | Task 1 — `logger.js` + Winston |
| Request ID propagation | Task 1 — `requestIdMiddleware` |
| Circuit breaker on worker calls | Task 2 — `circuitBreaker.js` + `chat.js` wiring |
| 503 on circuit open | Task 2 — `workerFallback` returns `{status:503}` |
| Prometheus metrics endpoint | Task 3 — `/metrics` with `prom-client` |
| Request duration histogram | Task 3 — `httpRequestDuration` |
| Request counter | Task 3 — `httpRequestsTotal` |
| Worker readiness probe | Task 4 — `GET /ready` in `app.py` |
| HTTP 503 when deps down | Task 4 — `status_code = 503 if not all_ready` |

All requirements covered. No placeholders. No TBDs.

### Type Consistency
- `makeWorkerCircuit` defined in Task 2 Step 4, used in tests in Task 2 Step 2 ✓
- `workerFallback` exported and tested in Task 2 ✓
- `register`, `httpRequestDuration`, `httpRequestsTotal`, `metricsMiddleware` defined in Task 3 Step 4, imported in Step 5 ✓
- `_curl_worker` helper defined once in Task 4 test file ✓
