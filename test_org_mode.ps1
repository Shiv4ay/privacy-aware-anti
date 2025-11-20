
# Test Organization Mode Isolation

$API_URL = "http://localhost:3001/api"
$ErrorActionPreference = "Stop"

function Test-OrgIsolation {
    function Get-Token {
        param ($user)
        try {
            $reg = Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -Body ($user | ConvertTo-Json) -ContentType "application/json"
            Write-Host "$($user.name) Registered. Token received." -ForegroundColor Green
            return $reg.token
        } catch {
            if ($_.Exception.Response.StatusCode.value__ -eq 409) {
                Write-Host "$($user.name) already exists. Logging in..." -ForegroundColor Yellow
                try {
                    $login = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body (@{email=$user.email; password=$user.password} | ConvertTo-Json) -ContentType "application/json"
                    Write-Host "$($user.name) Logged in. Token received." -ForegroundColor Green
                    return $login.token
                } catch {
                    Write-Error "Login failed for $($user.name): $_"
                }
            } else {
                Write-Error "Registration failed for $($user.name): $_"
            }
        }
    }

    Write-Host "1. Registering/Logging in User A (Org: University)..." -ForegroundColor Cyan
    $userA = @{
        name = "User A"
        email = "usera@university.com"
        password = "password123"
        organization = "University"
        department = "CS"
        user_category = "Student"
    }
    $tokenA = Get-Token -user $userA

    Write-Host "2. Registering/Logging in User B (Org: Hospital)..." -ForegroundColor Cyan
    $userB = @{
        name = "User B"
        email = "userb@hospital.com"
        password = "password123"
        organization = "Hospital"
        department = "Cardiology"
        user_category = "Doctor"
    }
    $tokenB = Get-Token -user $userB

    # Create a dummy PDF file
    "Dummy content for University" | Set-Content "test_univ.txt"
    
    Write-Host "3. User A uploading document..." -ForegroundColor Cyan
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    $fileBytes = [System.IO.File]::ReadAllBytes("test_univ.txt")
    $fileContent = [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($fileBytes)

    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"test_univ.txt`"",
        "Content-Type: text/plain",
        "",
        $fileContent,
        "--$boundary--"
    ) -join $LF

    try {
        $uploadA = Invoke-RestMethod -Uri "$API_URL/upload" -Method Post -Headers @{Authorization="Bearer $tokenA"; "Content-Type"="multipart/form-data; boundary=$boundary"} -Body $bodyLines
        Write-Host "User A uploaded document: $($uploadA.document.id)" -ForegroundColor Green
    } catch {
        Write-Error "Upload failed: $_"
    }

    Write-Host "Waiting for processing..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15

    Write-Host "4. User A searching for 'University'..." -ForegroundColor Cyan
    $searchA = Invoke-RestMethod -Uri "$API_URL/search" -Method Post -Headers @{Authorization="Bearer $tokenA"} -Body (@{query="University"} | ConvertTo-Json) -ContentType "application/json"
    
    if ($searchA.results.Count -gt 0) {
        Write-Host "User A found $($searchA.results.Count) documents (Expected)" -ForegroundColor Green
    } else {
        Write-Warning "User A found NO documents (Unexpected)"
    }

    Write-Host "5. User B searching for 'University'..." -ForegroundColor Cyan
    $searchB = Invoke-RestMethod -Uri "$API_URL/search" -Method Post -Headers @{Authorization="Bearer $tokenB"} -Body (@{query="University"} | ConvertTo-Json) -ContentType "application/json"

    if ($searchB.results.Count -eq 0) {
        Write-Host "User B found 0 documents (Expected - Isolation Working)" -ForegroundColor Green
    } else {
        Write-Error "User B found $($searchB.results.Count) documents (FAILURE - No Isolation)"
    }
}

try {
    Test-OrgIsolation
} catch {
    Write-Error "Test failed: $_"
}
