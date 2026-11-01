// go-live-prep F6 / H12 -- static shape of scripts/seed-door-test-tickets.ts: no bypass surface,
// teardown stays exact-bookingRef scoped and ungated, the guard runs before any Admin SDK use.
// Offline, no credentials.
import { readFileSync } from 'node:fs';

const SRC = readFileSync('scripts/seed-door-test-tickets.ts', 'utf8');
const failures = [];
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function bodyOf(name) {
  const start = code.indexOf(`function ${name}(`);
  if (start === -1) return null;
  const open = code.indexOf('{', code.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  return null;
}

// 1. No bypass surface: only argv[2] is read, and no flag/env vocabulary that implies an override.
if (/process\.argv\[(?![12]\])\d+\]|process\.argv\.slice\(|--force|--allow|--live|--yes|--i-know/i.test(code)) failures.push('the script reads extra argv or names a bypass flag');
if (/ALLOW_LIVE|BYPASS|OVERRIDE|FORCE_LIVE|UNSAFE/i.test(code)) failures.push('the script names a bypass env var');
if ((code.match(/process\.env\.[A-Z_]*(ALLOW|FORCE|BYPASS|OVERRIDE)[A-Z_]*/g) ?? []).length) failures.push('the script reads an allow/force/bypass env var');

// 2. The guard exists, names the live project once, and runs before admin() is reached in seedFixtureDoc.
if (!/export const LIVE_PROJECT_ID = 'saoc-webapp'/.test(code)) failures.push("missing: export const LIVE_PROJECT_ID = 'saoc-webapp'");
if (!/export function assertSeedTargetAllowed\(/.test(code)) failures.push('missing: export function assertSeedTargetAllowed(');
const seedBody = bodyOf('seedFixtureDoc');
if (!seedBody) failures.push('seedFixtureDoc not found');
else {
  const g = seedBody.indexOf('assertSeedTargetAllowed');
  const d = seedBody.indexOf('db()');
  if (g === -1) failures.push('seedFixtureDoc does not call the guard');
  else if (d !== -1 && g > d) failures.push('seedFixtureDoc calls the guard after db(); the guard must come first');
}

// 3. Teardown stays marker-scoped: exact bookingRef equality, no sweep, and it is NOT gated (it is the cleanup path).
const tearBody = bodyOf('teardown');
if (!tearBody) failures.push('teardown not found');
else {
  if (!/where\('bookingRef', '==', bookingRef\)/.test(tearBody)) failures.push("teardown must query where('bookingRef', '==', bookingRef) per fixture");
  if (/startsWith\(|endsWith\(|\.includes\(|attendeeEmail/.test(tearBody)) failures.push('teardown matches by prefix/suffix/email; it must stay an exact bookingRef set');
  if (/\.collection\(TICKETS_COLLECTION\)\s*\.get\(\)/.test(tearBody)) failures.push('teardown reads the whole collection');
  if (/assertSeedTargetAllowed/.test(tearBody)) failures.push('teardown is gated by the seed guard; cleanup on any project must stay possible');
}
if (!/SEEDED_BOOKING_REFS[^;]*FIXTURES\.filter\(\(f\) => f\.seededInFirestore\)/s.test(code)) failures.push('SEEDED_BOOKING_REFS no longer derives from seededInFirestore fixtures');

// 4. Fixtures no longer share the exhibitor slug.
if (/TICKET_TYPE = 'exhibitor'|ticketType: 'exhibitor'/.test(code)) failures.push("fixtures still use the 'exhibitor' ticketType");
if (!/FIXTURE_TICKET_TYPE = 'door-qr-fixture'/.test(code)) failures.push("missing: FIXTURE_TICKET_TYPE = 'door-qr-fixture'");

// 5. Residue scanner still knows the fixtures (set unchanged except for the ticketType, which is not a marker).
if (!readFileSync('scripts/scan-firestore-residue.ts', 'utf8').includes("'DOOR-QR-ADMIT-01'")) failures.push('residue scanner lost the DOOR-QR-ADMIT-01 exemption');

if (failures.length) {
  console.error(`FAIL door-seed-static:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('PASS door-seed-static');
