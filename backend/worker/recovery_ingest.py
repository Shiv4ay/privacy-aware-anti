import csv
import os
import json
import base64
import psycopg2
from app import CryptoManager, ingest_envelope if 'ingest_envelope' in locals() else None

# Manual recovery script for PES1PG24CA169 in Org 4
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secure_password@postgres:5432/privacy_doc") # Note: was privacy_docs in my previous psql calls
# Double check the DB name
DB_NAME = "privacy_docs"

SRN = "PES1PG24CA169"
ORG_ID = 4
FILENAME = "students.csv"
CSV_PATH = r"c:\project3\AntiGravity\Datasets\University\pes_mca_dataset\students.csv"

def get_db_conn():
    return psycopg2.connect(f"postgresql://admin:secure_password@postgres:5432/{DB_NAME}")

def manual_ingest():
    print(f"Starting recovery for {SRN} into Org {ORG_ID}...")
    
    # 1. Read the CSV
    student_row = None
    with open(CSV_PATH, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('srn') == SRN:
                student_row = row
                break
    
    if not student_row:
        print(f"Error: {SRN} not found in {CSV_PATH}")
        return

    print(f"Found row for {SRN}: {student_row['first_name']} {student_row['last_name']}")

    # 2. Encrypt Metadata (Simulating internal API)
    # We need to match the structure in documents.js
    metadata = {
        **student_row,
        "record_type": "STUDENT_RECORD",
        "source": "manual_recovery"
    }
    
    # Re-implementing the encryption logic from documents.js/cryptoManager.js
    # Or better, we can just use the database's existing structure
    
    # Since I don't have direct access to the Encryption function used by the API easily (it's in JS),
    # and I need it to be decryptable by the worker (python), I'll check how the worker decrypts.
    
    # Actually, app.py has a CryptoManager!
    if not CryptoManager:
        print("Error: CryptoManager not available in app.py")
        return

    # Encrypt the metadata string
    metadata_json = json.dumps(metadata)
    # Note: app.py uses encrypt_envelope if available, but I need to see what it exposes.
    # Looking at documents.js: it returns { encryptedData, encryptedDEK, iv, authTag }
    
    # I'll just insert it as-is if I can't encrypt, but better to encrypt to stay consistent.
    # Let's see if app.py provides an encryption tool.
    
    try:
        # In documents.js: encryptEnvelope(Buffer.from(metadataString))
        # Let's try to find an encryption method in CryptoManager (Python)
        # If not, I'll insert it unencrypted and see if the worker handles it (unlikely)
        
        # Actually, if I am "AntiGravity", I can just write a small JS tool to encrypt?
        # No, I'll use the Python one if possible.
        
        # Let's check what CryptoManager has.
        print("Checking CryptoManager methods...")
        # print(dir(CryptoManager))
        
        # In app.py line 40: decrypt_envelope exists. I bet encrypt_envelope exists too.
        
        # Wait, I'll just use the EXISTING record from Org 1 if it has all the data!
        # Let's check Org 1's record for this student.
    except Exception as e:
        print(f"Error checking CryptoManager: {e}")

manual_ingest()
