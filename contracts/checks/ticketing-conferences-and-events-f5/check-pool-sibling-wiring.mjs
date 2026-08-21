// F5 (ticketing-conferences-and-events, M2) — replaces the earlier check-pool-sibling-wiring.sh,
// which only grepped for text presence and compared line numbers against the FIRST substring
// match of "reserveTicket(" (which can land on a comment, as it did at the time this was
// written — the comment at route.ts:562 mentioning "reserveTicket()" happened to sit before the
// real call, so the check passed by accident, not by proof). @qa-apex defeated that script with
// a synthetic route.ts where the merge-into-poolConfigByType logic lived inside a function never
// called from POST() — a fully dead code path reproducing the original oversell — and the old
// script still printed PASS, because it never checked reachability, only text order.
//
// This script proves three things the old one did not:
//   1. The merge assignment `poolConfigByType[sibling.slug] = ...` lexically lives INSIDE
//      POST()'s own function body (found via real brace-matching from `export async function
//      POST(` to its closing brace) — not merely somewhere earlier in the file by line number.
//      A dead sibling function defined elsewhere in the module, called from nowhere, fails this
//      because it is never inside POST()'s brace-matched span.
//   2. The merge assignment does NOT live inside any nested function/arrow definition declared
//      within POST() — closing the QA-demonstrated defeat where the merge logic sits in a local
//      helper POST() itself never calls.
//   3. The real reservation call is anchored to the actual call EXPRESSION `await
//      reserveTicket(`, found in comment-stripped source (so a comment merely mentioning
//      "reserveTicket()" cannot be mistaken for the call), the call passes the SAME
//      `poolConfigByType` identifier as an argument, and the merge assignment textually precedes
//      that call within POST()'s body.
//
// Run as: node contracts/checks/ticketing-conferences-and-events-f5/check-pool-sibling-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable ONLY for this script's own negative-verification testing (pointing the check at a
// synthetic fixture) — unset in the contract's actual `command:`, so normal gate runs always
// resolve the real files.
const ROUTE_FILE = process.env.F5_CHECK_ROUTE_FILE_OVERRIDE
  ? path.resolve(process.env.F5_CHECK_ROUTE_FILE_OVERRIDE)
  : path.resolve(__dirname, '../../../app/api/tickets/checkout/route.ts');
const QUERIES_FILE = path.resolve(__dirname, '../../../sanity/queries.ts');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

let routeSrc;
let queriesSrc;
try {
  routeSrc = readFileSync(ROUTE_FILE, 'utf8');
} catch {
  fail(`${ROUTE_FILE} does not exist.`);
}
try {
  queriesSrc = readFileSync(QUERIES_FILE, 'utf8');
} catch {
  fail(`${QUERIES_FILE} does not exist.`);
}

if (!/export const ticketTypesByPoolQuery/.test(queriesSrc)) {
  fail('sanity/queries.ts never declares ticketTypesByPoolQuery — no query exists to fetch a ticket type\'s pool siblings.');
}
if (!routeSrc.includes('ticketTypesByPoolQuery')) {
  fail('app/api/tickets/checkout/route.ts never references ticketTypesByPoolQuery — pool siblings absent from the cart are never fetched.');
}

// --- Strip comments, preserving length and line numbers (each comment char -> a space, real
// newlines kept as-is) so downstream indices/line numbers still map onto the original file. A
// small state machine, not a regex, so it doesn't get fooled by `//` or `/*` inside string
// literals (route.ts has plenty, e.g. error message strings).
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inLineComment = false;
  let inBlockComment = false;
  let inString = null; // one of ' " ` or null
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

const stripped = stripComments(routeSrc);

function lineOf(index) {
  return stripped.slice(0, index).split('\n').length;
}

// --- Find POST()'s own brace-matched body span ---
const postStartMatch = /export\s+async\s+function\s+POST\s*\(/.exec(stripped);
if (!postStartMatch) fail('export async function POST( not found in route.ts.');
const openBraceIdx = stripped.indexOf('{', postStartMatch.index);
if (openBraceIdx === -1) fail('Could not find the opening brace of POST().');

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

function matchParen(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const postCloseIdx = matchBrace(stripped, openBraceIdx);
if (postCloseIdx === -1) fail('Could not find the matching closing brace of POST() — unbalanced braces.');

const postBodyStart = openBraceIdx + 1;
const postBodyEnd = postCloseIdx; // exclusive of the closing brace itself

// --- Find the merge assignment: poolConfigByType[sibling.slug] = ... ---
const mergeRe = /poolConfigByType\s*\[\s*sibling\.slug\s*\]\s*=(?!=)/g;
let mergeMatch = null;
let m;
while ((m = mergeRe.exec(stripped)) !== null) {
  if (m.index >= postBodyStart && m.index < postBodyEnd) {
    mergeMatch = m;
    break;
  }
}
if (!mergeMatch) {
  fail(
    'no assignment into poolConfigByType[sibling.slug] found inside POST()\'s own function body — ' +
      'either the fetched pool siblings are never merged into poolConfigByType, or the merge ' +
      'happens outside POST() where it cannot affect the capacity decision POST() makes.'
  );
}
const mergeIdx = mergeMatch.index;
const mergeLine = lineOf(mergeIdx);

// --- Reject if the merge assignment lives inside a nested function/arrow defined within POST().
// This is the exact class of defeat @qa-apex demonstrated: merge logic present and textually
// earlier than the reservation call, but only reachable from a local helper POST() itself never
// invokes. Real code has no nested function definitions in this block, so this holds for the
// current implementation and rejects that specific dead-code shape. ---
const nestedFnRe = /\bfunction\b|=>\s*\{/g;
nestedFnRe.lastIndex = postBodyStart;
let nf;
while ((nf = nestedFnRe.exec(stripped)) !== null) {
  if (nf.index >= postBodyEnd) break;
  // Find this nested function's own opening brace.
  let nestedOpen;
  if (stripped[nf.index] === '=' /* => { */) {
    nestedOpen = stripped.indexOf('{', nf.index);
  } else {
    // `function` keyword — its body opens at the first `{` after the keyword.
    nestedOpen = stripped.indexOf('{', nf.index);
  }
  if (nestedOpen === -1 || nestedOpen >= postBodyEnd) continue;
  const nestedClose = matchBrace(stripped, nestedOpen);
  if (nestedClose === -1) continue;
  if (mergeIdx > nestedOpen && mergeIdx < nestedClose) {
    fail(
      `the poolConfigByType[sibling.slug] merge assignment (line ${mergeLine}) is nested inside ` +
        `a local function/arrow definition inside POST() (opens at line ${lineOf(nestedOpen)}) — ` +
        'this is exactly the dead-code shape (merge logic present but only reachable if that ' +
        'inner function is actually called) that defeated the previous version of this check.'
    );
  }
}

// --- Find the real reservation call: `await reserveTicket(` on comment-stripped source, so a
// comment merely mentioning "reserveTicket()" cannot be mistaken for the call. ---
const callRe = /\bawait\s+reserveTicket\s*\(/g;
let callMatch = null;
while ((m = callRe.exec(stripped)) !== null) {
  if (m.index >= postBodyStart && m.index < postBodyEnd) {
    callMatch = m;
    break;
  }
}
if (!callMatch) {
  fail('no `await reserveTicket(` call expression found inside POST()\'s own function body — nothing to guard yet.');
}
const callIdx = callMatch.index;
const callLine = lineOf(callIdx);

if (mergeIdx >= callIdx) {
  fail(
    `poolConfigByType[sibling.slug] is assigned (line ${mergeLine}) AFTER the real reserveTicket( ` +
      `call (line ${callLine}) — too late to affect the capacity decision it's meant to complete.`
  );
}

// --- Confirm the call site actually passes the SAME poolConfigByType identifier as an argument
// (not a differently-named or shadowed object), by scanning the call's own argument list. ---
const callOpenParen = stripped.indexOf('(', callIdx);
const callCloseParen = matchParen(stripped, callOpenParen);
const argsText =
  callCloseParen !== -1
    ? stripped.slice(callOpenParen, callCloseParen + 1)
    : stripped.slice(callOpenParen, callOpenParen + 2000);
if (!/\bpoolConfigByType\b/.test(argsText)) {
  fail(
    `the reserveTicket( call (line ${callLine}) does not pass poolConfigByType as an argument — ` +
      'the merged sibling data is computed but never reaches the reservation transaction.'
  );
}

console.log(
  `PASS: app/api/tickets/checkout/route.ts merges every pool sibling into poolConfigByType ` +
    `(line ${mergeLine}) directly inside POST()'s own body — not inside a dead nested helper — ` +
    `strictly before the real \`await reserveTicket(\` call expression (line ${callLine}), which ` +
    'passes that same poolConfigByType object through.'
);
process.exit(0);
