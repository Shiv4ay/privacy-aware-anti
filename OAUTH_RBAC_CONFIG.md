# OAuth Role-Based Access Control Configuration

## 📋 Overview
The system now automatically assigns roles to specific email addresses when users authenticate via Google OAuth.

## 🔐 Configured Roles

### Super Admin
- **Email**: `hostingweb2102@gmail.com`
- **Role**: `super_admin`
- **Organization**: None (super admins have access to all organizations)
- **Redirect**: `/super-admin` dashboard
- **Permissions**: System-wide access, manage all organizations

### University Admin (MIT)
- **Email**: `sibasundar2102@gmail.com`
- **Role**: `admin`
- **Organization**: MIT (University)
- **Redirect**: `/admin` dashboard
- **Permissions**: Full access to MIT organization data

### Default Users
- **All other emails**: `user` role
- **Organization**: None (will be prompted to select)
- **Redirect**: `/org-select` page, then `/dashboard`

## 🎯 How It Works

1. **User clicks "Continue with Google"**
2. **Google authenticates** the user
3. **System checks email** against configured list:
   - `hostingweb2102@gmail.com` → Super Admin
   - `sibasundar2102@gmail.com` → Admin (MIT)
   - Others → Regular user
4. **User is created/linked** with the assigned role
5. **Automatic redirect** to appropriate dashboard

## 🔄 Login Flow Examples

### Scenario 1: Super Admin Login
```
Email: hostingweb2102@gmail.com
↓
OAuth Callback
↓
Role: super_admin, Org: null
↓
Redirect: /super-admin
```

### Scenario 2: MIT Admin Login
```
Email: sibasundar2102@gmail.com
↓
OAuth Callback
↓
Role: admin, Org: MIT (ID fetched from DB)
↓
Redirect: /admin
```

### Scenario 3: Regular User Login
```
Email: anyother@example.com
↓
OAuth Callback
↓
Role: user, Org: null
↓
Redirect: /org-select (choose organization)
```

## 🛠️ Implementation Details

**File Modified**: `backend/api/auth/oauthManager.js`
**Method**: `findOrCreateUser()`

The logic checks email addresses during user creation and assigns:
- Role based on email match
- Organization based on role (MIT for admin, null for super_admin)

## ✅ Testing

1. **Test Super Admin**:
   - Log in with `hostingweb2102@gmail.com` via Google
   - Should land on Super Admin dashboard
   - Can manage all organizations

2. **Test MIT Admin**:
   - Log in with `sibasundar2102@gmail.com` via Google
   - Should land on Admin dashboard
   - Can manage MIT organization

## 📌 Notes

- First-time OAuth users will have accounts created automatically
- Existing users logging in via OAuth will link their Google account
- Roles are only assigned during **initial account creation**
- If you need to **change a role** for an existing user, update directly in the database

## 🔒 Security

- Passwords specified (`Hostingweb@21`, `Sibasundar@21`) are for **email/password login only**
- OAuth users authenticate through Google - no password needed
- Role assignment is server-side and cannot be manipulated by the client
