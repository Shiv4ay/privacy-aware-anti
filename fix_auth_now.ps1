#!/usr/bin/env pwsh
# Quick fix for authentication redirect loop
# Run this whenever auth stops working

Write-Host "🔧 Applying Authentication Fix..." -ForegroundColor Cyan

# 1. Copy fixed auth.js
Write-Host "📋 Copying auth.js..." -ForegroundColor Yellow
docker cp backend/api/routes/auth.js privacy-aware-api:/app/routes/auth.js

# 2. Copy session.js
Write-Host "📋 Copying session.js..." -ForegroundColor Yellow
docker cp backend/api/routes/session.js privacy-aware-api:/app/routes/session.js

# 3. Restart backend
Write-Host "🔄 Restarting backend..." -ForegroundColor Yellow
docker restart privacy-aware-api | Out-Null

# 4. Wait for restart
Write-Host "⏳ Waiting for backend to restart..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# 5. Test the fix
Write-Host "🧪 Testing authentication flow..." -ForegroundColor Yellow
try {
    $loginBody = @{email="admin@privacy-aware-rag.local";password="password"} | ConvertTo-Json
    $loginResp = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    
    $token = ($loginResp.Content | ConvertFrom-Json).accessToken
    
    $orgBody = @{org_id="university"} | ConvertTo-Json
    $orgResp = Invoke-WebRequest -Uri "http://localhost:3001/api/session/set-org" -Method POST -Body $orgBody -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -UseBasicParsing -ErrorAction Stop
    
    $newToken = ($orgResp.Content | ConvertFrom-Json).token
    
    $meResp = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/me" -Method GET -Headers @{Authorization="Bearer $newToken"} -UseBasicParsing -ErrorAction Stop
    
    $user = $meResp.Content | ConvertFrom-Json
    
    if ($user.user.organization) {
        Write-Host ""
        Write-Host "✅ SUCCESS! Authentication flow is working." -ForegroundColor Green
        Write-Host "   User: $($user.user.email)" -ForegroundColor Green
        Write-Host "   Organization: $($user.user.organization)" -ForegroundColor Green
        Write-Host "   Role: $($user.user.role)" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ FAILED: User has no organization in response" -ForegroundColor Red
        Write-Host "Response: $($meResp.Content)" -ForegroundColor Red
    }
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Hard refresh browser (Ctrl+Shift+R)"
Write-Host "   2. Clear localStorage in console: localStorage.clear()"
Write-Host "   3. Login → Select Org → Continue"
Write-Host "   4. Should reach dashboard! 🎉"
Write-Host ""
