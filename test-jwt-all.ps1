# test-jwt-all.ps1
# Usage: .\test-jwt-all.ps1 -ApiUrl "http://127.0.0.1:3001" -TokenFile ".\dev_token.txt" -TestFile ".\test_upload.txt"
param(
  [string]$ApiUrl     = "http://127.0.0.1:3001",
  [string]$TokenFile  = ".\dev_token.txt",
  [string]$TestFile   = ".\test_upload.txt",
  [int]$TopK          = 3
)

function Load-Token {
  if (Test-Path $TokenFile) {
    $t = (Get-Content $TokenFile -Raw).Trim()
    if ($t) { return $t }
  }
  if ($env:DEV_JWT) { return $env:DEV_JWT.Trim() }
  Write-Error "Token not found. Create dev token first (use get-dev-token.ps1 or POST /api/dev/token)."
  exit 2
}

function Show-Heading($s) { Write-Host "`n===== $s =====" -ForegroundColor Cyan }

$token = Load-Token
Write-Host "Using token (first 20 chars): $($token.Substring(0, [math]::Min(20, $token.Length)))..." -ForegroundColor Green

$headers = @{ Authorization = "Bearer $token" }

# 1) Health check
Show-Heading "1) /api/health"
try {
  $h = Invoke-RestMethod -Method Get -Uri ("{0}/api/health" -f $ApiUrl) -Headers $headers -ContentType "application/json" -ErrorAction Stop
  Write-Host "Health:" ( ($h.status) ) -ForegroundColor Green
  $h.checks | ConvertTo-Json -Depth 4 | Write-Host
} catch {
  Write-Error "Health check failed: $($_.Exception.Message)"
}

# 2) Decode token (header/payload)
$token = (Get-Content .\dev_token.txt).Trim()
$parts = $token.Split('.')
$payload_b64url = $parts[1]
# convert base64url -> base64
$payload_b64 = $payload_b64url.Replace('-','+').Replace('_','/')
switch ($payload_b64.Length % 4) {
  2 { $payload_b64 += '==' }
  3 { $payload_b64 += '=' }
  default {}
}
$payload_json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload_b64))
$payload_json | ConvertFrom-Json | Format-List


# 3) Search
Show-Heading "3) POST /api/search"
$body = @{ query = "hello from jwt-test"; top_k = $TopK } | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Method Post -Uri ("{0}/api/search" -f $ApiUrl) -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop
  Write-Host "Search response success:" ($r.success) -ForegroundColor Green
  $r | ConvertTo-Json -Depth 4 | Write-Host
} catch {
  Write-Error "Search failed: $($_.Exception.Message)"
  if ($_.Exception.Response) { $_.Exception.Response.Content | Write-Host }
}

# 4) Chat
Show-Heading "4) POST /api/chat"
$body = @{ query = "Say hi in one sentence"; context = @{} } | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Method Post -Uri ("{0}/api/chat" -f $ApiUrl) -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop
  Write-Host "Chat response success:" ($r.success) -ForegroundColor Green
  $r | ConvertTo-Json -Depth 4 | Write-Host
} catch {
  Write-Error "Chat failed: $($_.Exception.Message)"
  if ($_.Exception.Response) { $_.Exception.Response.Content | Write-Host }
}

# 5) Documents list
Show-Heading "5) GET /api/documents"
try {
  $r = Invoke-RestMethod -Method Get -Uri ("{0}/api/documents" -f $ApiUrl) -Headers $headers -ErrorAction Stop
  Write-Host "Documents count:" ($r.pagination.total) -ForegroundColor Green
  $r.documents | ConvertTo-Json -Depth 4 | Write-Host
} catch {
  Write-Error "Documents list failed: $($_.Exception.Message)"
  if ($_.Exception.Response) { $_.Exception.Response.Content | Write-Host }
}

# 6) Upload file (create small test file if needed)
Show-Heading "6) POST /api/upload (multipart)"
if (-not (Test-Path $TestFile)) {
  "This is a small test file generated at $(Get-Date)" | Out-File -FilePath $TestFile -Encoding UTF8
  Write-Host "Created test file $TestFile"
}
try {
  # use -Form to send multipart/form-data; PowerShell converts file automatically
  $form = @{ file = Get-Item $TestFile }
  $r = Invoke-RestMethod -Method Post -Uri ("{0}/api/upload" -f $ApiUrl) -Headers $headers -Form $form -ErrorAction Stop
  Write-Host "Upload response:" ($r.success) -ForegroundColor Green
  $r | ConvertTo-Json -Depth 4 | Write-Host
  $uploadedId = $r.document.id
} catch {
  Write-Error "Upload failed: $($_.Exception.Message)"
  if ($_.Exception.Response) { $_.Exception.Response.Content | Write-Host }
}

# 7) Status for uploaded doc (if upload worked)
if ($null -ne $uploadedId) {
  Show-Heading "7) GET /api/documents/$uploadedId/status"
  try {
    Start-Sleep -Seconds 1
    $r = Invoke-RestMethod -Method Get -Uri ("{0}/api/documents/{1}/status" -f $ApiUrl, $uploadedId) -Headers $headers -ErrorAction Stop
    $r | ConvertTo-Json -Depth 4 | Write-Host
  } catch {
    Write-Error "Status check failed: $($_.Exception.Message)"
    if ($_.Exception.Response) { $_.Exception.Response.Content | Write-Host }
  }

  # 8) try download
  Show-Heading "8) GET /api/download/$uploadedId (download to .\\downloaded_testfile)"
  try {
    $out = "{0}\downloaded_testfile_{1}" -f (Get-Location).Path, $uploadedId
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("Authorization", "Bearer $token")
    $url = ("{0}/api/download/{1}" -f $ApiUrl, $uploadedId)
    $wc.DownloadFile($url, $out)
    Write-Host "Downloaded to $out" -ForegroundColor Green
  } catch {
    Write-Error "Download failed: $($_.Exception.Message)"
  }
}

Write-Host "`nALL TESTS DONE" -ForegroundColor Cyan
