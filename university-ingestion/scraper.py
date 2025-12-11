"""
Dummy University Website Scraper
Scrapes HTML content from dummy university website and uploads to RAG API
"""
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import sys
import time

# Configuration
UNIVERSITY_URL = "http://localhost:8002"
API_BASE = "http://localhost:3001/api"

# Color codes
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

# Pages to scrape
PAGES = [
    {'path': '/', 'title': 'Homepage'},
    {'path': '/about', 'title': 'About University'},
    {'path': '/departments', 'title': 'Departments'},
    {'path': '/students', 'title': 'Student Portal'},
    {'path': '/faculty', 'title': 'Faculty Directory'},
   {'path': '/courses', 'title': 'Course Catalog'},
    {'path': '/placements', 'title': 'Placements'},
    {'path': '/admission', 'title': 'Admissions'},
    {'path': '/contact', 'title': 'Contact Us'}
]

def scrape_page(url, page_title):
    """
    Scrape content from a single page
    
    Args:
        url: Full URL to scrape
        page_title: Title for the page
    
    Returns:
        dict: Page content and metadata
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract title
        title = soup.find('title')
        title_text = title.text if title else page_title
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text content
        content = soup.get_text(separator='\n', strip=True)
        
        # Clean up extra whitespace
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        clean_content = '\n'.join(lines)
        
        return {
            'title': title_text,
            'url': url,
            'content': clean_content,
            'page_name': page_title
        }
    
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} Failed to scrape {url}: {str(e)}")
        return None

def upload_page(page_data, org_id, token):
    """
    Upload scraped page content to API
    
    Args:
        page_data: Dictionary with page content
        org_id: Organization ID
        token: JWT token
    
    Returns:
        bool: Success status
    """
    try:
        # Create a temporary HTML file
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>{page_data['title']}</title>
</head>
<body>
{page_data['content']}
</body>
</html>
"""
        
        # Convert to bytes for upload
        files = {
            'file': (f"{page_data['page_name']}.html", html_content.encode('utf-8'), 'text/html')
        }
        
        data = {
            'organization_id': org_id,
            'record_type': 'webpage',
            'source_name': f"dummy_university_{page_data['page_name']}"
        }
        
        headers = {'Authorization': f'Bearer {token}'}
        
        response = requests.post(
            f"{API_BASE}/documents/upload",
            files=files,
            data=data,
            headers=headers,
            timeout=60
        )
        
        if response.status_code == 200:
            print(f"{Colors.GREEN}✓{Colors.END} {page_data['page_name']}")
            return True
        else:
            print(f"{Colors.RED}✗{Colors.END} {page_data['page_name']}: {response.status_code}")
            print(f"   {response.text}")
            return False
            
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} Upload failed: {str(e)}")
        return False

def check_university_api():
    """Check if dummy university API is running"""
    try:
        response = requests.get(UNIVERSITY_URL, timeout=5)
        if response.status_code == 200:
            print(f"{Colors.GREEN}✓{Colors.END} Dummy University API is running")
            return True
        else:
            print(f"{Colors.YELLOW}⚠{Colors.END} Dummy University API returned {response.status_code}")
            return False
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} Dummy University API not reachable: {str(e)}")
        return False

def main():
    """Main scraper process"""
    print("\n" + "="*70)
    print("DUMMY UNIVERSITY WEBSITE SCRAPER".center(70))
    print("="*70)
    print(f"Source: {UNIVERSITY_URL}")
    print(f"API: {API_BASE}")
    print("="*70 + "\n")
    
    # Check if dummy university API is running
    if not check_university_api():
        print(f"\n{Colors.RED}ERROR:{Colors.END} Dummy University API is not running")
        print(f"{Colors.YELLOW}Please start it with:{Colors.END}")
        print(f"  cd C:/project3/AntiGravity/Dummy-Systems/dummy-university")
        print(f"  python main.py")
        sys.exit(1)
    
    # Get configuration from user
    print(f"\n{Colors.YELLOW}SETUP:{Colors.END}")
    org_id = input(f"{Colors.BLUE}Enter Organization ID:{Colors.END} ").strip()
    if not org_id:
        print(f"{Colors.RED}ERROR:{Colors.END} Organization ID required")
        sys.exit(1)
    
    token = input(f"{Colors.BLUE}Enter JWT Token:{Colors.END} ").strip()
    if not token:
        print(f"{Colors.RED}ERROR:{Colors.END} JWT token required")
        sys.exit(1)
    
    print(f"\n{Colors.GREEN}✓{Colors.END} Configuration complete\n")
    print("="*70)
    print(f"Scraping {len(PAGES)} pages...")
    print("="*70 + "\n")
    
    # Scrape and upload each page
    successful = 0
    failed = 0
    
    for page in PAGES:
        url = f"{UNIVERSITY_URL}{page['path']}"
        print(f"[{page['title']}] Scraping {url}...")
        
        page_data = scrape_page(url, page['title'])
        
        if page_data:
            if upload_page(page_data, org_id, token):
                successful += 1
            else:
                failed += 1
        else:
            failed += 1
        
        # Small delay
        time.sleep(0.5)
    
    # Summary
    print("\n" + "="*70)
    print("SCRAPING SUMMARY".center(70))
    print("="*70)
    print(f"Total Pages: {len(PAGES)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print("="*70 + "\n")
    
    print(f"{Colors.GREEN}COMPLETE!{Colors.END}\n")

if __name__ == "__main__":
    main()
