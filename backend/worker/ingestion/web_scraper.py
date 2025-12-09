import requests
from bs4 import BeautifulSoup
import logging
import re

logger = logging.getLogger(__name__)

class WebScraper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def clean_text(self, text):
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def scrape_url(self, url):
        try:
            logger.info(f"Scraping URL: {url}")
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()

            # Extract title
            title = soup.title.string if soup.title else url

            # Extract text
            text = soup.get_text()
            cleaned_text = self.clean_text(text)

            return {
                "title": title,
                "content": cleaned_text,
                "url": url,
                "status": "success"
            }

        except Exception as e:
            logger.error(f"Failed to scrape {url}: {str(e)}")
            return {
                "url": url,
                "status": "failed",
                "error": str(e)
            }

    def scrape_dummy_site(self, dummy_type):
        """
        Simulates scraping a dummy site by using a relevant Wikipedia page.
        """
        urls = {
            "dummy_university": "https://en.wikipedia.org/wiki/University",
            "dummy_hospital": "https://en.wikipedia.org/wiki/Hospital",
            "dummy_finance": "https://en.wikipedia.org/wiki/Finance"
        }

        url = urls.get(dummy_type)
        if not url:
            raise ValueError(f"Unknown dummy type: {dummy_type}")

        return self.scrape_url(url)

class WebIngestion:
    """
    Adapter class to fit the ingestion pipeline interface.
    """
    def __init__(self, org_id, url):
        self.org_id = org_id
        self.url = url
        self.scraper = WebScraper()

    def run(self):
        result = self.scraper.scrape_url(self.url)
        if result['status'] == 'failed':
            raise Exception(f"Scraping failed: {result.get('error')}")

        return [{
            "text": result['content'],
            "metadata": {
                "title": result['title'],
                "source": result['url'],
                "type": "web"
            }
        }]
