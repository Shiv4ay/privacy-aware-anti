# Admin Management Guide

## How to Reset Super Admin Password

If you need to manually set or reset the Super Admin password, follow these steps:

1.  **Open a Terminal** in VS Code.
2.  **Navigate** to the API directory:
    ```powershell
    cd backend/api
    ```
3.  **Run the Reset Script** with your desired password:
    ```powershell
    node reset_admin_password.js "YourNewPassword123"
    ```

### Example Output
```text
Connecting to database...
Resetting password for user 'admin'...
✅ Success! Password updated for user: admin
You can now login with:
Email: admin@privacy-aware-rag.local
Password: YourNewPassword123
```

## Super Admin Credentials
- **Username**: `admin`
- **Email**: `admin@privacy-aware-rag.local`
- **Role**: `super_admin` (Full Access)

## Troubleshooting
- If you see `Error: Cannot find module`, make sure you are in the `backend/api` directory where `node_modules` are installed.
- If you see connection errors, ensure your Docker containers are running (`docker-compose up -d`).
