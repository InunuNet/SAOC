// F5 (ticketing-conferences-and-events, M2) — behavioral proof for isUsableHeadcountPerUnit(),
// mirroring check-capacity-validator-behavior.mjs's approach and rationale (see that file's
// header for the export-vs-extraction decision): the function is an unexported route.ts
// internal, so this script extracts its REAL body text via comment-stripped brace-matching and
// executes it with `new Function` against a truth table, matching sanity/schemas/documents/
// ticketType.ts's own `headcountPerUnit`: Rule.integer().min(1) — optional (null/undefined ->
// valid, defaults to 1 elsewhere), but any present value must be a positive integer.
//
// Run as: node contracts/checks/ticketing-conferences-and-events-f5/check-headcount-validator-behavior.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

const stripped = stripComments(routeSrc);
const sigRe = /function\s+isUsableHeadcountPerUnit\s*\(value:\s*unknown\)[^{]*\{/;
const sigMatch = sigRe.exec(stripped);
if (!sigMatch) {
  fail('function isUsableHeadcountPerUnit(value: unknown) ... { signature not found in route.ts.');
}
const openIdx = sigMatch.index + sigMatch[0].length - 1;
if (stripped[openIdx] !== '{') fail('Could not locate the opening brace of isUsableHeadcountPerUnit().');
const closeIdx = matchBrace(stripped, openIdx);
if (closeIdx === -1) {
  fail('Could not find the matching closing brace of isUsableHeadcountPerUnit() — unbalanced braces.');
}
const body = routeSrc.slice(openIdx + 1, closeIdx);

let isUsableHeadcountPerUnit;
try {
  // eslint-disable-next-line no-new-func -- executing the real, extracted predicate body.
  isUsableHeadcountPerUnit = new Function('value', body);
} catch (err) {
  fail(`Extracted isUsableHeadcountPerUnit() body is not valid JS: ${err.message}`);
}

const cases = [
  { value: null, expected: true, label: 'null (optional, unset)' },
  { value: undefined, expected: true, label: 'undefined (optional, unset)' },
  { value: 1, expected: true, label: 'valid minimum (1)' },
  { value: 200, expected: true, label: 'valid large headcount (200)' },
  { value: 1.5, expected: false, label: 'fractional headcount (1.5)' },
  { value: 0, expected: false, label: 'zero headcount (below min 1)' },
  { value: -1, expected: false, label: 'negative headcount (-1)' },
  { value: NaN, expected: false, label: 'NaN headcount' },
  { value: Infinity, expected: false, label: 'Infinity headcount' },
  { value: '2', expected: false, label: 'string headcount ("2")' },
];

for (const { value, expected, label } of cases) {
  const actual = isUsableHeadcountPerUnit(value);
  if (Boolean(actual) !== expected) {
    fail(
      `isUsableHeadcountPerUnit(${label}) returned ${actual}, expected ${expected} — the ` +
        'extracted predicate no longer matches Rule.integer().min(1), optional-null/undefined behavior.'
    );
  }
}

console.log(
  'PASS: isUsableHeadcountPerUnit() (extracted from app/api/tickets/checkout/route.ts) accepts ' +
    'null/undefined (optional) and positive integers (1, 200); rejects fractional/zero/negative/' +
    'NaN/Infinity/string values.'
);
process.exit(0);
