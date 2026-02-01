# test_stats_endpoint.ps1
# Verify Documents Stats and Pagination

$API_URL = "http://localhost:3001"
$TOKEN = "super-secret-dev-key"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Documents API" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get Stats
Write-Host "Step 1: Get Stats" -ForegroundColor Yellow

try {
    $statsResponse = Invoke-RestMethod -Uri "$API_URL/api/documents/stats" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "x-dev-auth" = $TOKEN
            "Content-Type" = "application/json"
        } `
        -ErrorAction Stop

    Write-Host "✓ Stats request successful" -ForegroundColor Green
    Write-Host "  Total Documents: $($statsResponse.total_documents)" -ForegroundColor White
    Write-Host "  Total Files:     $($statsResponse.total_files)" -ForegroundColor White
    Write-Host "  Total Storage:   $($statsResponse.total_storage)" -ForegroundColor White
    Write-Host "  Processed:       $($statsResponse.processed)" -ForegroundColor White
    Write-Host "  Pending:         $($statsResponse.pending)" -ForegroundColor White

    if ($statsResponse.total_storage -is [int] -or $statsResponse.total_storage -is [long]) {
        Write-Host "  ✓ Storage is a number" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Storage is NOT a number: $($statsResponse.total_storage.GetType().Name)" -ForegroundColor Red
    }

} catch {
    Write-Host "✗ Failed to get stats: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Gray }
}

# Step 2: Get List (Pagination)
Write-Host ""
Write-Host "Step 2: Get Documents List (Page 1, Limit 5)" -ForegroundColor Yellow

try {
    $listResponse = Invoke-RestMethod -Uri "$API_URL/api/documents?page=1&limit=5" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $TOKEN"
            "x-dev-auth" = $TOKEN
            "Content-Type" = "application/json"
        } `
        -ErrorAction Stop

    Write-Host "✓ List request successful" -ForegroundColor Green
    
    if ($listResponse.pagination) {
        Write-Host "  ✓ Pagination object present" -ForegroundColor Green
        Write-Host "    Total: $($listResponse.pagination.total)" -ForegroundColor Gray
        Write-Host "    Page:  $($listResponse.pagination.page)" -ForegroundColor Gray
        Write-Host "    Limit: $($listResponse.pagination.limit)" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Pagination object MISSING" -ForegroundColor Red
    }

    if ($listResponse.documents) {
        $count = $listResponse.documents.Count
        Write-Host "  ✓ Documents list present (Count: $count)" -ForegroundColor Green
        
        if ($count -gt 0) {
            $firstDoc = $listResponse.documents[0]
            Write-Host "  First document: $($firstDoc.filename)" -ForegroundColor Gray
            Write-Host "  File size:      $($firstDoc.file_size) ($($firstDoc.file_size.GetType().Name))" -ForegroundColor Gray
             
             if ($firstDoc.file_size -is [int] -or $firstDoc.file_size -is [long]) {
                Write-Host "  ✓ File size is a number" -ForegroundColor Green
            } else {
                Write-Host "  ✗ File size is NOT a number" -ForegroundColor Red
            }
        }
    }

} catch {
    Write-Host "✗ Failed to get list: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Gray }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
