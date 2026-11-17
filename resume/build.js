/*
 * build.js [--with-phone] [--skip-verify]
 *
 * Builds Andrew_Merritt_Resume.pdf from resume.html. Renders the page with
 * headless Chrome, Chromium or Edge, stamps the PDF's /Title and /Author
 * (set-metadata.js), verifies the result (verify.js), and only then moves it
 * to the path the README's Resume badge links to.
 *
 * Runs on Windows, macOS and Linux:   node resume/build.js
 * build.ps1 is a thin wrapper around this, kept so `pwsh resume/build.ps1`
 * still works.
 *
 *   --with-phone   Keep the phone number. Writes Andrew_Merritt_Resume_full.pdf,
 *                  which .gitignore keeps out of the repo - the copy to send
 *                  directly to an employer. Without it the build produces the
 *                  public copy, with anything marked class="private" hidden.
 *                  The number comes from RESUME_PHONE or resume/private.json,
 *                  never from a tracked file.
 *   --skip-verify  Skip the post-render checks (not recommended).
 *
 * Set CHROME_PATH to use a specific browser binary.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const FLAGS = new Set(['--with-phone', '--skip-verify']);
const args = process.argv.slice(2);
const unknown = args.filter((a) => !FLAGS.has(a));
if (unknown.length) {
  console.error(`Unknown argument(s): ${unknown.join(' ')}`);
  console.error('Usage: node resume/build.js [--with-phone] [--skip-verify]');
  process.exit(2);
}
const WITH_PHONE = args.includes('--with-phone');
const SKIP_VERIFY = args.includes('--skip-verify');

const RESUME_DIR = __dirname;
const REPO_ROOT = path.dirname(RESUME_DIR);
const SOURCE = path.join(RESUME_DIR, 'resume.html');
const OUTPUT = path.join(
  REPO_ROOT,
  WITH_PHONE ? 'Andrew_Merritt_Resume_full.pdf' : 'Andrew_Merritt_Resume.pdf'
);

/* resume.html is a public file, so the phone number is not in it - only this
 * placeholder is. --with-phone fills it in from RESUME_PHONE or from
 * private.json, which .gitignore excludes. */
const PHONE_TOKEN = '{{PHONE}}';
const PRIVATE_FILE = path.join(RESUME_DIR, 'private.json');
// Anything shaped like a North American phone number, e.g. (555) 555-0100.
const PHONE_SHAPED = /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;

/* Every intermediate file lives in resume/ rather than the OS temp directory,
 * for two reasons:
 *   - Both variants render from a copy of resume.html, and that copy has
 *     to sit next to resume.css: the stylesheet is linked with a relative href,
 *     so a copy anywhere else would silently render unstyled.
 *   - Chromium installed as a snap or flatpak (the default on Ubuntu) gets a
 *     private /tmp. Told to print to /tmp/x.pdf, it reports success and writes
 *     the file somewhere this process cannot see.
 * All of them match resume/.build-* in .gitignore and are removed on exit. */
const SCRATCH_HTML = path.join(RESUME_DIR, '.build-render.html');
const RENDERED = path.join(RESUME_DIR, `.build-${process.pid}.pdf`);
const STAMPED = path.join(RESUME_DIR, `.build-${process.pid}-stamped.pdf`);

function findBrowser() {
  if (process.env.CHROME_PATH) {
    if (!fs.existsSync(process.env.CHROME_PATH)) {
      throw new Error(`CHROME_PATH is set but does not exist: ${process.env.CHROME_PATH}`);
    }
    return process.env.CHROME_PATH;
  }

  // Chrome first, then Chromium, then Edge. All three are Blink and accept the
  // same --headless --print-to-pdf flags, so they render this page identically.
  const candidates = [];
  if (process.platform === 'win32') {
    const { ProgramFiles, LOCALAPPDATA } = process.env;
    const ProgramFilesX86 = process.env['ProgramFiles(x86)'];
    for (const base of [ProgramFiles, ProgramFilesX86, LOCALAPPDATA]) {
      if (base) candidates.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    for (const base of [ProgramFiles, ProgramFilesX86]) {
      if (base) candidates.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    const names = [
      'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
      'microsoft-edge', 'microsoft-edge-stable',
    ];
    const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    for (const name of names) for (const dir of dirs) candidates.push(path.join(dir, name));
  }

  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) {
    throw new Error(
      'No Chrome, Chromium or Edge found. Install one, or set CHROME_PATH.\n' +
        `Looked in:\n  ${candidates.join('\n  ')}`
    );
  }
  return found;
}

/* Runs one of the sibling Node scripts with its output passed straight
 * through. Both report failure only through the exit code. */
function runScript(name, scriptArgs) {
  const r = spawnSync(process.execPath, [path.join(RESUME_DIR, name), ...scriptArgs], {
    stdio: 'inherit',
  });
  if (r.error) throw r.error;
  return r.status;
}

function cleanup() {
  for (const f of [SCRATCH_HTML, RENDERED, STAMPED]) {
    try { fs.rmSync(f, { force: true }); } catch { /* best effort */ }
  }
}

/* The phone number for the full variant. RESUME_PHONE wins; otherwise
 * private.json, a local file of the form { "phone": "..." }. */
function readPhone() {
  let phone = process.env.RESUME_PHONE;
  if (!phone && fs.existsSync(PRIVATE_FILE)) {
    try {
      phone = JSON.parse(fs.readFileSync(PRIVATE_FILE, 'utf8')).phone;
    } catch (err) {
      throw new Error(`Could not read ${PRIVATE_FILE}: ${err.message}`);
    }
  }
  if (typeof phone !== 'string' || !phone.trim()) {
    throw new Error(
      '--with-phone needs a phone number, and none is configured.\n' +
        'Set RESUME_PHONE, or copy resume/private.example.json to resume/private.json\n' +
        'and put the real number in it. private.json is in .gitignore; keep it that way.'
    );
  }
  return phone.trim();
}

function escapeHtml(s) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => entities[c]);
}

function build() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing source: ${SOURCE}`);
  const browser = findBrowser();

  const source = fs.readFileSync(SOURCE, 'utf8');
  if (!source.includes('</head>')) throw new Error('resume.html has no </head> to inject into.');
  if (!source.includes(PHONE_TOKEN)) {
    throw new Error(`resume.html has no ${PHONE_TOKEN} placeholder for the phone number.`);
  }
  // Checked on every build, including the public one, so a number pasted back
  // into the source is caught before it can be committed.
  if (PHONE_SHAPED.test(source)) {
    throw new Error(
      'resume.html contains what looks like a phone number. That file is public.\n' +
        `Use the ${PHONE_TOKEN} placeholder and keep the number in resume/private.json.`
    );
  }

  // Always render from a copy. The full variant gets the number substituted
  // in; the public variant gets the placeholder removed and anything marked
  // .private hidden with one injected rule.
  const html = WITH_PHONE
    ? source.split(PHONE_TOKEN).join(escapeHtml(readPhone()))
    : source
        .split(PHONE_TOKEN)
        .join('')
        .replace('</head>', '  <style>.private { display: none; }</style>\n  </head>');
  fs.writeFileSync(SCRATCH_HTML, html);
  const renderSource = SCRATCH_HTML;

  console.log(`Rendering ${SOURCE}`);
  console.log(`  variant: ${WITH_PHONE ? 'full (includes phone number)' : 'public (phone number omitted)'}`);
  console.log(`  browser: ${browser}`);

  /* --no-pdf-header-footer suppresses Chrome's default date/URL/page-number
   * furniture. --run-all-compositor-stages-before-draw and the virtual time
   * budget make sure layout has fully settled before the snapshot is taken.
   * Chrome reports "N bytes written to file" on stderr even on success, so
   * its output is captured and shown only if the render fails. */
  const r = spawnSync(
    browser,
    [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=5000',
      `--print-to-pdf=${RENDERED}`,
      pathToFileURL(renderSource).href,
    ],
    { encoding: 'utf8', timeout: 120000 }
  );
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${path.basename(browser)} exited with code ${r.status}.\n${r.stderr || ''}`);
  }
  if (!fs.existsSync(RENDERED)) throw new Error('The browser produced no output.');

  // Still working on scratch files: OUTPUT is the path the README badge
  // serves, so nothing lands there until the build has passed verification.
  console.log('Setting document metadata');
  if (runScript('set-metadata.js', [RENDERED, STAMPED]) !== 0) {
    throw new Error('Metadata step failed.');
  }

  if (!SKIP_VERIFY) {
    console.log('Verifying');
    if (runScript('verify.js', [STAMPED]) !== 0) {
      // Leave the previously published PDF untouched. A failed build must not
      // replace a good resume with a broken one.
      throw new Error('Verification failed - see output above. Existing PDF left unchanged.');
    }
  }

  // Only now is it safe to publish. Same filesystem, so this is a rename.
  fs.renameSync(STAMPED, OUTPUT);
  const kb = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  console.log(`Built ${OUTPUT} (${kb} KB)`);
}

try {
  build();
} catch (err) {
  console.error(`Build failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  // Runs even if a step above threw, so the injected copy never lingers in
  // the source directory to be edited or committed by mistake.
  cleanup();
}
