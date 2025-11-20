param(
  [string]$ApiUrl = "http://127.0.0.1:3001",
  [string]$DevKey = "super-secret-dev-key",
  [string]$OutFile = ".\dev_token.txt"
)

try {
  # Build JSON body (increase depth so arrays/objects are preserved)
  $bodyObj = @{
    key  = $DevKey
    user = @{
      id = 1
      username = "siba"
      roles = @("admin")
    }
  }
  $body = $bodyObj | ConvertTo-Json -Depth 5

  Write-Host "Posting to $ApiUrl/api/dev/token ..."
  $resp = Invoke-RestMethod -Method Post -Uri ("{0}/api/dev/token" -f $ApiUrl) -Body $body -ContentType "application/json"

  if (-not $resp.token) {
    Write-Error "No token received in response. Full response:"
    $resp | ConvertTo-Json -Depth 5 | Write-Host
    exit 2
  }

  $token = $resp.token.ToString().Trim()

  # Save token as ASCII (no BOM)
  Set-Content -Path $OutFile -Value $token -Encoding ASCII

  Write-Host "Saved dev token to $OutFile"
  # Optionally set env var for current session
  $env:DEV_JWT = $token
  Write-Host "DEV_JWT set in current session"
  exit 0
} catch {
  Write-Error "Failed to fetch dev token: $($_.Exception.Message)"
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
    Write-Error "HTTP Status: $($_.Exception.Response.StatusCode.Value__)"
  }
  exit 1
}
