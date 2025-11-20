# create-jwt.ps1
# Generates an HS256 JWT compatible with your API (uses JWT_SECRET env or default)
Param(
  [int]$HoursValid = 1
)

$jwtSecret = $env:JWT_SECRET
if (-not $jwtSecret) { $jwtSecret = "jwtsecret123" }   # matches your env if not set

function To-Base64Url($bytes) {
    $b = [Convert]::ToBase64String($bytes)
    return $b.TrimEnd('=') -replace '\+','-' -replace '/','_'
}

# header
$header = @{ alg = "HS256"; typ = "JWT" } | ConvertTo-Json -Compress
# payload - change userId/username to match your app's expectations
$exp = [int]((Get-Date).ToUniversalTime().AddHours($HoursValid).Subtract([datetime]'1970-01-01T00:00:00Z').TotalSeconds)
$payload = @{ userId = 1; username = "admin"; exp = $exp } | ConvertTo-Json -Compress

$h64 = To-Base64Url([Text.Encoding]::UTF8.GetBytes($header))
$p64 = To-Base64Url([Text.Encoding]::UTF8.GetBytes($payload))
$toSign = "$h64.$p64"

# HMACSHA256 sign
# Use explicit constructor that accepts key bytes for compatibility
$keyBytes = [Text.Encoding]::UTF8.GetBytes($jwtSecret)
$hmac = New-Object System.Security.Cryptography.HMACSHA256 ($keyBytes)
$sigBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
$sig = To-Base64Url($sigBytes)

$jwt = "$toSign.$sig"

# Save
$jwt | Set-Content -Path .\last_jwt.txt -Encoding utf8

Write-Host "JWT saved to .\last_jwt.txt (length: $($jwt.Length))"
Write-Host "First 80 chars:`n$($jwt.Substring(0,[Math]::Min(80,$jwt.Length)))"
