# Save this as phase3_check.ps1 and run from project root: .\phase3_check.ps1

$ErrorActionPreference = 'SilentlyContinue'

function Info($s){ Write-Host "`n=== $s ===" -ForegroundColor Cyan }
function OK($s){ Write-Host "  [OK] $s" -ForegroundColor Green }
function Fail($s){ Write-Host "  [FAIL] $s" -ForegroundColor Red }

# Basic config (edit if your ports differ)
$services = @{
  api = @{ host = "http://localhost:3001" }
  frontend = @{ host = "http://localhost:3000" }
  chromadb = @{ host = "http://localhost:8000" }
  minio = @{ host = "http://localhost:9000" }
  ollama = @{ host = "http://localhost:11434" }
  postgres = @{ host = "postgres"; port = 5432 }
  redis = @{ host = "localhost"; port = 6379 }
  worker = @{ host = "http://localhost:8001" }
}

$summary = [ordered]@{}
$start = Get-Date

Info "1) Docker Compose status"
docker compose ps
$summary["docker_compose_ps"] = "printed"

# get container ids for helpful services
Info "2) Container IDs"
$svcNames = "api","worker","minio","ollama","postgres","redis","chromadb","frontend"
foreach($s in $svcNames){
  $cid = docker compose ps -q $s
  if ($cid -and $cid.Trim() -ne ""){ OK "$s => $cid"; $summary["container_$s"] = $cid }
  else { Fail "$s not found (service name may differ)"; $summary["container_$s"] = $null }
}

# helper for HTTP checks
function HttpGet($url, $timeoutSec=10){
  try {
    $r = Invoke-WebRequest -Uri $url -Method Get -UseBasicParsing -TimeoutSec $timeoutSec
    return @{ ok = $true; status = $r.StatusCode; text = $r.RawContent }
  } catch {
    return @{ ok = $false; err = $_.Exception.Message }
  }
}

function HttpPostJson($url, $body, $timeoutSec=20){
  try {
    $r = Invoke-RestMethod -Uri $url -Method Post -Body ($body | ConvertTo-Json -Depth 6) -ContentType 'application/json' -TimeoutSec $timeoutSec
    return @{ ok = $true; json = $r }
  } catch {
    return @{ ok = $false; err = $_.Exception.Message; raw = $_.Exception.Response -ne $null ? (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() : $null }
  }
}

# 3) Service HTTP sanity checks
Info "3) HTTP endpoint health checks"
# API root
$apiRoot = HttpGet($services.api.host)
if ($apiRoot.ok){ OK "API reachable at $($services.api.host) (status $($apiRoot.status))"; $summary["api_http"] = "up" } else { Fail "API unreachable: $($apiRoot.err)"; $summary["api_http"] = "down" }

# Worker basic endpoint tests: /embed (POST small test)
$embedTestBody = @{ text = "health-check" }
$workerEmbed = HttpPostJson("$($services.worker.host)/embed", $embedTestBody)
if ($workerEmbed.ok){ OK "Worker /embed reachable"; $summary["worker_embed"] = "ok" } else { Fail "Worker /embed failed: $($workerEmbed.err)"; $summary["worker_embed"] = "fail" }

# Search quick test (if exists)
$searchBody = @{ query = "healthcare chatbot summary"; top_k = 3 }
$workerSearch = HttpPostJson("$($services.worker.host)/search", $searchBody)
if ($workerSearch.ok){ OK "Worker /search responded"; $summary["worker_search"] = "ok" } else { Fail "Worker /search failed or not present: $($workerSearch.err)"; $summary["worker_search"] = "fail" }

# Ollama embedding test (direct)
Info "4) Ollama embedding test (direct)"
$ollamaBody = @{ model = "mxbai-embed-large:latest"; prompt = "hello privacy rag test embedding" }
$ollama = HttpPostJson("$($services.ollama.host)/api/embeddings", $ollamaBody, 30)
if ($ollama.ok -and $ollama.json.embedding -ne $null -and $ollama.json.embedding.Count -gt 0){
  OK "Ollama returned embedding (len=$($ollama.json.embedding.Count))"
  $summary["ollama_embed"] = "ok"
} elseif ($ollama.ok -and $ollama.json.embedding -ne $null -and $ollama.json.embedding.Count -eq 0){
  Fail "Ollama returned empty embedding array"
  $summary["ollama_embed"] = "empty"
} else {
  Fail "Ollama call failed: $($ollama.err)"; $summary["ollama_embed"] = "fail"
}

# 5) Check MinIO: list objects
Info "5) MinIO object list (from worker container python - safer for env vars)"
$minioList = docker compose exec worker python -c "from minio import Minio; import os,sys; c=Minio(f\"{os.environ.get('MINIO_ENDPOINT')}:{os.environ.get('MINIO_PORT')}\", access_key=os.environ.get('MINIO_ACCESS_KEY'), secret_key=os.environ.get('MINIO_SECRET_KEY'), secure=False); \
b=os.environ.get('MINIO_BUCKET'); \
try:\n  objs=list(c.list_objects(b, recursive=True));\n  print('OK:'+','.join([o.object_name for o in objs]) if objs else 'OK:<no-objects>')\nexcept Exception as e:\n  print('ERR:'+str(e))" 2>&1

if ($minioList -match '^OK:'){
  $objs = $minioList -replace '^OK:',''
  OK "MinIO reachable. Objects: $objs"
  $summary["minio_objects"] = $objs
} elseif ($minioList -match '^OK:<no-objects>'){
  OK "MinIO reachable. No objects in bucket"
  $summary["minio_objects"] = "<none>"
} else {
  Fail "MinIO list failed: $minioList"
  $summary["minio_objects"] = "fail"
}

# 6) Redis queue length for document_jobs
Info "6) Redis queue check (document_jobs)"
$redisLen = docker compose exec -T redis sh -c "redis-cli LLEN document_jobs" 2>&1
if ($redisLen -match '^\d+$'){ OK "Redis document_jobs length = $redisLen"; $summary["redis_queue_len"] = [int]$redisLen }
else { Fail "Redis check failed: $redisLen"; $summary["redis_queue_len"] = "fail" }

# 7) Postgres readiness
Info "7) Postgres readiness (pg_isready inside postgres container)"
$pgReady = docker compose exec postgres pg_isready -U admin 2>&1
if ($pgReady -match 'accepting connections'){ OK "Postgres accepting connections"; $summary["postgres"] = "accepting" }
elseif ($pgReady -match 'no response'){ Fail "Postgres no response: $pgReady"; $summary["postgres"] = "noresponse" }
else { Fail "Postgres check: $pgReady"; $summary["postgres"] = "unknown" }

# 8) Chroma pre-flight (API)
Info "8) Chroma health / pre-flight"
$chroma = HttpGet("$($services.chromadb.host)/api/v2/pre-flight-checks", 10)
if ($chroma.ok){ OK "Chroma pre-flight OK (status $($chroma.status))"; $summary["chroma"] = "ok" }
else { Fail "Chroma pre-flight failed: $($chroma.err)"; $summary["chroma"] = "fail" }

# 9) Quick sanity: worker logs recent lines (last 100)
Info "9) Tail worker logs (last 200 lines)"
docker compose logs --tail 200 worker

# Final summary
$end = Get-Date
$dur = [int]($end - $start).TotalSeconds
Info "SUMMARY (run time: ${dur}s)"
foreach($k in $summary.Keys){
  $v = $summary[$k]
  if ($v -eq $null -or $v -eq "fail"){ Write-Host (" - {0} : {1}" -f $k, $v) -ForegroundColor Red }
  else { Write-Host (" - {0} : {1}" -f $k, $v) -ForegroundColor Green }
}

Write-Host "`nIf you want, save the output to a file: .\phase3_check.ps1 | Tee-Object report.txt"
