import os
import base64
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

# The ALE_MASTER_KEY should be a 32-byte hex string (64 characters)
KEK_HEX = os.getenv("ALE_MASTER_KEY")

class CryptoManager:
    @staticmethod
    def decrypt_envelope(encrypted_data_bytes, encrypted_dek_b64, iv_b64, auth_tag_b64):
        """
        Decrypt data using envelope encryption.
        Matches the Node.js implementation logic.
        """
        if not KEK_HEX:
            raise ValueError("ALE_MASTER_KEY not configured in environment")
        
        kek = bytes.fromhex(KEK_HEX)
        
        # 1. Decode DEK and extract internal params
        full_encrypted_dek = base64.b64decode(encrypted_dek_b64)
        dek_iv = full_encrypted_dek[:12]
        dek_auth_tag = full_encrypted_dek[12:28]
        actual_encrypted_dek = full_encrypted_dek[28:]
        
        # 2. Decrypt DEK using KEK
        dek_cipher = AES.new(kek, AES.MODE_GCM, nonce=dek_iv)
        dek = dek_cipher.decrypt_and_verify(actual_encrypted_dek, dek_auth_tag)
        
        # 3. Decrypt data using decrypted DEK
        data_iv = base64.b64decode(iv_b64)
        data_auth_tag = base64.b64decode(auth_tag_b64)
        
        data_cipher = AES.new(dek, AES.MODE_GCM, nonce=data_iv)
        decrypted_data = data_cipher.decrypt_and_verify(encrypted_data_bytes, data_auth_tag)
        
        return decrypted_data

    @staticmethod
    def encrypt_envelope(data_bytes):
        """
        Encrypt data using envelope encryption.
        Matches the Node.js implementation logic.
        """
        if not KEK_HEX:
            raise ValueError("ALE_MASTER_KEY not configured in environment")
            
        kek = bytes.fromhex(KEK_HEX)
        
        # 1. Generate random DEK
        dek = get_random_bytes(32)
        
        # 2. Encrypt data with DEK
        data_iv = get_random_bytes(12)
        data_cipher = AES.new(dek, AES.MODE_GCM, nonce=data_iv)
        encrypted_data, data_auth_tag = data_cipher.encrypt_and_digest(data_bytes)
        
        # 3. Encrypt DEK with KEK
        dek_iv = get_random_bytes(12)
        dek_cipher = AES.new(kek, AES.MODE_GCM, nonce=dek_iv)
        encrypted_dek_body, dek_auth_tag = dek_cipher.encrypt_and_digest(dek)
        
        # Package DEK as [IV][TAG][ENCRYPTED_BODY]
        full_encrypted_dek = dek_iv + dek_auth_tag + encrypted_dek_body
        
        return {
            "encryptedData": encrypted_data,
            "encryptedDEK": base64.b64encode(full_encrypted_dek).decode('utf-8'),
            "iv": base64.b64encode(data_iv).decode('utf-8'),
            "authTag": base64.b64encode(data_auth_tag).decode('utf-8')
        }
