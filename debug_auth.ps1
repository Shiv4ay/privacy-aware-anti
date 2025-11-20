
$API_URL = "http://localhost:3001/api"
$ErrorActionPreference = "Stop"

try {
    $email = "debug_$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
    Write-Host "Registering user: $email"
    
    try {
        $reg = Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -Body (@{
            name = "Debug User"
            email = $email
            password = "password123"
            organization = "DebugOrg"
            department = "DebugDept"
            user_category = "DebugCat"
        } | ConvertTo-Json) -ContentType "application/json"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 409) {
            Write-Host "User exists, proceeding to login"
        } else {
            throw $_
        }
    }

    Write-Host "Logging in..."
    $login = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body (@{
        email = $email
        password = "password123"
    } | ConvertTo-Json) -ContentType "application/json"

    $token = $login.token
    Write-Host "Login successful. Token obtained."
    Write-Host "Login Response User:"
    $login.user | ConvertTo-Json -Depth 5

    Write-Host "Fetching /auth/me..."
    $me = Invoke-RestMethod -Uri "$API_URL/auth/me" -Method Get -Headers @{Authorization="Bearer $token"}
    
    Write-Host "/auth/me Response:"
    $me | ConvertTo-Json -Depth 5

} catch {
    Write-Error "Error: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
        Write-Error "Details: $($reader.ReadToEnd())"
    }
}
