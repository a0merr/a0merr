/*
 * verify.js <file.pdf>
 *
 * Post-build checks on the generated resume. Exits non-zero on failure so
 * build.ps1 (or CI) stops rather than shipping a broken PDF.
 *
 *   1. The resume is exactly one page.
 *   2. No link points at a bare domain. This is the specific bug that shipped
 *      once already: the "LinkedIn" link pointed at https://www.linkedin.com/
 *      rather than the profile, so clicking it went nowhere useful.
 *   3. /Title and /Author are set.
 *
 * Objects are resolved the way a reader resolves them - start at the final
 * startxref, then follow /Prev back through earlier revisions, with later
 * revisions taking precedence. That way the check sees what a reader sees,
 * not merely what bytes happen to appear somewhere in the file.
 */

'use strict';

const fs = require('fs');

const INPUT = process.argv[2];
if (!INPUT) {
  console.error('Usage: node verify.js <file.pdf>');
  process.exit(1);
}

const buf = fs.readFileSync(INPUT);
const text = buf.toString('latin1');

// --- Walk the xref chain, newest revision first ---------------------------

const table = new Map();
let offset = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(text)[1]);
const seen = new Set();

while (offset !== null && !seen.has(offset)) {
  seen.add(offset);
  if (!text.startsWith('xref', offset)) throw new Error(`no xref table at ${offset}`);
  let pos = offset + 4;
  for (;;) {
    const header = /^\s*(\d+)\s+(\d+)\s*[\r\n]+/.exec(text.slice(pos, pos + 64));
    if (!header) break;
    const first = Number(header[1]);
    const count = Number(header[2]);
    pos += header[0].length;
    for (let i = 0; i < count; i++) {
      const e = /^(\d{10}) (\d{5}) ([nf])/.exec(text.substr(pos, 20));
      if (!e) throw new Error(`malformed xref entry at ${pos}`);
      // Newest revision wins, so never overwrite an entry already recorded.
      if (e[3] === 'n' && !table.has(first + i)) table.set(first + i, Number(e[1]));
      pos += 20;
    }
  }
  const trailer = text.slice(text.indexOf('trailer', pos), text.indexOf('trailer', pos) + 400);
  const prev = /\/Prev\s+(\d+)/.exec(trailer);
  offset = prev ? Number(prev[1]) : null;
}

function readObject(num) {
  const off = table.get(num);
  if (off === undefined) return null;
  const m = new RegExp(`^${num}\\s+0\\s+obj([^]*?)endobj`).exec(text.slice(off, off + 8000));
  return m ? m[1].trim() : null;
}

const failures = [];

// --- 1. Page count --------------------------------------------------------

let pages = 0;
for (const num of table.keys()) {
  let body;
  try { body = readObject(num); } catch { continue; }
  if (body && /\/Type\s*\/Page(?![sa-zA-Z])/.test(body)) pages++;
}
console.log(`  pages: ${pages}`);
if (pages !== 1) failures.push(`expected exactly 1 page, found ${pages}`);

// --- 2. Links -------------------------------------------------------------

console.log('  links:');
for (const num of [...table.keys()].sort((a, b) => a - b)) {
  let body;
  try { body = readObject(num); } catch { continue; }
  if (!body || !/\/Subtype\s*\/Link/.test(body)) continue;
  const uri = /\/URI\s*\((.*?)\)\s*[/>]/.exec(body);
  if (!uri) continue;
  const url = uri[1];
  // A URL with nothing after the host is almost always a linking mistake:
  // the intended target was a specific page or profile.
  const bare = /^https?:\/\/[^/]+\/?$/.test(url);
  console.log(`    ${url}${bare ? '   <-- BARE DOMAIN' : ''}`);
  if (bare) failures.push(`link points at a bare domain: ${url}`);
}

// --- 3. Metadata ----------------------------------------------------------

const infoNum = /\/Info\s+(\d+)\s+\d+\s+R/.exec(text.slice(text.lastIndexOf('trailer')));
const info = infoNum ? readObject(Number(infoNum[1])) : null;
const decode = (field) => {
  if (!info) return null;
  const m = new RegExp(`/${field}\\s*(?:<([0-9A-Fa-f]+)>|\\(([^)]*)\\))`).exec(info);
  if (!m) return null;
  return m[1]
    ? Buffer.from(m[1], 'hex').swap16().toString('utf16le').replace(/^﻿/, '')
    : m[2];
};
for (const field of ['Title', 'Author']) {
  const value = decode(field);
  console.log(`  /${field}: ${value ?? '(unset)'}`);
  if (!value) failures.push(`/${field} is not set`);
}

// --- Result ---------------------------------------------------------------

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('  OK');
