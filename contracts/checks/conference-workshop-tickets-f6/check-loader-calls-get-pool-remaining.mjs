// F6 (conference-workshop-tickets, M4) — A4: loadTicketCardViewModel calls F4's exported
// getPoolRemaining() for every count it produces — no second, independently-constructed
// Firestore query exists in the loader.
//
// Proven structurally against the SOURCE TEXT of lib/view-models/load-ticket-card.ts:
// (1) it imports getPoolRemaining from lib/checkout-reservation (F4's module — never a
//     locally-redeclared function of the same name, which would defeat the point); (2) it
//     calls getPoolRemaining( at least twice (once unqualified for every product, once per
//     sellable day for day-visitor/early-bird — golden §2); (3) it contains no raw
//     Firestore query of its own (`.collection(`, `.where(`, `getFirestore(`) — any count
//     this loader needs must come through getPoolRemaining(), not a second hand-rolled
//     query sitting beside it.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL_PATH = 'lib/view-models/load-ticket-card.ts';
const failures = [];

let source;
try {
  source = readFileSync(path.join(__dirname, '../../../', REL_PATH), 'utf8');
} catch (error) {
  finish('check-loader-calls-get-pool-remaining.mjs', [`could not read ${REL_PATH}: ${error.message}`]);
  process.exit(1);
}

const sourceNoComments = source
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

if (!/import\s*\{[^}]*\bgetPoolRemaining\b[^}]*\}\s*from\s*['"].*checkout-reservation['"]/.test(sourceNoComments)) {
  failures.push(`${REL_PATH} does not import getPoolRemaining from lib/checkout-reservation — F4's shared counting path`);
}

const callCount = (sourceNoComments.match(/getPoolRemaining\s*\(/g) ?? []).length;
if (callCount < 2) {
  failures.push(
    `getPoolRemaining( is called ${callCount} time(s) in ${REL_PATH}, expected at least 2 (one unqualified call per product, plus one per sellable day for day-qualified products)`,
  );
}

const RAW_FIRESTORE_PATTERNS = [/\.collection\s*\(/, /\.where\s*\(/, /getFirestore\s*\(/, /initAdmin\s*\(/];
for (const pattern of RAW_FIRESTORE_PATTERNS) {
  if (pattern.test(sourceNoComments)) {
    failures.push(
      `${REL_PATH} contains a raw Firestore call matching ${pattern} — a second, independently-constructed query, not sourced through getPoolRemaining()`,
    );
  }
}

finish(
  'check-loader-calls-get-pool-remaining.mjs',
  failures,
  `${REL_PATH} imports and calls F4's getPoolRemaining() for every count it produces, with no second hand-rolled Firestore query.`,
);
