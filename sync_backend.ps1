#!/usr/bin/env pwsh
# Sync backend code changes to Docker container
# Run this after editing any backend files

param(
    [switch]$All,
    [switch]$Auth,
    [switch]$Admin,
    [switch]$Ingest
)

Write-Host "🔄 Syncing Backend Code to Container..." -ForegroundColor Cyan
Write-Host ""

if ($All -or (-not $Auth -and -not $Admin -and -not $Ingest)) {
    Write-Host "📋 Syncing ALL route files..." -ForegroundColor Yellow
    docker cp backend/api/routes/auth.js privacy-aware-api:/app/routes/auth.js
    docker cp backend/api/routes/session.js privacy-aware-api:/app/routes/session.js
    docker cp backend/api/routes/admin.js privacy-aware-api:/app/routes/admin.js
    docker cp backend/api/routes/ingest.js privacy-aware-api:/app/routes/ingest.js
    docker cp backend/api/index.js privacy-aware-api:/app/index.js
    docker cp backend/api/middleware/rateLimiter.js privacy-aware-api:/app/middleware/rateLimiter.js
} else {
    if ($Auth) {
        Write-Host "📋 Syncing auth files..." -ForegroundColor Yellow
        docker cp backend/api/routes/auth.js privacy-aware-api:/app/routes/auth.js
        docker cp backend/api/routes/session.js privacy-aware-api:/app/routes/session.js
    }
    if ($Admin) {
        Write-Host "📋 Syncing admin files..." -ForegroundColor Yellow
        docker cp backend/api/routes/admin.js privacy-aware-api:/app/routes/admin.js
    }
    if ($Ingest) {
        Write-Host "📋 Syncing ingest files..." -ForegroundColor Yellow
        docker cp backend/api/routes/ingest.js privacy-aware-api:/app/routes/ingest.js
    }
}

Write-Host ""
Write-Host "🔄 Restarting backend container..." -ForegroundColor Yellow
docker restart privacy-aware-api | Out-Null

Write-Host "⏳ Waiting for restart..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ Sync complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Usage examples:" -ForegroundColor Cyan
Write-Host "   ./sync_backend.ps1           # Sync all files"
Write-Host "   ./sync_backend.ps1 -Auth     # Sync only auth files"
Write-Host "   ./sync_backend.ps1 -Admin    # Sync only admin files"
Write-Host ""
