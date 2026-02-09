import sys
import os
import requests
import time
from pathlib import Path
from ingest_via_api import upload_csv, CSV_FILES, API_BASE, DATASET_PATH, Colors

# Admin Credentials
ADMIN_EMAIL = "hostingweb2102@gmail.com"
ADMIN_PASSWORD = "Admin123!"

def login():
    """Login and return token + org_id"""
    print(f"{Colors.BLUE}[INFO] Logging in as {ADMIN_EMAIL}...{Colors.END}")
    try:
        response = requests.post(f"{API_BASE}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("accessToken")
            user = data.get("user", {})
            # Org ID might be directly in user or we might need to fetch it
            # Based on admin.js/auth.js, user object has org_id if properly returned
            # Or we can use the /admin/stats endpoint to verify
            
            org_id = user.get("org_id")
            
            # If Super Admin, org_id might be null. 
            # We need to explicitly find or create "MIT University"
            if not org_id:
                print(f"\\n{Colors.BLUE}[INFO] Super Admin detected. Checking for MIT University...{Colors.END}")
                headers = {'Authorization': f'Bearer {token}'}
                
                # 1. List Orgs
                orgs_res = requests.get(f"{API_BASE}/orgs", headers=headers)
                if orgs_res.status_code == 200:
                    orgs = orgs_res.json().get("organizations", [])
                    print(f"{Colors.BLUE}[DEBUG] Found {len(orgs)} organizations: {[o['name'] for o in orgs]}{Colors.END}")
                    
                    mit_org = next((o for o in orgs if o["name"].lower() == "mit university"), None)
                    
                    if mit_org:
                        org_id = mit_org["id"]
                        print(f"{Colors.GREEN}✓{Colors.END} Found existing '{mit_org['name']}' (ID: {org_id})")
                    else:
                        print(f"{Colors.YELLOW}[INFO] Creating 'MIT University'...{Colors.END}")
                        create_res = requests.post(
                            f"{API_BASE}/orgs/create",
                            json={"name": "MIT University", "type": "education", "domain": "mit.edu"},
                            headers=headers
                        )
                        if create_res.status_code == 200:
                            new_org = create_res.json().get("organization", {})
                            org_id = new_org.get("id")
                            print(f"{Colors.GREEN}✓{Colors.END} Created 'MIT University' (ID: {org_id})")
                        else:
                            print(f"{Colors.RED}[ERROR] Failed to create org: {create_res.text}{Colors.END}")
            
            if org_id:
                print(f"{Colors.GREEN}✓{Colors.END} Login success. Using Org ID: {org_id}")
                return token, org_id
            else:
                 print(f"{Colors.RED}[ERROR] Could not determine Org ID{Colors.END}")
                 return None, None
        else:
            print(f"{Colors.RED}[ERROR] Login failed: {response.text}{Colors.END}")
            return None, None
    except Exception as e:
        print(f"{Colors.RED}[ERROR] Login exception: {e}{Colors.END}")
        return None, None

def main():
    token, org_id = login()
    if not token or not org_id:
        print("Aborting ingestion due to login failure.")
        sys.exit(1)

    print("\n" + "="*70)
    print("STARTING AUTOMATED INGESTION".center(70))
    print("="*70 + "\n")

    results = {}
    dataset_path = Path(DATASET_PATH)

    for record_type, filename in CSV_FILES.items():
        file_path = dataset_path / filename
        
        if not file_path.exists():
            print(f"{Colors.YELLOW}⊘{Colors.END} {record_type}: File not found - {filename}")
            continue
        
        file_size = file_path.stat().st_size / (1024 * 1024)
        print(f"\n[{record_type}] File size: {file_size:.2f}MB")
        
        # Retry logic for large files or network glitches
        retries = 3
        while retries > 0:
            result = upload_csv(file_path, record_type, org_id, token)
            if result:
                results[record_type] = result
                break
            else:
                retries -= 1
                if retries > 0:
                    print(f"{Colors.YELLOW}Retrying {record_type} ({retries} attempts left)...{Colors.END}")
                    time.sleep(2)
        
        time.sleep(1)

    # Summary
    successful = sum(1 for r in results.values() if r is not None)
    total = len(results)
    
    print("\n" + "="*70)
    print(f"Ingestion Complete: {successful}/{total} Successful".center(70))
    print("="*70)

if __name__ == "__main__":
    main()
