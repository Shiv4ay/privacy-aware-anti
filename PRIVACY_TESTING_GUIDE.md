# Privacy Features Testing Guide

This guide explains how to test and verify all privacy features in the Privacy-Aware RAG system.

## 🔒 Privacy Features Overview

1. **PII Redaction**: Automatically redacts emails, phone numbers, and SSNs from queries
2. **Query Hashing**: Hashes queries for audit logs (one-way, non-reversible)
3. **RBAC Access Control**: Role-based access control for document access
4. **Audit Logging**: All searches and access attempts are logged

## 🧪 Testing Privacy Features

### Test Scripts

#### 1. Backend Pipeline Test
```powershell
.\test_backend_pipeline.ps1
```
Tests the complete flow: Upload → Worker → Embedding → Store → Search

#### 2. Privacy Features Test
```powershell
.\test_privacy_features.ps1
```
Tests PII redaction, RBAC, and audit logging

### Manual Testing Steps

#### Test 1: PII Redaction in Search

1. **Via API (PowerShell)**:
   ```powershell
   $body = @{ q = "Find contact info for john.doe@example.com" } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:3001/api/search" `
     -Method POST `
     -Headers @{ "Authorization" = "Bearer super-secret-dev-key"; "x-dev-auth" = "super-secret-dev-key"; "Content-Type" = "application/json" } `
     -Body $body
   ```

2. **Check Response**:
   - Look for `query_redacted` field in response
   - Should show: `"Find contact info for [REDACTED]"`
   - Original query should still be in `query` field

3. **Via Frontend UI**:
   - Go to http://localhost:3000/search
   - Enter query: "Find contact info for test@example.com"
   - Check for privacy warning banner
   - Check for "PII detected" message
   - After search, check if redacted query is displayed

#### Test 2: Query Hashing

1. **Check Audit Logs**:
   ```powershell
   docker exec -it privacy-aware-postgres psql -U postgres -d privacy_aware_db -c "SELECT query_hash, query_redacted, action, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 5;"
   ```

2. **Verify**:
   - `query_hash` should be a hash (not the original query)
   - `query_redacted` should show redacted version
   - Same query should produce same hash

#### Test 3: RBAC Access Control

1. **Create Restricted User** (if not exists):
   ```sql
   INSERT INTO users (username, roles, department) 
   VALUES ('restricted_user', '["viewer"]', 'sales');
   ```

2. **Create ABAC Policy**:
   ```sql
   INSERT INTO abac_policies (id, description, effect, expression, priority, enabled)
   VALUES (
     'deny_viewer_search',
     'Deny search for viewers',
     'deny',
     '{"action": "search", "subject.roles": {"$contains": "viewer"}}',
     100,
     true
   );
   ```

3. **Test with Restricted Token**:
   ```powershell
   # Get token for restricted user (use your auth endpoint)
   $restrictedToken = "..." # Get from login
   
   $body = @{ q = "test query" } | ConvertTo-Json
   try {
     Invoke-RestMethod -Uri "http://localhost:3001/api/search" `
       -Method POST `
       -Headers @{ "Authorization" = "Bearer $restrictedToken"; "Content-Type" = "application/json" } `
       -Body $body
   } catch {
     # Should get 403 Forbidden
     Write-Host "Status: $($_.Exception.Response.StatusCode)"
   }
   ```

4. **Verify Frontend**:
   - Login as restricted user
   - Try to search
   - Should see red warning banner: "Access Denied: You do not have permission to search"

#### Test 4: Audit Logging

1. **Perform a Search**:
   ```powershell
   $body = @{ q = "GDPR compliance" } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:3001/api/search" `
     -Method POST `
     -Headers @{ "Authorization" = "Bearer super-secret-dev-key"; "x-dev-auth" = "super-secret-dev-key"; "Content-Type" = "application/json" } `
     -Body $body
   ```

2. **Check Audit Logs**:
   ```sql
   SELECT 
     username,
     action,
     query_redacted,
     query_hash,
     result_count,
     timestamp
   FROM audit_logs
   ORDER BY timestamp DESC
   LIMIT 10;
   ```

3. **Verify**:
   - Entry exists for the search
   - `query_redacted` shows redacted query
   - `query_hash` is a hash (not original)
   - `result_count` matches search results
   - `timestamp` is recent

## 📊 Expected Results

### Search Response Structure
```json
{
  "success": true,
  "query": "Find contact info for test@example.com",
  "query_redacted": "Find contact info for [REDACTED]",
  "query_hash": "a1b2c3d4e5f6...",
  "results": [...],
  "total_found": 5
}
```

### Audit Log Entry
```json
{
  "user_id": "123",
  "username": "test_user",
  "action": "search",
  "query_hash": "a1b2c3d4e5f6...",
  "query_redacted": "Find contact info for [REDACTED]",
  "result_count": 5,
  "document_ids": ["doc1", "doc2"],
  "timestamp": "2025-01-XX..."
}
```

### RBAC Denial Response
```json
{
  "error": "Access denied",
  "message": "You do not have permission to search",
  "policy_id": "deny_viewer_search",
  "decision": "denied"
}
```

## 🎨 Frontend Privacy Indicators

The frontend should display:

1. **Privacy Notice Banners**:
   - Blue info banners on Search, Chat, Upload pages
   - Explains PII redaction, RBAC, audit logging

2. **PII Detection Warnings**:
   - Yellow warning when PII is detected in query
   - Shows detected PII types (Email, Phone, SSN)

3. **Redaction Display**:
   - Shows original query
   - Shows redacted query (if available from backend)

4. **RBAC Warnings**:
   - Red error banner when access is denied
   - Shows policy ID if available
   - Clear message about permission denial

## 🔍 Verification Checklist

- [ ] PII redaction works for emails
- [ ] PII redaction works for phone numbers
- [ ] PII redaction works for SSNs
- [ ] Query hashing produces consistent hashes
- [ ] Audit logs contain redacted queries
- [ ] Audit logs contain query hashes
- [ ] RBAC denies access for restricted users
- [ ] Frontend shows privacy warnings
- [ ] Frontend shows PII detection
- [ ] Frontend shows redaction preview
- [ ] Frontend shows RBAC denial messages

## 📝 Notes

- PII redaction happens in the worker (`backend/worker/app.py`)
- Query hashing uses `QUERY_HASH_SALT` environment variable
- RBAC policies are stored in `abac_policies` table
- Audit logs are stored in `audit_logs` table
- Frontend displays privacy info from API responses

