param (
  [string]$Token = ''
)

# if token not passed, get from dev endpoint using DEV_AUTH_KEY env var
if (-not $Token) {
  $devKey = $env:DEV_AUTH_KEY
  if (-not $devKey) {
    Write-Host "DEV_AUTH_KEY not set. Set env var or pass -Token."
    exit 1
  }
  $json = & curl.exe -sS -X POST "http://127.0.0.1:3001/api/dev/token" -H "Content-Type: application/json" -H "x-dev-auth-key: $devKey" --data-raw "{}"
  try {
    $token = ($json | ConvertFrom-Json).token
  } catch {
    Write-Host "Failed to get token. Response:`n$json"
    exit 1
  }
} else {
  $token = $Token
}

$authHeader = "Authorization: Bearer $token"

& curl.exe -v "http://127.0.0.1:3001/api/search" `
  -H "Content-Type: application/json" `
  -H $authHeader `
  --data-raw '{"query":"hello from siba","top_k":3}'
