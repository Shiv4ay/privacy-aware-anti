# generate_jwt.ps1 - produces a valid HS256 JWT every time

function Base64UrlEncode {
    param([byte[]] $bytes)

    $s = [Convert]::ToBase64String($bytes)
    $s = $s.TrimEnd('=')
    $s = $s.Replace('+','-').Replace('/','_')
    return $s
}

# ------------------------------------
# FIX: Force correct JSON string output
# ------------------------------------

$headerJson = '{"alg":"HS256","typ":"JWT"}'

# Epoch now
$now = [int](Get-Date -UFormat %s)

# Build payload manually (no ConvertTo-Json)
$payloadJson = "{""sub"":1,""username"":""siba"",""role"":""admin"",""iat"":$now,""exp"":$( $now + 604800 )}"

# Encode to bytes
$headerBytes = [System.Text.Encoding]::UTF8.GetBytes($headerJson)
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)

# Base64URL
$headerB  = Base64UrlEncode $headerBytes
$payloadB = Base64UrlEncode $payloadBytes
$signingInput = "$headerB.$payloadB"

# Secret
$secret = $env:JWT_SECRET
if (-not $secret) { $secret = 'jwtsecret123' }

# Sign
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)

$sigBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($signingInput))
$sig = Base64UrlEncode $sigBytes

$jwt = "$signingInput.$sig"

Write-Host "`nGenerated JWT:`n$jwt`n"

# Copy to clipboard (nice to have)
try { $jwt | Set-Clipboard } catch {}
