# Google OAuth Setup Guide

## Prerequisites

Before using Google OAuth authentication, you need to set up Google Cloud credentials.

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to **APIs & Services** → **Library**
   - Search for "Google+ API"
   - Click **Enable**

### 2. Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Configure OAuth consent screen (if first time):
   - User Type: **External** (for testing) or **Internal** (for organization)
   - Fill in app name, user support email, and developer email
   - Add scopes: `userinfo.email`, `userinfo.profile`
   - Add test users if needed
4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `Privacy-Aware RAG`
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - Your production URL (when deploying)
   - Authorized redirect URIs:
     - `http://localhost:3000/auth/google/callback` (development)
     - Your production callback URL (when deploying)
5. Copy the **Client ID** and **Client Secret**

### 3. Configure Environment Variables

#### Backend (.env)
Add to `c:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR\backend\api\.env`:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
FRONTEND_URL=http://localhost:3000

# Existing variables...
```

#### Frontend (.env)
The frontend doesn't need additional OAuth variables - it uses the backend API.

### 4. Restart Services

After adding environment variables:

```powershell
# Navigate to project root
cd c:\project3\AntiGravity\PRIVACY-AWARE-RAG-GUIDE-CUR

# Restart backend API
docker compose restart api

# Frontend (if running)
# Press Ctrl+C and restart: npm run dev
```

## Testing OAuth Flow

1. **Start the application**:
   - Backend API: Should be running on `http://localhost:5000`
   - Frontend: Should be running on `http://localhost:3000`

2. **Navigate to Login page**: `http://localhost:3000/login`

3. **Click "Continue with Google"**:
   - Should redirect to Google consent screen
   - Grant permissions
   - Redirects back to `/auth/google/callback`
   - Should automatically log you in and redirect to dashboard

## Troubleshooting

### "Google OAuth not configured" error
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in backend `.env`
- Restart the API container: `docker compose restart api`

### Redirect URI mismatch
- Ensure the redirect URI in Google Cloud Console exactly matches: `http://localhost:3000/auth/google/callback`
- No trailing slashes, exact protocol (http/https)

### "Access blocked" or "App not verified"
- Add your Google account as a test user in OAuth consent screen
- Or publish the app (for production)

### User created but no organization
- OAuth users are created without an organization by default
- They'll be redirected to organization selection page
- Or assign organization during OAuth callback (modify backend logic)

## Production Deployment

When deploying to production:

1. Update Google Cloud Console redirect URIs with production URL
2. Update `.env` with production `FRONTEND_URL`
3. Consider implementing state parameter validation for CSRF protection
4. Enable refresh token rotation
5. Implement account linking UI for existing users

## Security Notes

- Never commit `.env` files to version control
- Rotate client secrets periodically
- Use HTTPS in production
- Implement rate limiting on OAuth endpoints
- Log all OAuth authentication attempts for audit
