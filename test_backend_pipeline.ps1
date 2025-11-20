# test_backend_pipeline.ps1
# Complete Backend Pipeline Test: Upload → Worker → Embedding → Store → Search

$API_URL = "http://localhost:3001"
$TOKEN = "super-secret-dev-key"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Pipeline Test" -ForegroundColor Cyan
Write-Host "Upload → Worker → Embedding → Store → Search" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Upload a test document
Write-Host "Step 1: Upload Test Document" -ForegroundColor Yellow
$testContent = @"
Privacy-Aware RAG System Test Document

This document contains test information for the privacy-aware RAG system.
It includes sample content about GDPR compliance and data protection.

Key Points:
- GDPR requires data protection
- PII must be redacted in queries
- Audit logs track all searches
- RBAC controls access

Contact Information:
- Email: test@example.com
- Phone: 555-123-4567
- SSN: 123-45-6789 (test data)

The system should redact PII from queries and log all access attempts.
"@

$testFile = "test_document_$(Get-Date -Format 'yyyyMMddHHmmss').txt"
$testContent | Out-File -FilePath $testFile -Encoding UTF8

try {
    $fileBytes = [System.IO.File]::ReadAllBytes($testFile)
    $boundary = [System.Guid]::NewGuid().ToString()
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$testFile`"",
        "Content-Type: text/plain",
        "",
        $testContent,
        "--$boundary--"
    )
    $body = $bodyLines -join "`r`n"
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

    $response = Invoke-RestMethod -Uri "$API_URL/api/documents/upload" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "x-dev-auth" = $TOKEN
            "Content-Type" = "multipart/form-data; boundary=$boundary"
        } `
        -Body $bodyBytes `
        -ErrorAction Stop

    Write-Host "✓ Upload successful" -ForegroundColor Green
    Write-Host "  Document ID: $($response.docId)" -ForegroundColor White
    Write-Host "  Filename: $($response.filename)" -ForegroundColor White
    
    $docId = $response.docId
    Write-Host ""
    Write-Host "Waiting 10 seconds for worker to process document..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
} catch {
    Write-Host "✗ Upload failed: $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path $testFile) { Remove-Item $testFile }
    exit 1
}

# Step 2: Search for the document
Write-Host ""
Write-Host "Step 2: Search for Uploaded Document" -ForegroundColor Yellow
$searchQuery = @{
    q = "GDPR compliance and data protection"
} | ConvertTo-Json

try {
    $searchResponse = Invoke-RestMethod -Uri "$API_URL/api/search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "x-dev-auth" = $TOKEN
            "Content-Type" = "application/json"
        } `
        -Body $searchQuery `
        -ErrorAction Stop

    Write-Host "✓ Search successful" -ForegroundColor Green
    Write-Host "  Query: $($searchResponse.query)" -ForegroundColor White
    if ($searchResponse.query_redacted) {
        Write-Host "  Redacted: $($searchResponse.query_redacted)" -ForegroundColor Yellow
    }
    Write-Host "  Results found: $($searchResponse.total_found)" -ForegroundColor White
    
    if ($searchResponse.results -and $searchResponse.results.Count -gt 0) {
        Write-Host "  First result preview:" -ForegroundColor White
        $firstResult = $searchResponse.results[0]
        $preview = if ($firstResult.text) { $firstResult.text.Substring(0, [Math]::Min(100, $firstResult.text.Length)) } else { "No text" }
        Write-Host "    $preview..." -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Search failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Test PII redaction in search
Write-Host ""
Write-Host "Step 3: Test PII Redaction in Search Query" -ForegroundColor Yellow
$piiQuery = @{
    q = "Find contact info for test@example.com and 555-123-4567"
} | ConvertTo-Json

try {
    $piiResponse = Invoke-RestMethod -Uri "$API_URL/api/search" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "x-dev-auth" = $TOKEN
            "Content-Type" = "application/json"
        } `
        -Body $piiQuery `
        -ErrorAction Stop

    Write-Host "✓ Search with PII successful" -ForegroundColor Green
    Write-Host "  Original Query: $($piiResponse.query)" -ForegroundColor White
    if ($piiResponse.query_redacted) {
        Write-Host "  Redacted Query: $($piiResponse.query_redacted)" -ForegroundColor Yellow
        if ($piiResponse.query_redacted -ne $piiResponse.query) {
            Write-Host "  ✓ PII Redaction Working!" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Query not redacted (may not contain PII patterns)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠ query_redacted field missing from response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Search with PII failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Cleanup
if (Test-Path $testFile) {
    Remove-Item $testFile
    Write-Host ""
    Write-Host "✓ Cleaned up test file" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Pipeline Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Check worker logs: docker logs privacy-aware-worker" -ForegroundColor White
Write-Host "  2. Check ChromaDB: docker exec -it privacy-aware-chromadb chroma-cli list-collections" -ForegroundColor White
Write-Host "  3. Check audit logs in database" -ForegroundColor White
Write-Host "  4. Test in frontend UI at http://localhost:3000" -ForegroundColor White

