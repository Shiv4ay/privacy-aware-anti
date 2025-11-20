param(
  [string]$ApiUrl = "http://127.0.0.1:3001",
  [string]$FilePath = "C:\Users\sibas\Downloads\Generating_Is_Believing_Membership_Inference_Attacks_against_Retrieval-Augmented_Generation.pdf",
  [string]$JwtSecret = "jwtsecret123",
  [int]$HoursValid = 4,
  [switch]$AppendNotes
)

function b64url([byte[]]$bytes) {
    $b = [Convert]::ToBase64String($bytes)
    $b = $b.TrimEnd('=') -replace '\+','-' -replace '/','_'
    return $b
}
function b64url-string([string]$s) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($s)
    return b64url $bytes
}

# Robust epoch seconds calculation (works on Windows PowerShell)
function Get-EpochSeconds([DateTime]$dt) {
    $utc = $dt.ToUniversalTime()
    $epoch = [DateTime]::SpecifyKind((Get-Date "1970-01-01T00:00:00Z"), [System.DateTimeKind]::Utc)
    $seconds = [int][Math]::Floor(($utc - $epoch).TotalSeconds)
    return $seconds
}

function New-JwtHS256 {
    param(
        [string]$secret,
        [int]$userid = 1,
        [string]$username = "admin",
        [int]$hoursValid = 4
    )

    $headerObj = @{ alg = "HS256"; typ = "JWT" }
    $payloadObj = @{
        userId = $userid
        username = $username
        exp = (Get-EpochSeconds((Get-Date).AddHours($hoursValid)))
    }

    $headerJson = (ConvertTo-Json $headerObj -Compress)
    $payloadJson = (ConvertTo-Json $payloadObj -Compress)

    $h = b64url-string $headerJson
    $p = b64url-string $payloadJson
    $toSign = "$h.$p"

    # HMAC-SHA256 signature
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $sigBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($toSign))
    $sig = b64url $sigBytes

    return "$h.$p.$sig"
}

Write-Host "`n=== upload-and-verify-fixed starting ===`n"

if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 2
}

# Generate token & save
$jwt = New-JwtHS256 -secret $JwtSecret -hoursValid $HoursValid
$jwt | Out-File -FilePath .\last_jwt.txt -Encoding utf8
Write-Host "Generated JWT (first 100 chars): $($jwt.Substring(0,[Math]::Min($jwt.Length,100)))..."
Write-Host "Token length:" $jwt.Length
Write-Host "Token exp (epoch):" ((($jwt.Split('.')[1]) -replace '-','+' -replace '_','/') | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($_).PadRight([Math]::Ceiling(($_).Length/4)*4,'='))) } ) 2>$null

$uploadUrl = ($ApiUrl.TrimEnd('/') + "/api/upload")
Write-Host "`nUploading file to: $uploadUrl"
Write-Host "File: $FilePath`n"

$headers = @{ Authorization = "Bearer $jwt" }

try {
    $resp = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $headers -Form @{ file = Get-Item $FilePath } -TimeoutSec 300 -ErrorAction Stop
    Write-Host "`n=== Upload succeeded ==="
    $resp | ConvertTo-Json -Depth 6
    $succeeded = $true
} catch {
    $succeeded = $false
    $ex = $_.Exception
    Write-Host "`n=== Upload FAILED ==="
    Write-Host "Exception type: $($ex.GetType().FullName)"

    if ($ex.Response -ne $null) {
        try {
            $respMsg = $ex.Response
            if ($respMsg.StatusCode -ne $null) { Write-Host "StatusCode: $($respMsg.StatusCode)"; }
            if ($respMsg.Content -ne $null) {
                $body = $respMsg.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                Write-Host "Body:`n$body"
            } else {
                Write-Host "No .Content on response object."
            }
        } catch {
            try {
                $r = $ex.Response
                $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
                $body = $sr.ReadToEnd(); $sr.Close()
                Write-Host "Body (WebException):`n$body"
            } catch {
                Write-Host "Could not read error body: $($_.Exception.Message)"
            }
        }
    } else {
        Write-Host "No response object. Message:`n$($ex.Message)"
    }
}

if ($AppendNotes) {
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    if ($succeeded) {
        $note = "## Upload note – $stamp`n- Upload succeeded: $FilePath`n- Endpoint: $uploadUrl`n"
        $note | Out-File -FilePath .\fixed_notes.md -Encoding utf8 -Append
        Write-Host "`nAppended note to fixed_notes.md"
    } else {
        $note = "## Upload note – $stamp`n- Upload FAILED for: $FilePath`n- Endpoint: $uploadUrl`n"
        $note | Out-File -FilePath .\fixed_notes.md -Encoding utf8 -Append
        Write-Host "`nAppended failure note to fixed_notes.md"
    }
}

Write-Host "`n=== Immediate checks if you still see Unauthorized ==="
Write-Host "1) Inspect the token you generated:"
Write-Host "   Get-Content .\\last_jwt.txt -Raw"
Write-Host "2) Ensure API container JWT secret matches (you already showed this):"
Write-Host "   docker compose exec api printenv | findstr JWT_SECRET"
Write-Host "3) Watch API logs while re-running the upload:"
Write-Host "   docker compose logs --no-color api --tail 200 --follow"
Write-Host "`nScript finished.`n"
