
Write-Host "Monitoring ChromaDB Embedding Count (Events per 5 seconds)..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray

# Define paths
$LocalScript = "c:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\worker\check_chroma.py"
$ContainerPath = "/app/check_chroma.py"

while ($true) {
    try {
        # 1. Self-Healing: Check if script exists, copy if missing
        $check = docker exec privacy-aware-worker ls $ContainerPath 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Restoring check script to container..." -ForegroundColor Yellow
            docker cp $LocalScript privacy-aware-worker:$ContainerPath
        }

        # 2. Run the check
        $output = docker exec privacy-aware-worker python $ContainerPath
        
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] $output" -ForegroundColor Green
    }
    catch {
        Write-Host "Error checking status. Is the worker running?" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 5
}
