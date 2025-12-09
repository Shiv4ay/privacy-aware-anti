from abc import ABC, abstractmethod
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class IngestionPipeline(ABC):
    """
    Abstract base class for ingestion pipelines.
    Defines the standard flow: fetch -> clean -> chunk -> embed -> store.
    """

    def __init__(self, org_id: int):
        self.org_id = org_id

    @abstractmethod
    def fetch(self) -> List[Dict[str, Any]]:
        """
        Fetches content from the source.
        Returns a list of dictionaries, each containing 'text' and 'metadata'.
        """
        pass

    def clean_text(self, text: str) -> str:
        """
        Cleans the text (removes extra whitespace, etc.).
        Can be overridden by subclasses if specific cleaning is needed.
        """
        if not text:
            return ""
        return " ".join(text.split())

    # Note: Chunking, Embedding, and Storing are typically handled by the main app logic 
    # (using the shared functions in app.py like chunk_text, get_embedding, chromadb_add).
    # However, we can define a run() method here that orchestrates the fetch and returns data 
    # ready for the main app to process.
    
    def run(self) -> List[Dict[str, Any]]:
        """
        Executes the ingestion pipeline up to the point of returning processed data.
        The actual embedding and storage might be handled by the caller (app.py) 
        to reuse existing logic, or we can inject the storage handler here.
        For now, we return the data.
        """
        logger.info(f"Starting ingestion for Org {self.org_id}")
        raw_data = self.fetch()
        processed_data = []
        
        for item in raw_data:
            text = self.clean_text(item.get('text', ''))
            if text:
                item['text'] = text
                item['metadata']['org_id'] = self.org_id
                processed_data.append(item)
                
        logger.info(f"Fetched and cleaned {len(processed_data)} items")
        return processed_data
