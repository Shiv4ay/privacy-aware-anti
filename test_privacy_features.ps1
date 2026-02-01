# test_privacy_features.ps1
# Comprehensive Privacy Features Test Script
# Tests: Query Redaction, RBAC, Audit Logging

$API_URL = "http://localhost:3001"
$TOKEN = "super-secret-dev-key"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Privacy Features Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Query with PII - Email
Write-Host "Test 1: Search Query with Email (PII Detection)" -ForegroundColor Yellow
Write-Host "Query: 'Find documents about john.doe@example.com'" -ForegroundColor Gray
$queryWithEmail = @{ query = "Find documents about john.doe@example.com" } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/search" -Method POST -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "x-dev-auth" = $TOKEN
        "Content-Type" = "application/json"
    } -Body $queryWithEmail -ErrorAction Stop
    
    Write-Host "[PASS] Search successful" -ForegroundColor Green
    Write-Host "  Original Query: $($response.query)" -ForegroundColor White
    if ($response.query_redacted) {
        Write-Host "  Redacted Query: $($response.query_redacted)" -ForegroundColor Yellow
        Write-Host "  [PASS] PII Redaction Working!" -ForegroundColor Green
    }
    Write-Host "  Results: $($response.total_found)" -ForegroundColor White
} catch {
    Write-Host "[FAIL] Search failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Query with Phone Number
Write-Host "Test 2: Search Query with Phone Number (PII Detection)" -ForegroundColor Yellow
Write-Host "Query: 'Contact info for 555-123-4567'" -ForegroundColor Gray
$queryWithPhone = @{ query = "Contact info for 555-123-4567" } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/search" -Method POST -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "x-dev-auth" = $TOKEN
        "Content-Type" = "application/json"
    } -Body $queryWithPhone -ErrorAction Stop
    
    Write-Host "[PASS] Search successful" -ForegroundColor Green
    Write-Host "  Original Query: $($response.query)" -ForegroundColor White
    if ($response.query_redacted) {
        Write-Host "  Redacted Query: $($response.query_redacted)" -ForegroundColor Yellow
        Write-Host "  [PASS] PII Redaction Working!" -ForegroundColor Green
    }
} catch {
    Write-Host "[FAIL] Search failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Query with SSN
Write-Host "Test 3: Search Query with SSN (PII Detection)" -ForegroundColor Yellow
Write-Host "Query: 'Employee with SSN 123-45-6789'" -ForegroundColor Gray
$queryWithSSN = @{ query = "Employee with SSN 123-45-6789" } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/search" -Method POST -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "x-dev-auth" = $TOKEN
        "Content-Type" = "application/json"
    } -Body $queryWithSSN -ErrorAction Stop
    
    Write-Host "[PASS] Search successful" -ForegroundColor Green
    Write-Host "  Original Query: $($response.query)" -ForegroundColor White
    if ($response.query_redacted) {
        Write-Host "  Redacted Query: $($response.query_redacted)" -ForegroundColor Yellow
        Write-Host "  [PASS] PII Redaction Working!" -ForegroundColor Green
    }
} catch {
    Write-Host "[FAIL] Search failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Normal Query (No PII)
Write-Host "Test 4: Normal Query Without PII" -ForegroundColor Yellow
Write-Host "Query: 'What is GDPR compliance?'" -ForegroundColor Gray
$normalQuery = @{ query = "What is GDPR compliance?" } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/search" -Method POST -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "x-dev-auth" = $TOKEN
        "Content-Type" = "application/json"
    } -Body $normalQuery -ErrorAction Stop
    
    Write-Host "[PASS] Search successful" -ForegroundColor Green
    Write-Host "  Query: $($response.query)" -ForegroundColor White
    Write-Host "  Results: $($response.total_found)" -ForegroundColor White
} catch {
    Write-Host "[FAIL] Search failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Audit Log Info
Write-Host "Test 5: Verify Audit Logging" -ForegroundColor Yellow
Write-Host "Note: Check database audit_logs table for:" -ForegroundColor Gray
Write-Host "  - query_hash (hashed queries)" -ForegroundColor Gray
Write-Host "  - query_redacted (redacted queries)" -ForegroundColor Gray
Write-Host "  - user_id, action, timestamp" -ForegroundColor Gray
Write-Host ""
Write-Host "To view audit logs, run:" -ForegroundColor Cyan
Write-Host '  docker exec -it privacy-aware-postgres psql -U admin -d privacy_aware_db -c "SELECT query_redacted, action, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 5;"' -ForegroundColor White
Write-Host ""

# Test 6: RBAC Info
Write-Host "Test 6: RBAC Access Control" -ForegroundColor Yellow
Write-Host "To test RBAC:" -ForegroundColor Gray
Write-Host "  1. Create a user with restricted role" -ForegroundColor Gray
Write-Host "  2. Try to search with that user's token" -ForegroundColor Gray
Write-Host "  3. Verify 403 response for denied access" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Suite Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Check frontend at http://localhost:3000" -ForegroundColor White
Write-Host "  2. Test search with PII in the UI" -ForegroundColor White
Write-Host "  3. Verify privacy warnings appear" -ForegroundColor White
Write-Host "  4. Check audit logs in database" -ForegroundColor White
