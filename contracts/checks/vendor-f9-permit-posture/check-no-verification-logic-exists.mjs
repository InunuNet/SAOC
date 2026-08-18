#!/usr/bin/env node
// F9 (vendor-registration) — A5. Negative assertion: NO verification/lookup logic exists
// anywhere in the application source for the three permit/certificate fields. The mission
// brief and F4's own docs are explicit that whether SAOC is obliged to verify these numbers is
// a show-committee question, not an engineering default -- F9 must not quietly add a
// verification integration under the "surface the note" umbrella.
//
// Scans lib/, app/, components/ (excluding build output and node_modules) for identifier or
// call patterns that look like permit verification/lookup:
//   - function/const names like verifyCitesPermit, checkPhytosanitaryPermit, validatePermit*
//   - identifiers combining "cites"/"phytosanitary"/"permit" with lookup/verify/registry/api
//
// DEFEATING MUTATION: adding a real verification call under an innocuous-looking name this
// scanner's patterns don't catch would defeat the intent but not this specific check --
// documented as a known limitation in the golden README (pattern-based negative scans cannot
// prove universal absence, only absence of the named pattern family).
//
// Self-tests against fixtures/verification-logic-violation.ts (must be FLAGGED) and
// fixtures/verification-logic-clean.ts (must NOT be flagged) before trusting the real scan.
//
// Run as: node contracts/checks/vendor-f9-permit-posture/check-no-verification-logic-exists.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { globSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const FORBIDDEN_PATTERNS = [
  /\b(verify|validate|check)[A-Za-z]*(Cites|Phytosanitary|FoodHandling)/i,
  /\b(cites|phytosanitary)[A-Za-z]*(Lookup|Verify|Registry|Api)/i,
  /\b(verify|validate|check|lookup)[A-Za-z]*Permit(Number)?\b/i,
];

function scan(source) {
  return FORBIDDEN_PATTERNS.filter((re) => re.test(source));
}

// --- Self-test ---------------------------------------------------------

const violation = readFileSync(
  path.join(__dirname, 'fixtures/verification-logic-violation.ts'),
  'utf8',
);
const clean = readFileSync(path.join(__dirname, 'fixtures/verification-logic-clean.ts'), 'utf8');

if (scan(violation).length === 0) {
  console.error('SELF-TEST FAILED: violation fixture should be flagged by at least one forbidden pattern.');
  process.exit(1);
}

if (scan(clean).length !== 0) {
  console.error('SELF-TEST FAILED: clean fixture should not be flagged, but was.');
  process.exit(1);
}

// --- Real check ----------------------------------------------------------

const scanDirs = ['lib', 'app', 'components'].map((d) => path.join(REPO_ROOT, d));

const hits = [];
for (const dir of scanDirs) {
  if (!existsSync(dir)) continue;
  const files = globSync('**/*.{ts,tsx}', { cwd: dir }).map((f) => path.join(dir, f));
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const matched = scan(source);
    if (matched.length > 0) {
      hits.push(`${path.relative(REPO_ROOT, file)}: matched ${matched.map((r) => r.source).join(', ')}`);
    }
  }
}

if (hits.length > 0) {
  console.error('FAIL: found permit verification/lookup-shaped logic where none should exist:');
  console.error(hits.join('\n'));
  process.exit(1);
}

console.log('PASS: no permit verification/lookup logic found under lib/, app/, components/.');
process.exit(0);
