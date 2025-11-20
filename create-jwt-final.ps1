# create-jwt-final.ps1

$header = @{ alg = "HS256"; typ = "JWT" }

$payload = @{
    id      = 1          # VERY IMPORTANT
    userId  = 1
    user_id = 1
    username = "admin"
    exp = [int][Math]::Floor((Get-Date).ToUniversalTime().AddHours(2).Subtract([datetime]"1970-01-01").TotalSeconds)
}

function To-B64Url($json) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $b64   = [Convert]::ToBase64String($bytes)
    $b64.TrimEnd('=').Replace('+','-').Replace('/','_')
}

$h = To-B64Url (ConvertTo-Json $header -Compress)
$p = To-B64Url (ConvertTo-Json $payload -Compress)
$toSign = "$h.$p"

$key = "jwtsecret123"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($key)

$sig = [Convert]::ToBase64String(
    $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
).TrimEnd('=').Replace('+','-').Replace('/','_')

$jwt = "$h.$p.$sig"

$jwt | Out-File -FilePath ".\last_jwt.txt" -Encoding ascii -NoNewline
Write-Host "Generated JWT:"
Write-Host $jwt
