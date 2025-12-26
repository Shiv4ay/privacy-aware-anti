
Write-Host "=== Resuming System from Checkpoint ===" -ForegroundColor Cyan

# 1. Start Docker Containers
Write-Host "1. Starting Docker Containers..." -ForegroundColor Yellow
docker-compose up -d

# 2. Wait for Container Health
Write-Host "2. Waiting 30 seconds for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 3. Ensure Requeue Script is present (robustness against container recreation)
Write-Host "3. Restoring Checkpoint Logic..." -ForegroundColor Yellow
docker cp .\backend\worker\requeue_silent.py privacy-aware-worker:/app/requeue_silent.py

# 4. Execute Resume Logic
Write-Host "4. Resuming Queue (Finding all pending documents)..." -ForegroundColor Yellow
docker exec privacy-aware-worker python /app/requeue_silent.py

Write-Host "✅ Processing Resumed Successfully!" -ForegroundColor Green
Write-Host "You can now run .\monitor_chroma.ps1 to watch progress." -ForegroundColor Gray
