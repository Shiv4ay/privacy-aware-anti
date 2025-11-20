# ================================
# Phase 1 – Health Check Script
# ================================

$Api = "http://localhost:3001"
$Frontend = "http://localhost:3000"   # FIXED
$MinioUI = "http://localhost:9001"
$Chroma = "http://localhost:8000"
$Ollama = "http://localhost:11434"

Write-Host "=== Phase 1: Health Checks ==="
Write-Host ""

Write-Host "1) Docker Services:"
docker compose ps
Write-Host ""

Write-Host "2) Frontend Reachability ($Frontend):"
try {
    curl -I $Frontend -m 5 | Write-Host
} catch {
    Write-Host "Frontend not reachable: $($_.Exception.Message)"
}
Write-Host ""

Write-Host "3) API Health ($Api/api/health):"
try {
    $apiHealth = Invoke-RestMethod -Uri "$Api/api/health" -Method Get -TimeoutSec 5
    $apiHealth | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "API health failed: $($_.Exception.Message)"
}
Write-Host ""

Write-Host "4) MinIO Console:"
Write-Host "Open in browser: $MinioUI"
Write-Host ""

Write-Host "5) ChromaDB Collections ($Chroma/api/v2/collections):" # FIXED
try {
    curl "$Chroma/api/v2/collections" -m 5 | Write-Host
} catch {
    Write-Host "Chroma unreachable: $($_.Exception.Message)"
}
Write-Host ""

Write-Host "6) Ollama Status ($Ollama/api/version):"
try {
    curl "$Ollama/api/version" -m 5 | Write-Host
} catch {
    Write-Host "Ollama unreachable: $($_.Exception.Message)"
}
Write-Host ""

Write-Host "=== Phase 1 done ==="
