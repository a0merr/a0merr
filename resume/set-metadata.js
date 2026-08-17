/*
 * set-metadata.js <input.pdf> <output.pdf>
 *
 * Sets the PDF's /Title and /Author. Chrome's print-to-PDF copies the HTML
 * <title> into /Title but leaves /Author unset, which shows up as a blank or
 * placeholder author in Acrobat's document properties.
 *
 * The edit is written as a PDF *incremental update*: a fresh copy of the
 * /Info object, a small cross-reference section covering just that object,
 * and a new trailer whose /Prev chains back to the original xref. Nothing
 * already in the file is rewritten, so every byte offset recorded in the
 * original xref table remains correct. Rewriting in place would shift every
 * object after the edit and invalidate the whole table.
 */

'use strict';

const fs = require('fs');

const TITLE = 'Andrew Merritt - Resume';
const AUTHOR = 'Andrew Merritt';

const [, , INPUT, OUTPUT] = process.argv;
if (!INPUT || !OUTPUT) {
  console.error('Usage: node set-metadata.js <input.pdf> <output.pdf>');
  process.exit(1);
}

/* Text strings are written as UTF-16BE with a byte-order mark, the encoding
 * PDF defines for text that may fall outside PDFDocEncoding. Plain ASCII
 * would work for these two values, but this stays correct if the name ever
 * gains an accent. */
function utf16beHex(str) {
  return '<' + Buffer.from('﻿' + str, 'utf16le').swap16().toString('hex').toUpperCase() + '>';
}

const original = fs.readFileSync(INPUT);
const text = original.toString('latin1');

const startxref = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
if (!startxref) throw new Error('No trailing startxref/%%EOF - not a well-formed PDF');
const prevXref = Number(startxref[1]);

// Read the last trailer; that is the one the new revision must extend.
const trailerText = text.slice(text.lastIndexOf('trailer'));
const grab = (re, what) => {
  const m = re.exec(trailerText);
  if (!m) throw new Error(`Could not find ${what} in trailer`);
  return m;
};

const size = Number(grab(/\/Size\s+(\d+)/, '/Size')[1]);
const root = grab(/\/Root\s+(\d+\s+\d+\s+R)/, '/Root')[1];
const infoMatch = grab(/\/Info\s+(\d+)\s+(\d+)\s+R/, '/Info');
const infoNum = Number(infoMatch[1]);
const infoRef = `${infoMatch[1]} ${infoMatch[2]} R`;

/* /ID is optional (Chrome omits it) but should be carried forward when it
 * exists - readers treat its first element as the file's identity across
 * revisions. */
const idMatch = /\/ID\s*\[\s*<([0-9A-Fa-f]*)>\s*<([0-9A-Fa-f]*)>\s*\]/.exec(trailerText);

// Preserve whatever provenance fields the producer already wrote.
const infoObj = new RegExp(`(?:^|[^0-9])${infoNum}\\s+0\\s+obj\\s*<<([^]*?)>>\\s*endobj`, 'm').exec(text);
if (!infoObj) throw new Error(`Could not read /Info object ${infoNum}`);
const infoBody = infoObj[1];

const keep = [];
for (const field of ['Creator', 'Producer', 'CreationDate']) {
  const m = new RegExp(`/${field}\\s*(<[0-9A-Fa-f]*>|\\((?:[^()\\\\]|\\\\.)*\\))`).exec(infoBody);
  if (m) keep.push(`/${field}${m[1]}`);
}

const now = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const modDate =
  `(D:${now.getUTCFullYear()}${p2(now.getUTCMonth() + 1)}${p2(now.getUTCDate())}` +
  `${p2(now.getUTCHours())}${p2(now.getUTCMinutes())}${p2(now.getUTCSeconds())}Z)`;

const newInfo =
  `<</Title${utf16beHex(TITLE)}\n/Author${utf16beHex(AUTHOR)}\n` +
  (keep.length ? keep.join('\n') + '\n' : '') +
  `/ModDate${modDate}>>`;

// --- Build the appended revision -----------------------------------------

let chunk = original.slice(-1).toString('latin1') === '\n' ? '' : '\n';
const infoOffset = original.length + Buffer.byteLength(chunk, 'latin1');
chunk += `${infoNum} 0 obj\n${newInfo}\nendobj\n`;

const xrefOffset = original.length + Buffer.byteLength(chunk, 'latin1');

/* Each entry is exactly 20 bytes: a 10-digit offset, a space, a 5-digit
 * generation number, a space, the keyword, then a two-byte end-of-line.
 * A reader seeks by multiplying the index by 20, so a single byte off here
 * corrupts every following entry. */
const entry = (off, gen, kw) =>
  `${String(off).padStart(10, '0')} ${String(gen).padStart(5, '0')} ${kw} \n`;

const xref =
  'xref\n' +
  '0 1\n' + entry(0, 65535, 'f') +
  `${infoNum} 1\n` + entry(infoOffset, 0, 'n');

const trailer =
  `trailer\n<</Size ${size}/Root ${root}/Info ${infoRef}` +
  (idMatch ? `/ID [ <${idMatch[1]}> <${idMatch[2]}> ]` : '') +
  `/Prev ${prevXref}>>\n` +
  `startxref\n${xrefOffset}\n%%EOF\n`;

fs.writeFileSync(OUTPUT, Buffer.concat([original, Buffer.from(chunk + xref + trailer, 'latin1')]));

console.log(`  /Title  ${TITLE}`);
console.log(`  /Author ${AUTHOR}`);
