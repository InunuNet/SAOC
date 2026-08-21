// F5 (ticketing-conferences-and-events, M2) — closes a coverage gap @qa-apex found in A13
// (check-category-page-pool-wiring.mjs, 2026-08-21). A13 proves planPooledCapacity() is called
// inside the `cardData = types.map((t) => { ... })` callback and that its result drives
// `soldOut`, and that `cardData` is what's rendered. It does NOT prove
// CategoryTicketsPage.tsx's separate sibling-fetch-and-merge loop (the UI-side analog of what
// A10 already protects in route.ts: `for (const poolKey of poolKeysTouched) { ... }`, which
// fetches each pool's sibling ticket types via ticketTypesByPoolQuery and merges them into
// poolConfigByType BEFORE the cardData map runs) is itself wired and reachable. @qa-apex proved
// this gap concretely: deleting that entire loop from a copy of the file still leaves A13
// green, because planPooledCapacity() is still called with SOME poolConfigByType — just one
// missing off-page/inactive siblings — so the real bug (their sold heads no longer counting
// against the shared pool) silently returns while every A13 fact stays true.
//
// This script proves, via brace-matching on comment-stripped source (not naive whole-file
// grep, and not line-number-only ordering):
//   1. CategoryTicketsPage()'s own function body is found via real brace-matching from
//      `export async function CategoryTicketsPage(` to its closing brace.
//   2. A `for (const poolKey of poolKeysTouched) { ... }` loop exists directly inside that
//      function body (found via brace-matching from the loop's own opening brace).
//   3. `ticketTypesByPoolQuery` is genuinely INVOKED inside that loop body — passed as the
//      `query:` argument to a real `sanityFetch(` call — not merely imported or referenced in
//      a comment.
//   4. The merge assignment `poolConfigByType[sibling.slug] = ...` lexically lives INSIDE that
//      same loop body (not inside a nested function/arrow defined within the loop that the
//      loop itself never calls — the same dead-code shape A10 already guards against in
//      route.ts).
//   5. That merge assignment textually precedes the `const cardData = types.map(...)`
//      assignment that consumes poolConfigByType — an ordering defect (merge computed too
//      late to affect the sold-out decision) is caught, not just presence-anywhere-in-file.
//
// Run as: node contracts/checks/ticketing-conferences-and-events-f5/check-category-page-sibling-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable ONLY for this script's own negative-verification testing (pointing the check at a
// synthetic fixture) — unset in the contract's actual `command:`, so normal gate runs always
// resolve the real file. Reuses A13's override variable name since both checks target the same
// file.
const PAGE_FILE = process.env.F5_CHECK_CATEGORY_PAGE_FILE_OVERRIDE
  ? path.resolve(process.env.F5_CHECK_CATEGORY_PAGE_FILE_OVERRIDE)
  : path.resolve(__dirname, '../../../components/tickets/CategoryTicketsPage.tsx');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

let src;
try {
  src = readFileSync(PAGE_FILE, 'utf8');
} catch {
  fail(`${PAGE_FILE} does not exist.`);
}

// --- Strip comments (same state machine as A10/A13), preserving length and line numbers. ---
function stripComments(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  let inLineComment = false;
  let inBlockComment = false;
  let inString = null;
  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];
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

const stripped = stripComments(src);

function lineOf(index) {
  return stripped.slice(0, index).split('\n').length;
}

function matchBrace(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function matchParen(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// --- Find CategoryTicketsPage()'s own brace-matched function body span. The parameter list is
// a destructured object (`({ category, ... }: Props)`), so the body's opening brace is the
// first `{` AFTER the parameter list's own closing paren — not the first `{` after the
// function name, which would land on the destructuring pattern's brace instead. ---
const fnStartMatch = /export\s+async\s+function\s+CategoryTicketsPage\s*\(/.exec(stripped);
if (!fnStartMatch) fail('export async function CategoryTicketsPage( not found in the file.');
const fnParamOpenParen = fnStartMatch.index + fnStartMatch[0].length - 1;
const fnParamCloseParen = matchParen(stripped, fnParamOpenParen);
if (fnParamCloseParen === -1) fail('Could not find the matching closing paren of CategoryTicketsPage()\'s parameter list — unbalanced parens.');
const fnOpenBrace = stripped.indexOf('{', fnParamCloseParen);
if (fnOpenBrace === -1) fail('Could not find the opening brace of CategoryTicketsPage().');
const fnCloseBrace = matchBrace(stripped, fnOpenBrace);
if (fnCloseBrace === -1) fail('Could not find the matching closing brace of CategoryTicketsPage() — unbalanced braces.');
const fnBodyStart = fnOpenBrace + 1;
const fnBodyEnd = fnCloseBrace;

// --- Find the `for (const poolKey of poolKeysTouched) { ... }` loop directly inside that body ---
const loopMatch = /for\s*\(\s*const\s+poolKey\s+of\s+poolKeysTouched\s*\)\s*\{/.exec(stripped);
if (!loopMatch || loopMatch.index < fnBodyStart || loopMatch.index >= fnBodyEnd) {
  fail(
    'no `for (const poolKey of poolKeysTouched) { ... }` loop found inside CategoryTicketsPage() ' +
      '— either the sibling-fetch-and-merge loop no longer exists, or it has been restructured ' +
      'in a way this check can no longer anchor to (update the check if that restructure was ' +
      'intentional).'
  );
}
const loopOpenBrace = stripped.indexOf('{', loopMatch.index + loopMatch[0].length - 1);
const loopCloseBrace = matchBrace(stripped, loopOpenBrace);
if (loopCloseBrace === -1) fail('Could not find the matching closing brace of the poolKeysTouched loop — unbalanced braces.');
const loopBodyStart = loopOpenBrace + 1;
const loopBodyEnd = loopCloseBrace;
const loopBody = stripped.slice(loopBodyStart, loopBodyEnd);

// --- Fact 1: ticketTypesByPoolQuery is genuinely invoked (passed to a real sanityFetch( call
// as the `query:` argument), not merely imported or mentioned. ---
const invokeRe = /sanityFetch\s*(?:<[^>(]*>)?\s*\(\s*\{[^}]*?query\s*:\s*ticketTypesByPoolQuery/s;
if (!invokeRe.test(loopBody)) {
  fail(
    `the poolKeysTouched loop body (opens at line ${lineOf(loopOpenBrace)}) never passes ` +
      'ticketTypesByPoolQuery as the `query:` argument to a sanityFetch( call — the pool ' +
      'siblings are never actually fetched from Sanity, even if the query is imported.'
  );
}

// --- Fact 2: the merge assignment poolConfigByType[sibling.slug] = ... lives directly inside
// the loop body — not inside a nested function/arrow definition within the loop that the loop
// itself never calls (the same dead-code shape A10 guards against for route.ts). ---
const mergeRe = /poolConfigByType\s*\[\s*sibling\.slug\s*\]\s*=(?!=)/g;
let mergeMatch = null;
let m;
while ((m = mergeRe.exec(stripped)) !== null) {
  if (m.index >= loopBodyStart && m.index < loopBodyEnd) {
    mergeMatch = m;
    break;
  }
}
if (!mergeMatch) {
  fail(
    'no assignment into poolConfigByType[sibling.slug] found inside the poolKeysTouched loop ' +
      'body — either the fetched siblings are never merged into poolConfigByType, or the merge ' +
      'happens outside the loop where it cannot see each sibling in turn.'
  );
}
const mergeIdx = mergeMatch.index;
const mergeLine = lineOf(mergeIdx);

const nestedFnRe = /\bfunction\b|=>\s*\{/g;
nestedFnRe.lastIndex = loopBodyStart;
let nf;
while ((nf = nestedFnRe.exec(stripped)) !== null) {
  if (nf.index >= loopBodyEnd) break;
  const nestedOpen = stripped.indexOf('{', nf.index);
  if (nestedOpen === -1 || nestedOpen >= loopBodyEnd) continue;
  const nestedClose = matchBrace(stripped, nestedOpen);
  if (nestedClose === -1) continue;
  if (mergeIdx > nestedOpen && mergeIdx < nestedClose) {
    fail(
      `the poolConfigByType[sibling.slug] merge assignment (line ${mergeLine}) is nested inside ` +
        `a local function/arrow definition inside the loop (opens at line ${lineOf(nestedOpen)}) ` +
        '— a dead-code shape where the merge is present but only reachable if that inner ' +
        'function is actually called.'
    );
  }
}

// --- Fact 3: the merge assignment textually precedes the `const cardData = types.map(...)`
// assignment that consumes poolConfigByType — catches an ordering defect (merge computed too
// late to affect the sold-out decision), not just presence-anywhere-in-file. ---
const cardDataMatch = /\bconst\s+cardData\s*:[^=]*=\s*types\.map\s*\(\s*\(\s*t\s*\)\s*=>\s*\{/.exec(
  stripped
);
if (!cardDataMatch) {
  fail(
    'no `const cardData ... = types.map((t) => { ... })` assignment found — either cardData no ' +
      'longer exists, or its computation is no longer a direct types.map callback this check ' +
      'can anchor to.'
  );
}
if (mergeIdx >= cardDataMatch.index) {
  fail(
    `poolConfigByType[sibling.slug] is assigned (line ${mergeLine}) AFTER cardData is computed ` +
      `(line ${lineOf(cardDataMatch.index)}) — too late for the merged sibling data to affect ` +
      'the sold-out decision it is meant to complete.'
  );
}

console.log(
  `PASS: CategoryTicketsPage.tsx's poolKeysTouched loop (opens at line ${lineOf(loopOpenBrace)}) ` +
    'genuinely invokes ticketTypesByPoolQuery via sanityFetch and merges each sibling into ' +
    `poolConfigByType (line ${mergeLine}) directly inside the loop body — not inside a dead ` +
    `nested helper — strictly before cardData is computed (line ${lineOf(cardDataMatch.index)}).`
);
process.exit(0);
