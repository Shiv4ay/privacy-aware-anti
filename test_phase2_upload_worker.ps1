# ================================
# Phase 2 – Upload -> Worker -> Index
# ================================

Param(
  [string]$FilePath = "C:\Users\sibas\Downloads\project litreture survey\16225ijaia03.pdf",
  [int]$PollTimeoutSec = 180
)

$ApiBase = "http://localhost:3001"
$DevKey = "super-secret-dev-key"   # From DEV_AUTH_KEY

Write-Host "=== Phase 2: Upload -> Worker -> Index ==="

if (-Not (Test-Path $FilePath)) {
  Write-Host "ERROR: sample file not found at $FilePath"
  exit 2
}

try {
  Write-Host "Uploading to $ApiBase/api/documents/upload ..."
  $resp = Invoke-RestMethod -Uri "$ApiBase/api/documents/upload" `
    -Method Post `
    -Headers @{ "x-dev-auth" = $DevKey } `
    -Form @{ file = Get-Item $FilePath } `
    -TimeoutSec 60
} catch {
  Write-Host "Primary upload failed, trying fallback..."
  try {
    $resp = Invoke-RestMethod -Uri "$ApiBase/api/upload" `
      -Method Post `
      -Headers @{ "x-dev-auth" = $DevKey } `
      -Form @{ file = Get-Item $FilePath } `
      -TimeoutSec 60
  } catch {
    Write-Host "Upload failed: $($_.Exception.Message)"
    exit 3
  }
}

Write-Host "Upload response:"
$resp | ConvertTo-Json -Depth 6 | Write-Host

$docId = $resp.docId

if (-not $docId) {
  Write-Host "No docId returned."
  exit 4
}

Write-Host "Polling document status for docId = $docId ..."
$deadline = (Get-Date).AddSeconds($PollTimeoutSec)

while ((Get-Date) -lt $deadline) {
  try {
    $meta = Invoke-RestMethod -Uri "$ApiBase/api/documents/$docId/status" `
      -Headers @{ "x-dev-auth" = $DevKey } `
      -Method Get

    Write-Host "Status: $($meta.document.status)"

    if ($meta.document.status -eq "indexed" -or $meta.document.status -eq "processed") {
      Write-Host "Document indexed successfully!"
      $meta | ConvertTo-Json -Depth 6 | Write-Host
      exit 0
    }
  } catch {}

  Start-Sleep -Seconds 5
}

Write-Host "TIMEOUT waiting for indexing."
exit 5
