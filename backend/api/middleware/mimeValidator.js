/**
 * MIME Validation Middleware — M2 File Upload Security
 *
 * Validates uploaded files by inspecting their magic bytes (file header signature)
 * rather than trusting the extension or Content-Type header alone. An attacker can
 * rename evil.exe to evil.pdf — this guard catches that by reading the actual bytes.
 *
 * Allowed types: PDF, CSV, TXT
 * Returns HTTP 415 Unsupported Media Type for anything that doesn't match.
 */

// Magic byte signatures for allowed file types
const MAGIC_SIGNATURES = {
    pdf: {
        // PDF files always start with %PDF
        bytes: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
        offset: 0,
    },
};

// Extensions that are text-based (no reliable magic bytes — validated as UTF-8 text)
const TEXT_EXTENSIONS = new Set(['.csv', '.txt']);

// All allowed extensions
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.csv', '.txt']);

/**
 * Check if a buffer's first bytes match the expected magic signature.
 */
function _matchesMagic(buffer, sig) {
    if (buffer.length < sig.bytes.length + sig.offset) return false;
    for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[sig.offset + i] !== sig.bytes[i]) return false;
    }
    return true;
}

/**
 * Check if a buffer looks like valid UTF-8 text (no null bytes in first 512 bytes).
 * This is a lightweight heuristic — binary files almost always contain null bytes.
 */
function _looksLikeText(buffer) {
    const sample = buffer.slice(0, Math.min(512, buffer.length));
    return !sample.includes(0x00); // null byte = binary, not text
}

/**
 * Validate a file buffer against its claimed filename.
 *
 * @param {Buffer} buffer - File contents (at least first 512 bytes)
 * @param {string} originalname - Original filename (e.g. "report.pdf")
 * @returns {{ valid: boolean, reason: string }}
 */
function validateFileMime(buffer, originalname) {
    if (!buffer || buffer.length === 0) {
        return { valid: false, reason: 'Empty file' };
    }

    const ext = require('path').extname(originalname || '').toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return {
            valid: false,
            reason: `Extension '${ext}' not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
        };
    }

    if (ext === '.pdf') {
        if (!_matchesMagic(buffer, MAGIC_SIGNATURES.pdf)) {
            return {
                valid: false,
                reason: 'File claims to be PDF but does not have a valid PDF signature (%PDF header missing). Possible spoofed extension.',
            };
        }
        return { valid: true, reason: 'Valid PDF' };
    }

    if (TEXT_EXTENSIONS.has(ext)) {
        if (!_looksLikeText(buffer)) {
            return {
                valid: false,
                reason: `File claims to be ${ext} but contains binary data (null bytes). Possible spoofed extension.`,
            };
        }
        return { valid: true, reason: `Valid ${ext} text file` };
    }

    // Unreachable given ALLOWED_EXTENSIONS check above, but safe fallback
    return { valid: false, reason: 'Unrecognised file type' };
}

/**
 * Express middleware: reads the uploaded file's buffer and validates MIME.
 * Must be called AFTER multer (req.file must exist).
 * Cleans up the temp file and returns 415 on failure.
 */
function mimeValidationMiddleware(req, res, next) {
    if (!req.file) return next();

    const fs = require('fs');
    const filePath = req.file.path;

    let buffer;
    try {
        // Read only first 512 bytes for the signature check — fast, low memory
        const fd = fs.openSync(filePath, 'r');
        buffer = Buffer.alloc(512);
        const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
        fs.closeSync(fd);
        buffer = buffer.slice(0, bytesRead);
    } catch (e) {
        try { fs.unlinkSync(filePath); } catch (_) {}
        return res.status(500).json({ error: 'Could not read uploaded file for validation' });
    }

    const result = validateFileMime(buffer, req.file.originalname);

    if (!result.valid) {
        try { fs.unlinkSync(filePath); } catch (_) {}
        return res.status(415).json({
            error: 'Unsupported file type',
            detail: result.reason,
        });
    }

    next();
}

module.exports = { validateFileMime, mimeValidationMiddleware };
