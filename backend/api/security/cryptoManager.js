/**
 * Crypto Manager
 * Handles Application-Level Encryption (ALE) using Envelope Encryption.
 * 
 * Strategy:
 * 1. Data is encrypted with a unique Data Encryption Key (DEK).
 * 2. The DEK is encrypted with a Master Key (KEK) from environment variables.
 * 3. AES-256-GCM is used for both encryption steps to ensure integrity.
 */

const crypto = require('crypto');

// The ALE_MASTER_KEY should be a 32-byte hex string (64 characters)
const KEK = process.env.ALE_MASTER_KEY;

if (!KEK || KEK.length !== 64) {
    console.error('[ALE] WARNING: ALE_MASTER_KEY is missing or invalid. Encryption will fail.');
}

/**
 * Encrypt a buffer using envelope encryption
 * @param {Buffer} data - The data to encrypt
 * @returns {Object} - { encryptedData, encryptedDEK, iv, authTag }
 */
function encryptEnvelope(data) {
    if (!KEK) throw new Error('ALE_MASTER_KEY not configured');

    // 1. Generate a random Data Encryption Key (DEK)
    const dek = crypto.randomBytes(32);

    // 2. Encrypt the data with the DEK
    const iv = crypto.randomBytes(12); // GCM standard IV length
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. Encrypt the DEK with the Master Key (KEK)
    const kekBuffer = Buffer.from(KEK, 'hex');
    const dekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv('aes-256-gcm', kekBuffer, dekIv);

    const encryptedDEK = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekAuthTag = dekCipher.getAuthTag();

    return {
        encryptedData,
        // We store the encrypted DEK along with its own IV and auth tag
        encryptedDEK: Buffer.concat([dekIv, dekAuthTag, encryptedDEK]).toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
    };
}

/**
 * Decrypt a buffer using envelope encryption
 * @param {Buffer} encryptedData - The data to decrypt
 * @param {String} encryptedDEKBase64 - The DEK encrypted by KEK (includes IV and Tag)
 * @param {String} ivBase64 - The IV for the data
 * @param {String} authTagBase64 - The Auth Tag for the data
 * @returns {Buffer} - Decrypted data
 */
function decryptEnvelope(encryptedData, encryptedDEKBase64, ivBase64, authTagBase64) {
    if (!KEK) throw new Error('ALE_MASTER_KEY not configured');

    try {
        const kekBuffer = Buffer.from(KEK, 'hex');
        const fullEncryptedDEK = Buffer.from(encryptedDEKBase64, 'base64');

        // 1. Extract DEK encryption params
        const dekIv = fullEncryptedDEK.slice(0, 12);
        const dekAuthTag = fullEncryptedDEK.slice(12, 28);
        const actualEncryptedDEK = fullEncryptedDEK.slice(28);

        // 2. Decrypt the DEK using the KEK
        const dekDecipher = crypto.createDecipheriv('aes-256-gcm', kekBuffer, dekIv);
        dekDecipher.setAuthTag(dekAuthTag);
        const dek = Buffer.concat([dekDecipher.update(actualEncryptedDEK), dekDecipher.final()]);

        // 3. Decrypt the data using the decrypted DEK
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    } catch (error) {
        console.error('[ALE] Decryption failed:', error.message);
        throw new Error('Data decryption failed. This usually means the key or integrity check is invalid.');
    }
}

module.exports = {
    encryptEnvelope,
    decryptEnvelope
};
