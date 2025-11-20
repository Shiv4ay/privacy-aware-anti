# test_phase3_search_rbac_redaction.ps1
Param(
  [string]$Query = "contact email pesuniversity@pes.edu",
  [int]$TopK = 5
)

$ApiBase = "http://localhost:3001"
$DevKeyHeaderName = "x-dev-auth-key"
$DevKey = "super-secret-dev-key"

Write-Host "=== Phase 3: Obtain dev JWT, Semantic Search + RBAC + Redaction ==="
Write-Host "Query: $Query"

# Build dev-key header dictionary
$devHeaders = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
$devHeaders.Add($DevKeyHeaderName, $DevKey)
$devHeaders.Add("Content-Type", "application/json")

# Get JWT
try {
  Write-Host "Requesting dev JWT from $ApiBase/api/dev/token ..."
  $tokenResp = Invoke-RestMethod -Uri "$ApiBase/api/dev/token" -Method Post -Headers $devHeaders -Body "{}" -TimeoutSec 10
  if (-not $tokenResp -or -not $tokenResp.token) {
    Write-Host "Failed to get token. Raw response:"
    $tokenResp | ConvertTo-Json -Depth 5 | Write-Host
    exit 2
  }
  $jwt = $tokenResp.token
  Write-Host "Obtained JWT (length): $($jwt.Length)"
} catch {
  Write-Host "Dev token request failed: $($_.Exception.Message)"
  exit 2
}

# Prepare Authorization header
$authHeaders = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
$authHeaders.Add("Authorization", "Bearer $jwt")
$authHeaders.Add("Content-Type", "application/json")

# Call /api/search (note: your API expects JSON body with 'query' and 'top_k')
$body = @{ query = $Query; top_k = $TopK } | ConvertTo-Json

try {
  $res = Invoke-RestMethod -Uri "$ApiBase/api/search" -Method Post -Headers $authHeaders -Body $body -TimeoutSec 30
} catch {
  Write-Host "Search API call failed: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    try {
      $text = $_.Exception.Response.GetResponseStream() | % { $_ } # best-effort
      Write-Host "Response body (attempt): $text"
    } catch {}
  }
  exit 3
}

Write-Host "Search response (raw):"
$res | ConvertTo-Json -Depth 6 | Write-Host

# Simple redaction detection
$joined = ($res.results | Out-String)
if ($joined -match "\[REDACTED\]" -or $joined -match "REDACTED" -or $joined -match "\*{3,}") {
  Write-Host "PII redaction tokens detected in results."
} else {
  Write-Host "No obvious redaction tokens detected in results."
}

# Optional: fetch admin audit logs (if endpoint exists)
try {
  $audit = Invoke-RestMethod -Uri "$ApiBase/api/admin/audit?limit=10" -Method Get -Headers $authHeaders -TimeoutSec 10
  Write-Host "`nAudit sample:"
  $audit | ConvertTo-Json -Depth 6 | Write-Host
} catch {
  Write-Host "Could not fetch audit logs (may be disabled or endpoint missing): $($_.Exception.Message)"
}

Write-Host "=== Phase 3 done ==="
