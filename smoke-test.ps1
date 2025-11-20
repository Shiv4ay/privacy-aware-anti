<#
smoke-test.ps1
Simple smoke tests for local Privacy-Aware RAG stack.

Tests:
 - API /api/health (127.0.0.1:3001)
 - Worker /health (127.0.0.1:8001)
 - Chroma auth identity (127.0.0.1:8000/api/v2/auth/identity)
 - Ollama root (127.0.0.1:11434/) expects "Ollama is running"
 - MinIO root (127.0.0.1:9000/) expects HTTP 403 (AccessDenied) OR any 2xx/4xx response (reachable)

Usage:
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  .\smoke-test.ps1
#>

# CONFIG
$apiUrl      = "http://127.0.0.1:3001/api/health"
$workerUrl   = "http://127.0.0.1:8001/health"
$chromaUrl   = "http://127.0.0.1:8000/api/v2/auth/identity"
$ollamaUrl   = "http://127.0.0.1:11434/"
$minioUrl    = "http://127.0.0.1:9000/"

$maxRetries  = 6
$retryDelay  = 3   # seconds

# Helpers
function Write-Ok($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Test-Http($name, $url, [int[]] $okStatusCodes = @(200), [ScriptBlock] $bodyCheck = $null) {
    $attempt = 0
    while ($attempt -lt $maxRetries) {
        try {
            $attempt++
            # Use -SkipHttpErrorCheck to get StatusCode in older PowerShell; use Invoke-WebRequest for status
            $resp = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 10 -ErrorAction Stop
            $status = $resp.StatusCode
            if ($okStatusCodes -contains $status) {
                if ($bodyCheck -ne $null) {
                    try {
                        if (& $bodyCheck $resp) {
                            Write-Ok "$name responded $status (body check passed) on attempt $attempt"
                            return $true
                        } else {
                            Write-Warn "$name responded $status but body check failed on attempt $attempt"
                        }
                    } catch {
                        Write-Warn "$name body check threw error: $($_.Exception.Message)"
                    }
                } else {
                    Write-Ok "$name responded $status on attempt $attempt"
                    return $true
                }
            } else {
                Write-Warn "$name responded $status (not in expected list: $($okStatusCodes -join ', '))"
            }
        } catch {
            # show short message - don't flood with stack traces
            $msg = $_.Exception.Message
            Write-Warn "$name attempt $attempt failed: $msg"
        }
        Start-Sleep -Seconds $retryDelay
    }

    Write-Err "$name did not become healthy after $maxRetries attempts"
    return $false
}

# Run tests
$failures = 0

Write-Host "Starting smoke tests..." -ForegroundColor Cyan
Write-Host "Retries: $maxRetries, Delay: ${retryDelay}s`n"

# API health
if (-not (Test-Http "API /api/health" $apiUrl @(200))) { $failures++ }

# Worker health
if (-not (Test-Http "Worker /health" $workerUrl @(200))) { $failures++ }

# Chroma (auth identity)
if (-not (Test-Http "Chroma /api/v2/auth/identity" $chromaUrl @(200))) { $failures++ }

# Ollama root: check for 200 and body contains "Ollama is running"
$ollamaBodyCheck = {
    param($resp)
    $body = ""
    try { $body = $resp.Content } catch { $body = $resp.RawContent }
    return ($body -match "Ollama is running")
}
if (-not (Test-Http "Ollama /" $ollamaUrl @(200) $ollamaBodyCheck)) { $failures++ }

# MinIO root: MinIO often returns 403 for unauthenticated root; accept 200..499 but require reachable
$minioOk = 200..499
if (-not (Test-Http "MinIO / (reachable)" $minioUrl $minioOk)) { $failures++ }

# Optional: test API basic route / (if exists)
$apiRoot = "http://127.0.0.1:3001/"
try {
    $r = Invoke-WebRequest -Uri $apiRoot -Method Get -TimeoutSec 6 -ErrorAction Stop
    Write-Host "`nAPI root returned status $($r.StatusCode)"
} catch {
    Write-Warn "API root request failed: $($_.Exception.Message)"
}

# Summary
Write-Host "`nSUMMARY" -ForegroundColor Cyan
if ($failures -eq 0) {
    Write-Ok "All smoke tests passed."
    exit 0
} else {
    Write-Err "$failures smoke test(s) failed."
    exit 1
}
