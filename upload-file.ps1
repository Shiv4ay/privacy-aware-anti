# upload-file.ps1
# Usage: .\upload-file.ps1 "C:\path\to\file.pdf"

param(
  [Parameter(Mandatory=$true)]
  [string]$FilePath
)

function Load-NetHttpAssembly {
  # Try modern Add-Type, then LoadWithPartialName fallback
  try {
    Add-Type -AssemblyName "System.Net.Http" -ErrorAction Stop
    return $true
  } catch {
    try {
      [void][System.Reflection.Assembly]::LoadWithPartialName("System.Net.Http")
      return $true
    } catch {
      return $false
    }
  }
}

try {
  if (-not (Load-NetHttpAssembly)) {
    Write-Error "Failed to load System.Net.Http assembly. Please run in Windows PowerShell with .NET support or use PowerShell 7."
    exit 2
  }

  # 1) generate token from api container (adjust sub/username if you want)
  Write-Host "Generating JWT token from api container..."
  $token = (& docker compose exec -T api node -e "console.log(require('jsonwebtoken').sign({ sub:34, username:'alice', department:'engineering', clearance_level:'INTERNAL' }, process.env.JWT_SECRET))") 2>$null
  $token = $token -join "`n"
  $token = $token.Trim()
  if (-not $token) {
    Write-Error "Failed to obtain token. Is the api container running and JWT_SECRET configured?"
    exit 1
  }
  Write-Host "Token obtained."

  # 2) Validate file
  if (-not (Test-Path -Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
  }

  $fileName = [System.IO.Path]::GetFileName($FilePath)
  Write-Host "Uploading file: $fileName"

  # 3) Build HttpClient and MultipartFormDataContent (works in PS5.1 & PS7)
  $clientType = [Type]::GetType("System.Net.Http.HttpClient, System.Net.Http")
  if (-not $clientType) {
    # fallback: try System.Net.Http from current AppDomain
    $clientType = [Type]::GetType("System.Net.Http.HttpClient")
  }
  if (-not $clientType) {
    Write-Error "HttpClient type not found after loading assembly."
    exit 2
  }

  $client = New-Object System.Net.Http.HttpClient
  $client.Timeout = [System.TimeSpan]::FromSeconds(300)

  # Authorization header
  $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)

  $multipart = New-Object System.Net.Http.MultipartFormDataContent

  # File content as stream
  $fileStream = [System.IO.File]::OpenRead($FilePath)
  $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
  # set Content-Type header
  $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/pdf")
  # Add file part
  $null = $multipart.Add($fileContent, "file", $fileName)

  # If your upload endpoint expects additional fields (e.g. metadata), add them like:
  # $multipart.Add((New-Object System.Net.Http.StringContent("engineering")), "department")

  Write-Host "Sending POST to http://localhost:3001/api/upload ..."
  $respTask = $client.PostAsync("http://localhost:3001/api/upload", $multipart)
  $resp = $respTask.GetAwaiter().GetResult()

  $status = [int]$resp.StatusCode
  $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()

  Write-Host "`nResponse status: $status ($($resp.ReasonPhrase))"
  Write-Host "Response body:`n$body"

  # cleanup
  $fileStream.Close()
  $multipart.Dispose()
  $client.Dispose()

  if ($status -ge 400) {
    Write-Error "Upload returned error status $status"
    exit 1
  }

  Write-Host "Upload finished."
} catch {
  Write-Error "Exception during upload: $_"
  exit 2
}
