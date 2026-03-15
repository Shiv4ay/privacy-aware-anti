import chromadb
from chromadb.config import Settings
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_id_in_chroma(org_id, bridge_id):
    client = chromadb.HttpClient(host='localhost', port=8000)
    # Based on app.py get_org_collection logic
    collection_name = f"privacy_documents_{org_id}"
    try:
        col = client.get_collection(name=collection_name)
        
        # 1. Try metadata exact get
        logger.info(f"Querying metadata for {bridge_id}")
        res = col.get(where={"source_id": bridge_id}, include=["documents", "metadatas"])
        logger.info(f"Metadata result count: {len(res['ids'])}")
        for i in range(len(res['ids'])):
            logger.info(f"DOC: {res['documents'][i]}")
            logger.info(f"META: {res['metadatas'][i]}")
            
        # 2. Try where_document contains
        logger.info(f"Querying document contains {bridge_id}")
        res2 = col.get(where_document={"$contains": bridge_id}, include=["documents", "metadatas"])
        logger.info(f"Document result count: {len(res2['ids'])}")
        for i in range(len(res2['ids'])):
            logger.info(f"DOC: {res2['documents'][i]}")
            logger.info(f"META: {res2['metadatas'][i]}")
            
    except Exception as e:
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    check_id_in_chroma(4, "COMP_MCA015")
