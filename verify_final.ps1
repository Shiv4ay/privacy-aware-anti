
# 1. Login
$authUrl = "http://localhost:3001/api/auth/login"
$loginBody = @{
    email = "admin@privacy-aware-rag.local"
    password = "password"
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod -Uri $authUrl -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginRes.accessToken
    if (-not $token) { throw "No token returned" }
    Write-Host "Got Token: $($token.Substring(0,10))..."
} catch {
    Write-Error "Login failed: $_"
    exit 1
}

# 2. Upload
$uploadUrl = "http://localhost:3001/api/upload"
$headers = @{ Authorization = "Bearer $token" }
$form = @{
    file = Get-Item "test_rag.txt"
}

Write-Host "Uploading test_rag.txt..."
try {
   # Using curl.exe for compatibility
   $argList = @("-X", "POST", "$uploadUrl", "-H", "Authorization: Bearer $token", "-F", "file=@test_rag.txt", "-s")
   $p = Start-Process -FilePath "curl.exe" -ArgumentList $argList -NoNewWindow -Wait -PassThru
   if ($p.ExitCode -eq 0) {
       Write-Host "Upload command executed."
   } else {
       Write-Error "Upload via curl failed with exit code $($p.ExitCode)"
   }
} catch {
   Write-Error "Upload Failed: $_"
   # Continue anyway in case it failed because it exists? No, uploading new file always succeeds with new key usually.
   # We will continue to see if search finds anything (maybe from previous attempts)
}

# Wait for worker processing
Write-Host "Waiting 5s for processing..."
Start-Sleep -Seconds 5

# 3. Search
Write-Host "Testing Search (org_id=1)..."
$searchUrl = "http://localhost:3001/api/search"
$searchBody = @{
    query = "retrieval"
    top_k = 3
    org_id = 1
    organization = "default"
} | ConvertTo-Json

# Add X-Organization header just in case context propagation needs it (though app.py fix uses body org_id)
$headers["X-Organization"] = "1"

try {
    $searchRes = Invoke-RestMethod -Uri $searchUrl -Method Post -Body $searchBody -ContentType "application/json" -Headers $headers
    $hits = $searchRes.results.Count
    Write-Host "Search Hits: $hits"
    if ($hits -gt 0) {
        Write-Host "Sample: $($searchRes.results[0].text)"
    } else {
        Write-Warning "0 Results Found"
    }
} catch {
    Write-Error "Search Failed: $_"
}

# 4. Chat
Write-Host "Testing Chat..."
$chatUrl = "http://localhost:3001/api/chat"
$chatBody = @{
    query = "What does this document say about privacy?"
    org_id = 1
    organization = "default"
} | ConvertTo-Json

try {
    $chatRes = Invoke-RestMethod -Uri $chatUrl -Method Post -Body $chatBody -ContentType "application/json" -Headers $headers
    Write-Host "Chat Response: $($chatRes.response)"
    Write-Host "Context Used: $($chatRes.context_used)"
    
    if ($chatRes.context_used) {
        Write-Host "VERIFICATION PASSED: RAG is working."
    } else {
        Write-Host "VERIFICATION FAILED: Context not used."
    }
} catch {
    Write-Error "Chat Failed: $_"
}
