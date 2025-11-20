# call_search_ps.ps1
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoic2liYSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MzI0NjIzOCwiZXhwIjoxNzYzODUxMDM4fQ.hU7frjfNlaippU09Q9CXLYjO4hMVorC4CoW-Pr0RBEs"

$uri = "http://127.0.0.1:3001/api/search"
$payload = @{ query = "hello from siba"; top_k = 3 } | ConvertTo-Json

$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $token)
$client.DefaultRequestHeaders.Accept.Add([System.Net.Http.Headers.MediaTypeWithQualityHeaderValue]::new("application/json"))

$content = New-Object System.Net.Http.StringContent($payload, [System.Text.Encoding]::UTF8, "application/json")

try {
  $resp = $client.PostAsync($uri, $content).GetAwaiter().GetResult()
  $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  Write-Host "HTTP/$($resp.StatusCode) - $($resp.ReasonPhrase)"
  Write-Host "Body:`n$body"
} catch {
  Write-Host "Request failed:" $_.Exception.Message
} finally {
  $client.Dispose()
}
