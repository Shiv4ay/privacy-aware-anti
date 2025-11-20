$ErrorActionPreference = "Continue"

# Login
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post -Body (@{
    email = "usera@university.com"
    password = "password123"
} | ConvertTo-Json) -ContentType "application/json"

$token = $login.token
Write-Host "Logged in. Token: $($token.Substring(0, 20))..."

# Search
$headers = @{Authorization="Bearer $token"}
$searchResult = Invoke-RestMethod -Uri "http://localhost:3001/api/search" -Method Post -Headers $headers -Body (@{
    query = "University"
    top_k = 5
} | ConvertTo-Json) -ContentType "application/json"

Write-Host "Search Results:"
$searchResult | ConvertTo-Json -Depth 5
