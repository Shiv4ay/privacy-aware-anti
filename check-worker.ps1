# ==============================================
# check-worker.ps1 – Diagnostics for Worker (Windows PowerShell)
# ==============================================

Write-Host "`n🚀 Checking Privacy-Aware Worker status...`n"

# 1️⃣ List all FastAPI routes inside worker container
Write-Host "→ Listing registered FastAPI routes (via Python exec)...`n"

$pythonCommand = @'
import json, app
routes = [{"path": r.path, "methods": list(r.methods)} for r in app.app.routes]
print(json.dumps(routes, indent=2))
'@

docker compose exec worker python -c $pythonCommand

# 2️⃣ Test /health endpoint inside container
Write-Host "`n→ Testing internal /health endpoint`n"
try {
    docker compose exec worker curl -sS http://127.0.0.1:8001/health
} catch {
    Write-Host "❌ /health not reachable or app not running"
}

# 3️⃣ Test /search endpoint inside container
Write-Host "`n→ Testing /search endpoint`n"
$jsonBody = '{"query":"test ping","top_k":1}'
docker compose exec worker curl -sS -X POST http://127.0.0.1:8001/search -H "Content-Type: application/json" -d $jsonBody

# 4️⃣ Show recent worker logs
Write-Host "`n→ Last 50 worker log lines:`n"
docker compose logs --no-color --tail 50 worker

Write-Host "`n✅ Done. Review results above.`n"
