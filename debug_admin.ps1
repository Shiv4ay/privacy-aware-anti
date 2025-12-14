$base = "http://localhost:3001/api"
$adminEmail = "admin@privacy-aware-rag.local"
$pass = "password"

# 1. Login
echo "Logging in..."
$loginBody = @{
    email = $adminEmail
    password = $pass
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
echo "Login Response Object:"
$loginRes | ConvertTo-Json -Depth 5
$token = $loginRes.accessToken
$ref = $loginRes.refreshToken

if (!$token) {
    echo "Login Failed"
    exit
}
echo "Login Success. Token: $token"

# 2. Create User
echo "Creating User..."
$headers = @{
    Authorization = "Bearer $token"
}
$userBody = @{
    name = "Test User"
    email = "testuser_debug@example.com"
    password = "Password123!"
    department = "IT"
    user_category = "employee"
} | ConvertTo-Json

try {
    $createRes = Invoke-RestMethod -Uri "$base/admin/users/create" -Method Post -Body $userBody -Headers $headers -ContentType "application/json"
    echo "Create User Success:"
    $createRes | ConvertTo-Json
} catch {
    echo "Create User Failed:"
    $_.Exception.Response.StatusCode
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $reader.ReadToEnd()
}
