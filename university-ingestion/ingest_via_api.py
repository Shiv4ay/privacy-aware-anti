"""
University CSV Ingestion via RAG API
Uploads CSV files from University dataset to Privacy-Aware RAG system
"""
import os
import sys
import requests
from pathlib import Path
import time

# Configuration
API_BASE = "http://localhost:3001/api"
DATASET_PATH = "C:/project3/AntiGravity/Datasets/University/final"

# CSV files to ingest
CSV_FILES = {
    "students": "students.csv",
    "results": "results.csv",
    "placements": "placements.csv",
    "internships": "internships.csv",
    "faculty": "faculty.csv",
    "courses": "courses.csv",
    "departments": "departments.csv",
    "companies": "companies.csv",
    "alumni": "alumni.csv",
    "attendance": "attendance.csv",  # Large file: 25MB
    "users": "users.csv"
}

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

def upload_csv(file_path, record_type, org_id, token):
    """
    Upload a CSV file to the RAG API
    
    Args:
        file_path: Path to CSV file
        record_type: Type of records (students, results, etc.)
        org_id: Organization ID
        token: JWT access token
    
    Returns:
        dict: API response
    """
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, 'text/csv')}
            data = {
                'organization_id': org_id,
                'record_type': record_type,
                'source_name': f'university_{record_type}'
            }
            headers = {'Authorization': f'Bearer {token}'}
            
            print(f"{Colors.BLUE}[INFO]{Colors.END} Uploading {file_path.name}...")
            
            response = requests.post(
                f"{API_BASE}/documents/upload",
                files=files,
                data=data,
                headers=headers,
                timeout=300  # 5 minutes for large files
            )
            
            if response.status_code == 200:
                result = response.json()
                doc_count = len(result.get('documents', []))
                print(f"{Colors.GREEN}✓{Colors.END} {record_type}: {doc_count} documents created")
                return result
            else:
                print(f"{Colors.RED}✗{Colors.END} {record_type}: Error {response.status_code}")
                print(f"   Response: {response.text}")
                return None
                
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} {record_type}: {str(e)}")
        return None

def verify_api_health():
    """Check if API is running"""
    try:
        response = requests.get(f"{API_BASE.replace('/api', '')}/api/health", timeout=5)
        if response.status_code == 200:
            print(f"{Colors.GREEN}✓{Colors.END} API is healthy")
            return True
        else:
            print(f"{Colors.RED}✗{Colors.END} API returned {response.status_code}")
            return False
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} API not reachable: {str(e)}")
        return False

def main():
    """Main ingestion process"""
    print("\n" + "="*70)
    print("UNIVERSITY CSV INGESTION SERVICE".center(70))
    print("="*70)
    print(f"Dataset Path: {DATASET_PATH}")
    print(f"API Base: {API_BASE}")
    print("="*70 + "\n")
    
    # Check if API is healthy
    if not verify_api_health():
        print(f"\n{Colors.RED}ERROR:{Colors.END} API is not running. Please start the backend first.")
        sys.exit(1)
    
    # Get organization ID and token from user
    print(f"\n{Colors.YELLOW}SETUP REQUIRED:{Colors.END}")
    print("1. Login to http://localhost:3000/login as super admin")
    print("2. Create an organization (e.g., 'MIT University')")
    print("3. Copy the organization ID from the dashboard")
    print("4. Copy your JWT token from DevTools → Application → Local Storage → accessToken")
    print()
    
    org_id = input(f"{Colors.BLUE}Enter Organization ID:{Colors.END} ").strip()
    if not org_id:
        print(f"{Colors.RED}ERROR:{Colors.END} Organization ID is required")
        sys.exit(1)
    
    token = input(f"{Colors.BLUE}Enter JWT Token:{Colors.END} ").strip()
    if not token:
        print(f"{Colors.RED}ERROR:{Colors.END} JWT token is required")
        sys.exit(1)
    
    print(f"\n{Colors.GREEN}✓{Colors.END} Configuration complete")
    print("="*70 + "\n")
    
    # Upload each CSV file
    results = {}
    dataset_path = Path(DATASET_PATH)
    
    for record_type, filename in CSV_FILES.items():
        file_path = dataset_path / filename
        
        if not file_path.exists():
            print(f"{Colors.YELLOW}⊘{Colors.END} {record_type}: File not found - {filename}")
            continue
        
        file_size = file_path.stat().st_size / (1024 * 1024)  # MB
        print(f"\n[{record_type}] File size: {file_size:.2f}MB")
        
        result = upload_csv(file_path, record_type, org_id, token)
        results[record_type] = result
        
        # Small delay between uploads
        time.sleep(1)
    
    # Print summary
    print("\n" + "="*70)
    print("INGESTION SUMMARY".center(70))
    print("="*70)
    
    successful = sum(1 for r in results.values() if r is not None)
    total = len(results)
    
    print(f"Total Files: {total}")
    print(f"Successful: {successful}")
    print(f"Failed: {total - successful}")
    
    print("\n" + "="*70)
    print(f"{Colors.GREEN}INGESTION COMPLETE{Colors.END}".center(70))
    print("="*70 + "\n")
    
    print(f"{Colors.BLUE}Next Steps:{Colors.END}")
    print("1. Login to the application as an admin user of your organization")
    print("2. Go to Search page")
    print("3. Try queries like:")
    print("   - 'Show me students in computer science'")
    print("   - 'List all placements'")
    print("   - 'Faculty in engineering department'")
    print()

if __name__ == "__main__":
    main()
