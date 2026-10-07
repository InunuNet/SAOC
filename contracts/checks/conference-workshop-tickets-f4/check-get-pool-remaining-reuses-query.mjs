// F4 (conference-workshop-tickets, M2) — A18: getPoolRemaining() is exported from
// lib/data/pool-remaining.ts (RELOCATED 2026-10-07, build-break fix — this function used
// to live in lib/checkout-reservation.ts, which a client component reaches transitively
// via lib/vendor-stand-pricing.ts; its lib/data/tickets.ts imports pulled firebase-admin
// into the client bundle and broke `pnpm build`. See the golden's build-break addendum),
// takes {poolKeyBase, chosenDay, requiresDaySelection, capacity, showId}, and composes
// resolveDayQualifiedPoolKey() (still exported from lib/checkout-reservation.ts, pure,
// unmoved) with the SAME getSoldCountsByTicketTypeAndDay()/getSoldCountsByTicketType()
// functions the checkout transaction itself reads — not a third, independently-
// constructed query. The DEFAULT (no injected deps) path is proven structurally against
// source text — see the golden's check-authoring addendum for why an optional `deps` DI
// parameter exists at all (A19 uses it; production call sites never pass it, so the
// DEFAULT path is what must prove the real reuse).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL_PATH = 'lib/data/pool-remaining.ts';
const absPath = path.join(__dirname, '../../../', REL_PATH);

const failures = [];
let source;
try {
  source = readFileSync(absPath, 'utf8');
} catch (error) {
  console.error('FAIL: check-get-pool-remaining-reuses-query.mjs');
  console.error(`  - could not read ${REL_PATH}: ${error.message}`);
  process.exit(1);
}

const signatureMatch = source.match(/export\s+async\s+function\s+getPoolRemaining\s*\(([\s\S]*?)\)\s*:/);
if (!signatureMatch) {
  console.error('FAIL: check-get-pool-remaining-reuses-query.mjs');
  console.error(`  - ${REL_PATH} does not export an async function getPoolRemaining(...)`);
  process.exit(1);
}

const params = signatureMatch[1];
for (const name of ['poolKeyBase', 'chosenDay', 'requiresDaySelection', 'capacity', 'showId']) {
  if (!new RegExp(name).test(params)) failures.push(`signature does not name a ${name} parameter`);
}

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
  failures.push('could not find a balanced closing brace for getPoolRemaining() — unbalanced braces?');
} else {
  if (!/resolveDayQualifiedPoolKey\s*\(/.test(body)) {
    failures.push('function body never calls resolveDayQualifiedPoolKey( — must compose with A1\'s helper, not re-derive the key itself');
  }
  if (!/getSoldCountsByTicketTypeAndDay/.test(body)) {
    failures.push('function body never references getSoldCountsByTicketTypeAndDay — must reuse it for the day-qualified branch');
  }
  if (!/getSoldCountsByTicketType\b/.test(body)) {
    failures.push('function body never references getSoldCountsByTicketType — must reuse it for the unqualified branch');
  }
  if (/\.collection\s*\(\s*['"`]tickets['"`]\s*\)/.test(body)) {
    failures.push('function body queries the tickets collection directly — it must delegate to the two existing sold-count functions, never build a third, independent query');
  }
  // Cross-slug regression (QA repro, 2026-10-07): the day-qualified branch must sum
  // sold counts across EVERY sibling slug sharing this pool for chosenDay (e.g.
  // day-visitor AND early-bird on the same Friday), not just the single poolKeyBase
  // passed in — getSoldCountsByTicketTypeAndDay() returns one key PER REAL SLUG, never
  // pre-merged. A body that reads only `soldCountsByType[resolvedKey]` silently drops
  // every sibling slug's prior sales from the total (see A19's dual-slug fixture for
  // the numeric proof).
  if (!/DAY_VISITOR_SHAPED_SLUGS/.test(body)) {
    failures.push('function body never references DAY_VISITOR_SHAPED_SLUGS — the day-qualified branch must sum sold counts across every sibling slug sharing this pool for chosenDay, not just the single poolKeyBase (see A19\'s dual-slug fixture)');
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-get-pool-remaining-reuses-query.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: getPoolRemaining() composes resolveDayQualifiedPoolKey() with the two existing sold-count functions, never a third query.');
