# User Access & Testing Guide

This guide explains how to access the application as different user types to test the features and security permissions.

## 1. Prerequisites
- Ensure the application is running:
  ```powershell
  docker-compose up -d
  ```
- Open your browser to: [http://localhost:3000](http://localhost:3000)

---

## 2. Super Admin Access
**Role**: The "God Mode" of the system. Can manage all organizations, users, and view system-wide audit logs.

1.  **Go to**: [http://localhost:3000/login](http://localhost:3000/login)
2.  **Email**: `admin@privacy-aware-rag.local`
3.  **Password**: `admin123` (or the password you manually set)
4.  **What to Test**:
    - Go to **Dashboard**.
    - Create a new Organization (e.g., "TechCorp").
    - View **Audit Logs** to see system activity.

---

## 3. Organization Admin Access
**Role**: Manages users and settings *only* for their specific organization (e.g., Hospital Admin).

**How to Create one:**
1.  Log in as **Super Admin**.
2.  Go to **Dashboard** -> **Users** section.
3.  Click **"Create User"** (or similar button).
4.  **Details**:
    - Name: `Hospital Admin`
    - Email: `admin@hospital.com`
    - Password: `password123`
    - Organization: **Hospital**
    - Role: **Admin**
5.  **Log out** and Log in with `admin@hospital.com`.
6.  **What to Test**: You should *only* see users and logs for the "Hospital" organization.

---

## 4. Specific Organization User (e.g., University)
**Role**: A standard employee. Can only search and chat about documents belonging to their organization.

**How to Access:**
1.  Go to **Register**: [http://localhost:3000/register](http://localhost:3000/register)
2.  **Fill Details**:
    - Name: `Dr. Smith`
    - Email: `smith@university.edu`
    - Password: `password123`
3.  **Select Organization**: Choose **"University"** from the dropdown.
4.  **Click Register**.
5.  **What to Test**:
    - Upload a document.
    - Search for it.
    - *Note*: You will NOT see documents uploaded by the "Hospital" users.

---

## 5. General User
**Role**: A standard user for general purposes, isolated from specific organizations.

**How to Access:**
1.  Go to **Register**: [http://localhost:3000/register](http://localhost:3000/register)
2.  **Fill Details**:
    - Name: `John Doe`
    - Email: `john@gmail.com`
    - Password: `password123`
3.  **Select Organization**: Choose **"General"** from the dropdown.
4.  **Click Register**.
5.  **What to Test**:
    - Verify you cannot see "University" or "Hospital" documents.
