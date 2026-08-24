// ozow-sandbox-toggle F1 — proves the checkout UI renders the TEST MODE banner by importing the
// SHARED constant OZOW_SANDBOX_TEST_MODE_BANNER_TEXT from lib/ozow-sandbox-test-mode, rather than
// hardcoding a second copy of the string — so the banner copy and the flag-read logic can never
// drift apart (README §5). Searches app/ and components/ for a UI file that imports it.
//
// Run as: node contracts/checks/ozow-sandbox-toggle-f1/check-banner-constant-used.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

const candidates = [...walk('app'), ...walk('components')];
const importer = candidates.find((file) => {
  if (file === 'lib/ozow-sandbox-test-mode.ts' || file === 'lib/ozow-sandbox-test-mode-shared.ts') {
    return false;
  }
  const src = readFileSync(file, 'utf8');
  return (
    /OZOW_SANDBOX_TEST_MODE_BANNER_TEXT/.test(src) &&
    /from ['"].*ozow-sandbox-test-mode(-shared)?['"]/.test(src)
  );
});

if (!importer) {
  fail(
    'no file under app/ or components/ imports OZOW_SANDBOX_TEST_MODE_BANNER_TEXT from lib/ozow-sandbox-test-mode or lib/ozow-sandbox-test-mode-shared'
  );
} else {
  console.log(`Found banner usage in: ${importer}`);
}

if (FAIL) {
  process.exit(1);
}
console.log('PASS: checkout UI imports the shared banner-text constant rather than a hardcoded duplicate.');
