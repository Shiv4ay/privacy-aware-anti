# upload-pdf.ps1
Param(
    [string]$ApiUrl = "http://127.0.0.1:3001",
    [string]$Endpoint = "/api/upload",
    [string]$FilePath = "C:\Users\sibas\Downloads\Generating_Is_Believing_Membership_Inference_Attacks_against_Retrieval-Augmented_Generation.pdf",
    [string]$TokenFile = ".\last_jwt.txt",
    [switch]$AppendNotes
)

# -- sanity checks
if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath`nPlease correct the path and re-run."
    exit 2
}

# Read token if present
$token = $null
if (Test-Path $TokenFile) {
    $token = (Get-Content $TokenFile -Raw).Trim()
    Write-Host "Using token from $TokenFile (length: $($token.Length))"
} else {
    Write-Host "No token file found at $TokenFile. If API requires auth, set $token variable or create last_jwt.txt."
}

$headers = @{}
if ($token -and $token.Length -gt 0) {
    $headers["Authorization"] = "Bearer $token"
}

$Url = $ApiUrl.TrimEnd('/') + $Endpoint
Write-Host "Uploading file to: $Url"
Write-Host "File: $FilePath"

try {
    # Perform multipart POST
    $resp = Invoke-RestMethod -Uri $Url -Method Post -Form @{ file = Get-Item $FilePath } -Headers $headers -TimeoutSec 300 -ErrorAction Stop
    Write-Host "`n=== Upload succeeded ==="
    $resp | ConvertTo-Json -Depth 6
    $note = "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Upload succeeded: $(Split-Path $FilePath -Leaf) -> $Url"
    Write-Host $note
    if ($AppendNotes) {
        $note | Out-File -FilePath .\fixed_notes.md -Encoding utf8 -Append
        Write-Host "Appended note to fixed_notes.md"
    }
    exit 0
}
catch {
    $ex = $_.Exception
    Write-Host "`n=== Upload FAILED ==="
    Write-Host "Exception type: $($ex.GetType().FullName)"
    # Try read modern HttpResponseMessage
    if ($ex.Response -ne $null) {
        try {
            $respMsg = $ex.Response
            if ($respMsg.StatusCode -ne $null) { Write-Host "StatusCode: $($respMsg.StatusCode)" }
            if ($respMsg.Content -ne $null) {
                $body = $respMsg.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                Write-Host "Body:`n$body"
            } else {
                Write-Host "No .Content on response object."
            }
        } catch {
            # WebException path
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
        Write-Host "No response object available. Message:`n$($ex.Message)"
    }

    if ($AppendNotes) {
        $note = "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Upload FAILED: $(Split-Path $FilePath -Leaf) -> $Url -- See logs"
        $note | Out-File -FilePath .\fixed_notes.md -Encoding utf8 -Append
        Write-Host "Appended failure note to fixed_notes.md"
    }
    exit 1
}
