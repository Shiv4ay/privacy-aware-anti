# Fix syntax error in index.js
$file = "C:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\index.js"
$content = Get-Content $file -Raw

# Fix the unterminated string
$content = $content -replace 'schema compatibility\\\"\);', 'schema compatibility\'\);'

$content | Set-Content $file
Write-Host "✅ Fixed syntax error in index.js"
