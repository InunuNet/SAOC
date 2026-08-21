// F5 (ticketing-conferences-and-events, M2) — behavioral proof for isUsableCapacity(), the
// defense-in-depth guard route.ts checks before capacity ever reaches effectiveCapacity()/
// planPooledCapacity(). isUsableCapacity() is not exported (it is a private helper inside the
// route module, which itself imports next/server and firebase-admin — importing the module
// directly in a bare node script would require mocking both runtimes just to reach a three-line
// predicate). Exporting it purely for testability was considered and rejected: it would widen
// the route module's public surface for a function with no caller outside this file, for no
// robustness gain over extraction — the wiring assertions in this same contract (A10/A13/A14)
// already establish comment-stripped brace-matched source extraction as this project's proven
// technique for exercising unexported route.ts internals. This script extracts isUsableCapacity's
// REAL body text (not a hand re-implementation, which could silently drift from the guarded code)
// and executes it via `new Function` against a truth table, so a future edit to the real
// predicate is what this check observes — not a copy of today's logic.
//
// Also regression-guards the price call site: price must stay on isUsableAmount (which accepts
// fractional ZAR amounts) so a future edit does not accidentally reuse isUsableCapacity's integer
// check for price too, matching sanity/schemas/documents/ticketType.ts's own field-by-field
// validation (`capacity`: Rule.required().integer().min(0); `price`: Rule.required().min(0), no
// .integer()).
//
// Run as: node contracts/checks/ticketing-conferences-and-events-f5/check-capacity-validator-behavior.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable ONLY for this script's own negative-verification testing (pointing the check at a
// synthetic fixture) — unset in the contract's actual `command:`, so normal gate runs always
// resolve the real file.
const ROUTE_FILE = process.env.F5_CHECK_VALIDATOR_ROUTE_FILE_OVERRIDE
  ? path.resolve(process.env.F5_CHECK_VALIDATOR_ROUTE_FILE_OVERRIDE)
  : path.resolve(__dirname, '../../../app/api/tickets/checkout/route.ts');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

let routeSrc;
try {
  routeSrc = readFileSync(ROUTE_FILE, 'utf8');
} catch {
  fail(`${ROUTE_FILE} does not exist.`);
}

// --- Strip comments, preserving length and line numbers (same state machine as
// check-pool-sibling-wiring.mjs) so it isn't fooled by `//` or `/*` inside string literals. ---
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inLineComment = false;
  let inBlockComment = false;
  let inString = null;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
        out += c;
      } else {
        out += ' ';
      }
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && c2 === '/') {
        out += '  ';
        i += 2;
        inBlockComment = false;
      } else {
        out += c === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') {
        out += c2 ?? '';
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
      i++;
      continue;
    }
    if (c === '/' && c2 === '/') {
      inLineComment = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (c === '/' && c2 === '*') {
      inBlockComment = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = c;
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractFunctionBody(stripped, rawSrc, fnName) {
  const sigRe = new RegExp(`function\\s+${fnName}\\s*\\(value:\\s*unknown\\)[^{]*\\{`);
  const sigMatch = sigRe.exec(stripped);
  if (!sigMatch) fail(`function ${fnName}(value: unknown) ... { signature not found in route.ts.`);
  const openIdx = sigMatch.index + sigMatch[0].length - 1;
  if (stripped[openIdx] !== '{') fail(`Could not locate the opening brace of ${fnName}().`);
  const closeIdx = matchBrace(stripped, openIdx);
  if (closeIdx === -1) fail(`Could not find the matching closing brace of ${fnName}() — unbalanced braces.`);
  // Pull the REAL body text from the original (non-stripped) source at the same offsets, so
  // comments-turned-spaces in `stripped` don't leak into the executed function.
  return rawSrc.slice(openIdx + 1, closeIdx);
}

const stripped = stripComments(routeSrc);
const capacityBody = extractFunctionBody(stripped, routeSrc, 'isUsableCapacity');

let isUsableCapacity;
try {
  // eslint-disable-next-line no-new-func -- deliberately executing the real, extracted predicate
  // body, not a re-implementation, so this check observes the actual guarded code.
  isUsableCapacity = new Function('value', capacityBody);
} catch (err) {
  fail(`Extracted isUsableCapacity() body is not valid JS: ${err.message}`);
}

const capacityCases = [
  { value: 10.5, expected: false, label: 'fractional capacity (10.5)' },
  { value: -1, expected: false, label: 'negative capacity (-1)' },
  { value: NaN, expected: false, label: 'NaN capacity' },
  { value: Infinity, expected: false, label: 'Infinity capacity' },
  { value: '10', expected: false, label: 'string capacity ("10")' },
  { value: 0, expected: true, label: 'zero capacity (0, a real valid value)' },
  { value: 10, expected: true, label: 'valid integer capacity (10)' },
];

for (const { value, expected, label } of capacityCases) {
  const actual = isUsableCapacity(value);
  if (Boolean(actual) !== expected) {
    fail(
      `isUsableCapacity(${label}) returned ${actual}, expected ${expected} — the extracted ` +
        'predicate no longer matches the required integer/non-negative behavior.'
    );
  }
}

// --- Regression guard: price's call site must still use isUsableAmount, which accepts
// fractional ZAR amounts (e.g. 99.99) — proves a future edit hasn't over-tightened price to
// isUsableCapacity's integer-only check. ---
const amountBody = extractFunctionBody(stripped, routeSrc, 'isUsableAmount');
let isUsableAmount;
try {
  // eslint-disable-next-line no-new-func
  isUsableAmount = new Function('value', amountBody);
} catch (err) {
  fail(`Extracted isUsableAmount() body is not valid JS: ${err.message}`);
}
if (isUsableAmount(99.99) !== true) {
  fail('isUsableAmount(99.99) returned false — price validation must still accept fractional ZAR amounts.');
}

const priceCallSiteRe = /if\s*\(\s*!isUsableAmount\s*\(\s*price\s*\)\s*\)/;
if (!priceCallSiteRe.test(stripped)) {
  fail(
    "route.ts's price validation call site no longer reads `if (!isUsableAmount(price))` — " +
      'either price has been switched onto a different (possibly integer-only) validator, or ' +
      'the check itself has moved in a way this guard can no longer find.'
  );
}

console.log(
  'PASS: isUsableCapacity() (extracted from app/api/tickets/checkout/route.ts) rejects ' +
    'fractional/negative/NaN/Infinity/string capacity and accepts valid non-negative integers ' +
    '(including 0); price\'s call site remains on isUsableAmount(), which still accepts ' +
    'fractional amounts (99.99).'
);
process.exit(0);
