"""
Upload ONLY attendance.csv to avoid duplicates
"""
import os
import requests
from pathlib import Path
import time

# Configuration
API_BASE = "http://localhost:3001/api"
DATASET_PATH = "C:/project3/AntiGravity/Datasets/University/final"
ATTENDANCE_FILE = "attendance.csv"

# Color codes
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

def main():
    print("\n" + "="*70)
    print("ATTENDANCE.CSV UPLOAD".center(70))
    print("="*70 + "\n")
    
    # Get org_id and token
    org_id = input(f"{Colors.BLUE}Enter Organization ID:{Colors.END} ").strip()
    if not org_id:
        print(f"{Colors.RED}ERROR:{Colors.END} Organization ID required")
        return
    
    token = input(f"{Colors.BLUE}Enter FRESH JWT Token:{Colors.END} ").strip()
    if not token:
        print(f"{Colors.RED}ERROR:{Colors.END} JWT token required")
        return
    
    # Upload attendance.csv
    file_path = Path(DATASET_PATH) / ATTENDANCE_FILE
    
    if not file_path.exists():
        print(f"{Colors.RED}ERROR:{Colors.END} {ATTENDANCE_FILE} not found")
        return
    
    file_size = file_path.stat().st_size / (1024 * 1024)
    print(f"\n[attendance] File size: {file_size:.2f}MB")
    print(f"[INFO] Uploading {ATTENDANCE_FILE}...")
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (ATTENDANCE_FILE, f, 'text/csv')}
            data = {
                'organization_id': org_id,
                'record_type': 'attendance',
                'source_name': 'university_attendance'
            }
            headers = {'Authorization': f'Bearer {token}'}
            
            response = requests.post(
                f"{API_BASE}/documents/upload",
                files=files,
                data=data,
                headers=headers,
                timeout=600  # 10 minutes for large file
            )
            
            if response.status_code == 200:
                result = response.json()
                doc_count = len(result.get('documents', []))
                print(f"{Colors.GREEN}✓{Colors.END} attendance: {doc_count} documents created")
                print(f"\n{Colors.GREEN}SUCCESS!{Colors.END} All 11 CSV files now uploaded!")
            else:
                print(f"{Colors.RED}✗{Colors.END} Error {response.status_code}")
                print(f"Response: {response.text}")
                
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} Upload failed: {str(e)}")
    
    print("\n" + "="*70 + "\n")

if __name__ == "__main__":
    main()
