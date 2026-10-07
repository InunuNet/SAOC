// F4 (conference-workshop-tickets, M2) — A5: getSoldCountsByTicketTypeAndDay() exists in
// lib/data/tickets.ts, reuses the EXACT same Firestore query shape (collection/showId/
// status/stillHoldsSeat filter) as the existing getSoldCountsByTicketType(), and keys its
// counts by `${ticketType}::${chosenDay}` only for slugs in its dayQualifiedTypes argument
// — every other ticket document is keyed by plain ticketType, so its output merges into
// getSoldCountsByTicketType()'s with no key collision. No Firestore emulator is available
// on this machine (see contracts/checks/vendor-gated-registration-flow/
// check-single-use-claim-is-atomic.mjs's own header for why), so this is a STRUCTURAL
// proof against the real source text — existence, exact query-shape reuse, and the
// day-qualified keying logic — not a live-query behavioural test.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL_PATH = 'lib/data/tickets.ts';
const absPath = path.join(__dirname, '../../../', REL_PATH);

const failures = [];
let source;
try {
  source = readFileSync(absPath, 'utf8');
} catch (error) {
  console.error('FAIL: check-get-sold-counts-by-type-and-day.mjs');
  console.error(`  - could not read ${REL_PATH}: ${error.message}`);
  process.exit(1);
}

const signatureMatch = source.match(
  /export\s+async\s+function\s+getSoldCountsByTicketTypeAndDay\s*\(([\s\S]*?)\)\s*:/,
);
if (!signatureMatch) {
  console.error('FAIL: check-get-sold-counts-by-type-and-day.mjs');
  console.error(`  - ${REL_PATH} does not export an async function getSoldCountsByTicketTypeAndDay(...)`);
  process.exit(1);
}

const params = signatureMatch[1];
if (!/showId/.test(params)) failures.push('signature does not name a showId parameter');
if (!/dayQualifiedTypes/.test(params)) failures.push('signature does not name a dayQualifiedTypes parameter');
if (!/transaction/.test(params)) failures.push('signature does not name an (optional) transaction parameter');

// Extract the function's own body via balanced-brace scan from its opening '{' to find
// ONLY this function's statements — not the whole file (getSoldCountsByTicketType's own
// body must not be what this match inspects).
const fnStart = signatureMatch.index;
const braceOpenIdx = source.indexOf('{', fnStart + signatureMatch[0].length - 1);
let depth = 0;
let closeIdx = -1;
for (let i = braceOpenIdx; i < source.length; i++) {
  if (source[i] === '{') depth++;
  else if (source[i] === '}') {
    depth--;
    if (depth === 0) {
      closeIdx = i;
      break;
    }
  }
}
const body = closeIdx === -1 ? '' : source.slice(braceOpenIdx, closeIdx + 1);

if (closeIdx === -1) {
  failures.push('could not find a balanced closing brace for getSoldCountsByTicketTypeAndDay() — unbalanced braces?');
} else {
  // Same query shape as getSoldCountsByTicketType(): tickets collection, showId equality,
  // a status filter, and the existing stillHoldsSeat() gate reused (not reimplemented).
  if (!/collection\(\s*['"`]tickets['"`]\s*\)/.test(body)) {
    failures.push("function body does not query the 'tickets' collection — same query shape must be reused");
  }
  if (!/where\(\s*['"`]showId['"`]/.test(body)) {
    failures.push("function body does not filter .where('showId', ...) — same query shape must be reused");
  }
  if (!/stillHoldsSeat\s*\(/.test(body)) {
    failures.push('function body never calls stillHoldsSeat( — must reuse the existing filter, not reimplement its own expiry logic');
  }
  // Day-qualified keying: a template literal joining ticketType and a day field with '::',
  // gated by membership in dayQualifiedTypes — every other ticket keeps a plain ticketType key.
  if (!/dayQualifiedTypes\.has\(/.test(body) && !/dayQualifiedTypes\.includes\(/.test(body)) {
    failures.push('function body never checks membership in dayQualifiedTypes — every ticket would be keyed the same way regardless of the argument');
  }
  if (!/::\$\{/.test(body) && !/\$\{[^}]*\}::\$\{/.test(body)) {
    failures.push("function body has no '${...}::${...}' day-qualified key template — expected `${ticketType}::${chosenDay}` keying");
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-get-sold-counts-by-type-and-day.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: getSoldCountsByTicketTypeAndDay() exists, reuses the same tickets/showId/stillHoldsSeat query shape, and day-qualifies keys only for dayQualifiedTypes members.',
);
