#!/usr/bin/env -S pnpm exec tsx
// A15: readEnvLocal() CRLF blind spot. No fixture-mode assertion in this
// contract ever calls readEnvLocal() at all -- fixture mode reads no
// .env.local by design (see A1/A2 running with FIREBASE_ADMIN_* explicitly
// unset). That leaves the credential parser itself, the one piece of this
// scanner that ever touches a real secret, completely outside gate coverage.
//
// QA found: under CRLF line endings, the multi-line-quoted-value
// continuation loop in readEnvLocal() checks `nextLine.endsWith(quoteChar)`
// against the RAW (untrimmed) line. With CRLF the closing line is
// `-----END PRIVATE KEY-----"\r`, which ends with '\r', not '"' -- the
// closing quote is never recognized. The loop swallows every remaining
// line in the file into the credential value, and every variable declared
// after the multi-line value silently disappears from the parsed result.
//
// This check builds a CRLF .env.local fixture with REAL \r\n bytes (via
// `printf '\r\n'` in the assertion command, not a JS/YAML template literal
// that a checkout could silently normalize to LF), containing a PEM-shaped
// DUMMY multi-line quoted value followed by two further variables, then
// calls readEnvLocal() directly and asserts:
//   1. the quoted multi-line value is captured with no '\r' retained, and
//   2. both variables declared AFTER the multi-line value are still present
//      with their exact values (not absorbed into the credential).
//
// No real credential material appears anywhere in this file or its fixture.
//
// Run with: pnpm exec tsx contracts/checks/firestore-residue-guard/check_env_local_crlf_parsing.mjs <tmpdir>

import { existsSync } from 'node:fs';

const tmpDir = process.argv[2];
if (!tmpDir || !existsSync(`${tmpDir}/.env.local`)) {
  console.error('FAIL: usage: check_env_local_crlf_parsing.mjs <tmpdir-containing-.env.local>');
  process.exit(1);
}

let failures = 0;
function check(name, condition, detail) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${name}${detail ? `\n  ${detail}` : ''}`);
  } else {
    console.log(`PASS: ${name}`);
  }
}

process.chdir(tmpDir);

let readEnvLocal;
try {
  ({ readEnvLocal } = await import('../../../scripts/scan-firestore-residue.ts'));
} catch (err) {
  console.error(`FAIL: could not import readEnvLocal from scripts/scan-firestore-residue.ts -- it must be exported (add \`export\` to \`function readEnvLocal()\`).\n  ${err.message}`);
  process.exit(1);
}

if (typeof readEnvLocal !== 'function') {
  console.error('FAIL: scripts/scan-firestore-residue.ts does not export a function named readEnvLocal -- add `export` to `function readEnvLocal()`.');
  process.exit(1);
}

const parsed = readEnvLocal();

const pemValue = parsed.FIREBASE_ADMIN_PRIVATE_KEY;
check(
  'multi-line quoted PEM value is present',
  typeof pemValue === 'string' && pemValue.length > 0,
  `actual: ${JSON.stringify(pemValue)}`,
);
check(
  'multi-line quoted PEM value retains no \\r',
  typeof pemValue === 'string' && !pemValue.includes('\r'),
  `actual: ${JSON.stringify(pemValue)}`,
);
check(
  'multi-line quoted PEM value starts with its BEGIN marker',
  typeof pemValue === 'string' && pemValue.startsWith('-----BEGIN PRIVATE KEY-----'),
  `actual: ${JSON.stringify(pemValue)}`,
);
check(
  'multi-line quoted PEM value ends with its END marker (no trailing quote/CR/absorbed lines)',
  typeof pemValue === 'string' && pemValue.trimEnd().endsWith('-----END PRIVATE KEY-----'),
  `actual: ${JSON.stringify(pemValue)}`,
);
check(
  'multi-line quoted PEM value does not absorb the following variables',
  typeof pemValue === 'string' && !pemValue.includes('FIREBASE_ADMIN_CLIENT_EMAIL') && !pemValue.includes('RESEND_API_KEY'),
  `actual: ${JSON.stringify(pemValue)}`,
);

check(
  'FIREBASE_ADMIN_CLIENT_EMAIL (declared AFTER the multi-line value) survives intact',
  parsed.FIREBASE_ADMIN_CLIENT_EMAIL === 'dummy@dummy-project.iam.gserviceaccount.com',
  `actual: ${JSON.stringify(parsed.FIREBASE_ADMIN_CLIENT_EMAIL)}`,
);
check(
  'RESEND_API_KEY (declared AFTER the multi-line value) survives intact',
  parsed.RESEND_API_KEY === 'dummy-resend-key-value',
  `actual: ${JSON.stringify(parsed.RESEND_API_KEY)}`,
);

if (failures > 0) {
  console.error(`\nFAIL: ${failures} readEnvLocal() CRLF parsing case(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: readEnvLocal() handles CRLF multi-line quoted values and preserves following variables.');
