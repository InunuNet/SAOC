// go-live-prep F6 / H12 -- pure, offline behaviour of the door-seed live-project guard and the
// fixture builder. No network, no credentials: every case passes an explicit env object.
// Fails against main because scripts/seed-door-test-tickets.ts exports none of these names.
import { readFileSync } from 'node:fs';

import { Timestamp } from 'firebase-admin/firestore';

import {
  FIXTURES,
  FIXTURE_TICKET_TYPE,
  LIVE_PROJECT_ID,
  assertSeedTargetAllowed,
  buildFixtureFields,
  seedFixtureDoc,
} from '../../../scripts/seed-door-test-tickets.ts';

type EnvCase = { label: string; env: Record<string, string> };

const failures: string[] = [];
const fail = (m: string) => failures.push(m);

function refuses(label: string, env: Record<string, string | undefined>): void {
  try {
    assertSeedTargetAllowed(env);
    fail(`${label}: expected a refusal, the guard allowed it`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith('door-seed refused:')) fail(`${label}: refusal message must start "door-seed refused:", got "${msg}"`);
  }
}

function allows(label: string, env: Record<string, string | undefined>): void {
  try {
    assertSeedTargetAllowed(env);
  } catch (err) {
    fail(`${label}: expected the guard to allow a non-live project, it threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (LIVE_PROJECT_ID !== 'saoc-webapp') fail(`LIVE_PROJECT_ID must be "saoc-webapp", got "${LIVE_PROJECT_ID}"`);

const cases = JSON.parse(
  readFileSync('.agent/memory/project/specs/go-live-prep/f6-hardening/goldens/door-seed-refusal-cases.json', 'utf8'),
) as { refuse: EnvCase[]; allow: EnvCase[] };
for (const c of cases.refuse) refuses(c.label, c.env);
for (const c of cases.allow) allows(c.label, c.env);
refuses('empty env object (id unset fails closed)', {});

// The guard is also wired into the exported seedFixtureDoc, so a caller that skips main() is still blocked.
process.env['FIREBASE_ADMIN_PROJECT_ID'] = 'saoc-webapp';
try {
  await seedFixtureDoc(FIXTURES[0]!);
  fail('seedFixtureDoc ran against the live project id without refusing');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg.startsWith('door-seed refused:')) fail(`seedFixtureDoc against live must refuse with "door-seed refused:", got "${msg}"`);
}
delete process.env['FIREBASE_ADMIN_PROJECT_ID'];

// Fixture shape against the golden.
const golden = JSON.parse(readFileSync('contracts/golden/door-test-qr-seeder/fixtures.golden.json', 'utf8')) as {
  ticketType: string;
  fixtures: Array<{ bookingRef: string; seededInFirestore: boolean; doc: Record<string, unknown> | null }>;
};
if (FIXTURE_TICKET_TYPE !== 'door-qr-fixture' || golden.ticketType !== 'door-qr-fixture') {
  fail(`fixture ticketType must be "door-qr-fixture" in code and golden (code "${FIXTURE_TICKET_TYPE}", golden "${golden.ticketType}")`);
}
const now = Timestamp.now();
for (const g of golden.fixtures) {
  const f = FIXTURES.find((x) => x.bookingRef === g.bookingRef);
  if (!f) {
    fail(`FIXTURES is missing ${g.bookingRef}`);
    continue;
  }
  if (!g.doc) continue;
  if (!f.doc) {
    fail(`${g.bookingRef}: FIXTURES has no doc but the golden does`);
    continue;
  }
  const fields = buildFixtureFields(f, now);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) fail(`${g.bookingRef}: field "${k}" is undefined (Firestore rejects it)`);
  }
  if (fields['ticketType'] === 'exhibitor') fail(`${g.bookingRef}: still seeded as exhibitor`);
  for (const key of ['showId', 'status', 'ticketType', 'attendeeEmail', 'attendeeName', 'amount', 'm_payment_id']) {
    if (fields[key] !== g.doc[key]) fail(`${g.bookingRef}.${key} = ${String(fields[key])}, golden ${String(g.doc[key])}`);
  }
  const exp = fields['expiresAt'];
  if (g.doc['status'] === 'reserved') {
    if (!(exp instanceof Timestamp)) fail(`${g.bookingRef}: reserved fixture must carry an expiresAt Timestamp, got ${String(exp)}`);
    else if (exp.toMillis() > now.toMillis()) fail(`${g.bookingRef}: expiresAt must be at or before seed time (born expired)`);
  } else if (exp !== null) {
    fail(`${g.bookingRef}: non-reserved fixture must carry expiresAt: null, got ${String(exp)}`);
  }
}

if (failures.length) {
  console.error(`FAIL door-seed-guard:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('PASS door-seed-guard');
