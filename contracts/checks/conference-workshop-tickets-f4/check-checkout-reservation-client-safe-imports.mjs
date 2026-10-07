// F4 (conference-workshop-tickets, M2) — A26: lib/checkout-reservation.ts is reached by a
// CLIENT component today (lib/vendor-stand-pricing.ts imports isWithinEarlyBirdWindow from
// it — F5's own lane, untouched by this feature), so anything it imports at module scope
// ships in the client bundle, or the build breaks. That's exactly what happened
// (2026-10-07, rollout failure): §7's getPoolRemaining() imports
// getSoldCountsByTicketType/getSoldCountsByTicketTypeAndDay from lib/data/tickets.ts at
// module scope, which pulls in firebase-admin (Admin SDK, server-only) — the client bundle
// then transitively required firebase-admin and the build broke. @dev is moving
// getPoolRemaining() and its lib/data/tickets.ts imports into a new server-only sibling
// module (see the golden's build-break addendum).
//
// This check pins the invariant GOING FORWARD, not just for this one regression: a cheap
// static grep over this file's own top-level `import` lines (team-lead's explicit
// direction — a full build belongs in CI/deploy, not the contract gate). Same
// bite-proof pattern as A23/A24: the SAME check is run a second time against an
// IN-MEMORY MUTATED COPY with the exact build-breaking import line re-added, and must
// fail there, before asserting the real file passes. lib/checkout-reservation.ts on disk
// is never touched by this script.
//
// EXPECTED TO FAIL TODAY (2026-10-07) against the real file — @dev's fix has not landed
// yet, so the real source still carries the bad import. This is correct: the check is
// meant to catch exactly that state. It should go green the moment @dev's extraction
// lands, with no change needed to this script.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL_PATH = 'lib/checkout-reservation.ts';
const absPath = path.join(__dirname, '../../../', REL_PATH);

const failures = [];
let source;
try {
  source = readFileSync(absPath, 'utf8');
} catch (error) {
  console.error('FAIL: check-checkout-reservation-client-safe-imports.mjs');
  console.error(`  - could not read ${REL_PATH}: ${error.message}`);
  process.exit(1);
}

/** Extracts every top-level VALUE `import ... from '...'`/`"..."` line's module
 * specifier — deliberately excluding `import type { ... } from '...'`, which TypeScript
 * erases entirely at compile time and ships no runtime code at all (the file's own
 * `import type { Timestamp } from 'firebase-admin/firestore'` is exactly this: real,
 * necessary, and harmless to the client bundle — it is not what broke the build; the
 * VALUE import of lib/data/tickets.ts's functions is). Deliberately line-based, not a
 * full parser — "cheap static grep, not a full build" per team-lead's direction; this
 * file's own import style (one `import` statement per line-or-short-block, always a
 * single quoted specifier) makes a line scan reliable without pulling in a TS/JS parser
 * dependency. */
function importSpecifiers(text) {
  const specifiers = [];
  const re = /^\s*import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm;
  let match;
  while ((match = re.exec(text)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

/** A specifier "reaches" a server-only module if it's the firebase-admin package itself,
 * or any lib/data/* sibling (relative './data/...' or aliased '@/lib/data/...') — both are
 * paths this project's Admin-SDK-backed data helpers live under (see lib/data/tickets.ts's
 * own getSoldCountsByTicketType, the function that caused this build break). */
function reachesServerOnly(specifier) {
  if (specifier === 'firebase-admin' || specifier.startsWith('firebase-admin/')) return true;
  if (/^\.\/data\//.test(specifier)) return true;
  if (/^@\/lib\/data\//.test(specifier)) return true;
  return false;
}

function checkNoServerOnlyImport(text) {
  const bad = importSpecifiers(text).filter(reachesServerOnly);
  if (bad.length > 0) {
    return `found server-only import specifier(s) at module scope: ${bad.join(', ')} — lib/checkout-reservation.ts is client-reachable (lib/vendor-stand-pricing.ts imports isWithinEarlyBirdWindow from it) and any such import ships firebase-admin into the client bundle, breaking the build`;
  }
  return null;
}

const realFailure = checkNoServerOnlyImport(source);
if (realFailure) failures.push(`real source: ${realFailure}`);

// BITE PROOF: mutate an in-memory copy to re-add the exact import that caused this
// feature's build break, and confirm the SAME check now fails there too. Pure string
// surgery on a local variable — lib/checkout-reservation.ts on disk is never touched.
const mutatedSource = `import {\n  getSoldCountsByTicketType,\n} from './data/tickets.ts';\n${source}`;
const mutatedFailure = checkNoServerOnlyImport(mutatedSource);
if (!mutatedFailure) {
  failures.push(
    'BITE PROOF: re-adding the ./data/tickets.ts import did NOT trip this check — it proves nothing about the regression that broke the build',
  );
}

if (failures.length > 0) {
  console.error('FAIL: check-checkout-reservation-client-safe-imports.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  "PASS: lib/checkout-reservation.ts has no top-level import reaching firebase-admin or lib/data/* — stays client-safe for lib/vendor-stand-pricing.ts's import of isWithinEarlyBirdWindow. Bite proof confirmed against an in-memory copy with the build-breaking import re-added.",
);
