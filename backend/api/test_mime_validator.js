/**
 * M2 — File Upload MIME Validation Tests
 * TDD RED→GREEN cycle
 *
 * Tests validateFileMime() from middleware/mimeValidator.js using Node's
 * built-in assert module (no test framework dependency).
 *
 * Run: node test_mime_validator.js   (inside the privacy-aware-api container
 *      or directly on host with node installed)
 */
'use strict';

const assert = require('assert');
const { validateFileMime } = require('./middleware/mimeValidator');

const PASS = '\x1b[92m✓\x1b[0m';
const FAIL = '\x1b[91m✗\x1b[0m';

let passed = 0;
let failed = 0;

function check(label, fn) {
    try {
        fn();
        console.log(`  ${PASS}  ${label}`);
        passed++;
    } catch (e) {
        console.log(`  ${FAIL}  ${label}  [${e.message}]`);
        failed++;
    }
}

console.log('\n══════════════════════════════════════════════');
console.log('  M2 — File Upload MIME Validation Tests');
console.log('══════════════════════════════════════════════\n');

// ── Helpers ────────────────────────────────────────────────────────────────
function makePdfBuffer() {
    // Minimal valid PDF header: starts with %PDF-1.4
    const buf = Buffer.alloc(64, 0x20); // spaces
    buf.write('%PDF-1.4', 0, 'ascii');
    return buf;
}

function makeCsvBuffer(content = 'name,age\nAlice,30\nBob,25') {
    return Buffer.from(content, 'utf8');
}

function makeBinaryBuffer() {
    // Binary data with null bytes — simulates an exe/zip
    const buf = Buffer.alloc(64, 0xff);
    buf[0] = 0x4d; buf[1] = 0x5a; // MZ header (Windows EXE)
    buf[10] = 0x00; // null byte
    return buf;
}

// ── Test group 1: Valid files ───────────────────────────────────────────────
console.log('── Group 1: Valid files pass through ──');

check('Real PDF buffer + .pdf name → valid', () => {
    const r = validateFileMime(makePdfBuffer(), 'report.pdf');
    assert.strictEqual(r.valid, true, `Expected valid=true, got: ${r.reason}`);
});

check('CSV text buffer + .csv name → valid', () => {
    const r = validateFileMime(makeCsvBuffer(), 'data.csv');
    assert.strictEqual(r.valid, true, `Expected valid=true, got: ${r.reason}`);
});

check('Plain text buffer + .txt name → valid', () => {
    const r = validateFileMime(Buffer.from('Hello world\n'), 'notes.txt');
    assert.strictEqual(r.valid, true, `Expected valid=true, got: ${r.reason}`);
});

// ── Test group 2: Spoofed extensions (the core attack vector) ──────────────
console.log('\n── Group 2: Spoofed extensions → blocked ──');

check('Binary .exe renamed as .pdf → 415 (invalid, missing %PDF header)', () => {
    const fakePdf = makeBinaryBuffer();
    const r = validateFileMime(fakePdf, 'malware.pdf');
    assert.strictEqual(r.valid, false, 'Expected valid=false for binary data with .pdf extension');
    assert.ok(r.reason.includes('PDF signature') || r.reason.includes('header'), `reason: ${r.reason}`);
});

check('Binary data renamed as .csv → 415 (binary, has null bytes)', () => {
    const fakeCsv = makeBinaryBuffer();
    const r = validateFileMime(fakeCsv, 'payload.csv');
    assert.strictEqual(r.valid, false, 'Expected valid=false for binary data with .csv extension');
});

check('Binary data renamed as .txt → 415 (binary, has null bytes)', () => {
    const fakeTxt = makeBinaryBuffer();
    const r = validateFileMime(fakeTxt, 'shell.txt');
    assert.strictEqual(r.valid, false, 'Expected valid=false for binary data with .txt extension');
});

// ── Test group 3: Disallowed extensions ────────────────────────────────────
console.log('\n── Group 3: Disallowed extensions → blocked ──');

check('.exe extension → blocked regardless of content', () => {
    const r = validateFileMime(Buffer.from('harmless'), 'virus.exe');
    assert.strictEqual(r.valid, false);
});

check('.js extension → blocked', () => {
    const r = validateFileMime(Buffer.from('console.log("hi")'), 'script.js');
    assert.strictEqual(r.valid, false);
});

check('.sh extension → blocked', () => {
    const r = validateFileMime(Buffer.from('#!/bin/bash\nrm -rf /'), 'evil.sh');
    assert.strictEqual(r.valid, false);
});

check('No extension → blocked', () => {
    const r = validateFileMime(makePdfBuffer(), 'noextension');
    assert.strictEqual(r.valid, false);
});

// ── Test group 4: Edge cases ────────────────────────────────────────────────
console.log('\n── Group 4: Edge cases ──');

check('Empty buffer → invalid (not a valid file)', () => {
    const r = validateFileMime(Buffer.alloc(0), 'empty.pdf');
    assert.strictEqual(r.valid, false);
});

check('null buffer → invalid (graceful)', () => {
    const r = validateFileMime(null, 'file.pdf');
    assert.strictEqual(r.valid, false);
});

check('No filename → blocked (ext check fails)', () => {
    const r = validateFileMime(makePdfBuffer(), '');
    assert.strictEqual(r.valid, false);
});

check('PDF buffer with uppercase .PDF extension → valid (case insensitive)', () => {
    const r = validateFileMime(makePdfBuffer(), 'REPORT.PDF');
    assert.strictEqual(r.valid, true, `Expected valid=true, got: ${r.reason}`);
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  Results: ${passed}/${passed + failed} tests passed`);
if (failed === 0) {
    console.log('  \x1b[92mALL PASS — M2 MIME validation is working\x1b[0m');
} else {
    console.log(`  \x1b[91m${failed} FAILING\x1b[0m`);
}
console.log('══════════════════════════════════════════════\n');

process.exit(failed === 0 ? 0 : 1);
