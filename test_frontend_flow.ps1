
# Test Frontend API Flows

$API_URL = "http://localhost:3001/api"
$ErrorActionPreference = "Stop"

function Test-FrontendFlows {
    Write-Host "1. Registering Frontend User (Org: Finance)..." -ForegroundColor Cyan
    $user = @{
        name = "Frontend User"
        email = "frontend@finance.com"
        password = "password123"
        organization = "Finance"
        department = "Accounting"
        user_category = "Analyst"
    }
    try {
        $reg = Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -Body ($user | ConvertTo-Json) -ContentType "application/json"
        $token = $reg.token
        Write-Host "Frontend User Registered. Token received." -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 409) {
            Write-Host "User already exists. Proceeding to login..." -ForegroundColor Yellow
        } else {
            Write-Error "Registration failed: $_"
        }
    }

    Write-Host "2. Logging in Frontend User..." -ForegroundColor Cyan
    try {
        $login = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body (@{email=$user.email; password=$user.password} | ConvertTo-Json) -ContentType "application/json"
        $token = $login.token
        $org = $login.user.organization
        
        if ($org -eq "Finance") {
             Write-Host "Login Successful. Organization: $org (Correct)" -ForegroundColor Green
        } else {
             Write-Error "Login Successful but Organization is WRONG: $org"
        }
    } catch {
        Write-Error "Login failed: $_"
    }

    Write-Host "3. Verifying /auth/me endpoint..." -ForegroundColor Cyan
    try {
        $me = Invoke-RestMethod -Uri "$API_URL/auth/me" -Method Get -Headers @{Authorization="Bearer $token"}
        if ($me.user.organization -eq "Finance") {
            Write-Host "/auth/me verified. Organization: $($me.user.organization)" -ForegroundColor Green
        } else {
            Write-Error "/auth/me returned WRONG organization: $($me.user.organization)"
        }
    } catch {
        Write-Error "/auth/me failed: $_"
    }
}

try {
    Test-FrontendFlows
} catch {
    Write-Error "Test failed: $_"
}
