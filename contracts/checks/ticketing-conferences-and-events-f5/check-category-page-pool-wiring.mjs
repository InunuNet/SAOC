// F5 (ticketing-conferences-and-events, M2) — second Codex GPT-5.5 defect repair (2026-08-21,
// Defect 1: UI correctness). check-ui-pool-behavior-per-unit.mjs proves planPooledCapacity()'s
// per-unit "would 1 fit" math is correct in isolation. It does NOT prove
// CategoryTicketsPage.tsx's card-rendering loop actually calls that function on a live,
// reachable code path — a dead or bypassed call (defined but never invoked from the code that
// actually builds what gets rendered, exactly the class of gaming A10 was built to prevent for
// route.ts) would pass every other check while still shipping Defect 1's original bug.
//
// This script proves, via brace-matching on comment-stripped source (not naive whole-file grep):
//   1. The `cardData` assignment is `types.map((t) => { ... })` — an arrow function whose body
//      is found via real brace-matching from the map callback's own opening brace.
//   2. `planPooledCapacity(` is called INSIDE that arrow function's body (not merely somewhere
//      earlier or later in the file) and its result is used to set `soldOut`.
//   3. `cardData` — the variable planPooledCapacity's results were written into — is actually
//      passed to the rendered `<TicketPurchaseForm ticketTypes={cardData} ...>`, not computed
//      and then discarded (e.g. replaced with a literal or a different variable at render time).
//
// Run as: node contracts/checks/ticketing-conferences-and-events-f5/check-category-page-pool-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// --- Strip comments (same state machine as check-pool-sibling-wiring.mjs), preserving length
// and line numbers so indices/line numbers still map onto the original file. ---
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

// --- Find `cardData` assignment and its `types.map((t) => { ... })` callback body ---
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
const mapBodyOpen = stripped.indexOf('{', cardDataMatch.index + cardDataMatch[0].length - 1);
if (mapBodyOpen === -1) fail('Could not find the opening brace of the types.map callback body.');
const mapBodyClose = matchBrace(stripped, mapBodyOpen);
if (mapBodyClose === -1) fail('Could not find the matching closing brace of the types.map callback body — unbalanced braces.');

const mapBody = stripped.slice(mapBodyOpen, mapBodyClose);

// --- Fact 1: planPooledCapacity( is called INSIDE that callback body ---
if (!/\bplanPooledCapacity\s*\(/.test(mapBody)) {
  fail(
    `the types.map((t) => { ... }) callback body building cardData (opens at line ` +
      `${lineOf(mapBodyOpen)}) never calls planPooledCapacity() — either it is computed ` +
      'elsewhere and unused here, or the per-product sold-out decision no longer uses the ' +
      'pooled capacity check at all.'
  );
}

// --- Fact 2: the callback's returned object sets soldOut from that call's result (`.kind`),
// not from some other, unrelated expression that happens to sit nearby. ---
if (!/soldOut\s*:\s*\w+\.kind\s*===\s*['"]over-capacity['"]/.test(mapBody)) {
  fail(
    'the types.map callback building cardData calls planPooledCapacity() but its returned ' +
      "object's `soldOut` field is not set from that call's `.kind === 'over-capacity'` result " +
      '— the pooled check may be computed but discarded rather than driving the UI.'
  );
}

// --- Fact 3: `cardData` is actually passed to the rendered component, not discarded. ---
if (!/ticketTypes\s*=\s*\{\s*cardData\s*\}/.test(stripped)) {
  fail(
    'cardData is computed (with planPooledCapacity() wired in) but `ticketTypes={cardData}` was ' +
      'not found anywhere in the file — the pooled-capacity result may never reach the rendered ' +
      '<TicketPurchaseForm> at all, exactly the dead-computation class of defect A10 exists to ' +
      'catch for route.ts.'
  );
}

console.log(
  `PASS: CategoryTicketsPage.tsx's types.map((t) => { ... }) callback (opens at line ` +
    `${lineOf(mapBodyOpen)}) calls planPooledCapacity() and sets soldOut from its result, and ` +
    'the resulting cardData is passed to the rendered <TicketPurchaseForm ticketTypes={cardData}>.'
);
process.exit(0);
