// go-live-prep F6 -- offline behaviour of door-seed teardown and the app-project guard, against
// an in-memory fake. No Firestore, no credentials, no .env.local.
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { initializeApp } from 'firebase-admin/app';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import {
  assertAppTargetAllowed,
  buildAppOptions,
  teardown,
  teardownExitCode,
} from '../../../scripts/seed-door-test-tickets.ts';

const MARKER_EMAIL = 'fixture@door-qr-check.invalid';
const MARKER_NAME = 'Door QR Fixture';
const REF = 'DOOR-QR-ADMIT-01';

type Data = Record<string, unknown>;
const marked = (): Data => ({ bookingRef: REF, attendeeEmail: MARKER_EMAIL, attendeeName: MARKER_NAME });
const unmarked = (): Data => ({ bookingRef: REF, attendeeEmail: 'someone@example.com', attendeeName: 'Real' });

const failures: string[] = [];
const fail = (m: string) => failures.push(m);

/** In-memory Firestore stand-in. `beforeTransaction` mutates the store between query and delete. */
function makeFake(docs: Record<string, Data>, beforeTransaction?: (store: Record<string, Data>) => void) {
  const store = { ...docs };
  const refFor = (id: string) => ({ id, path: `tickets/${id}` }) as unknown as DocumentReference;
  const fake = {
    collection: () => ({
      where: (_field: string, _op: string, value: string) => ({
        get: async () => ({
          docs: Object.entries(store)
            .filter(([, d]) => d['bookingRef'] === value)
            .map(([id, d]) => ({ ref: refFor(id), data: () => d })),
        }),
      }),
    }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      beforeTransaction?.(store);
      const pending: string[] = [];
      const tx = {
        get: async (ref: { id: string }) => ({ exists: ref.id in store, data: () => store[ref.id] }),
        delete: (ref: { id: string }) => void pending.push(ref.id),
      };
      const result = await fn(tx);
      for (const id of pending) delete store[id];
      return result;
    },
  };
  return { db: fake as unknown as Firestore, store };
}

async function run(
  label: string,
  docs: Record<string, Data>,
  expectedSkips: number,
  expectedRemaining: string[],
  beforeTransaction?: (store: Record<string, Data>) => void,
): Promise<void> {
  const { db, store } = makeFake(docs, beforeTransaction);
  const log = console.log;
  const err = console.error;
  console.log = () => undefined;
  console.error = () => undefined;
  let skipped: string[];
  try {
    skipped = await teardown(db);
  } finally {
    console.log = log;
    console.error = err;
  }
  const exitCode = teardownExitCode(skipped);
  if (skipped.length !== expectedSkips) fail(`${label}: expected ${expectedSkips} skip(s), got ${skipped.length}`);
  if (exitCode !== (expectedSkips > 0 ? 1 : 0)) fail(`${label}: wrong exit status ${exitCode}`);
  const remaining = Object.keys(store).sort();
  if (JSON.stringify(remaining) !== JSON.stringify(expectedRemaining)) {
    fail(`${label}: remaining docs ${JSON.stringify(remaining)}, expected ${JSON.stringify(expectedRemaining)}`);
  }
}

await run('marked doc deleted', { a: marked() }, 0, []);
await run('unmarked doc kept', { a: unmarked() }, 1, ['a']);
await run('two docs, one reference', { a: marked(), b: unmarked() }, 1, ['b']);
await run('markers vanish between read and delete', { a: marked() }, 1, ['a'], (store) => {
  store['a'] = unmarked();
});

// Guard: the initialised app is checked, whatever the env says.
process.env['FIREBASE_ADMIN_PROJECT_ID'] = 'benign-fixture-project';
const liveApp = initializeApp({ projectId: 'saoc-webapp' }, 'door-teardown-skip-live');
try {
  assertAppTargetAllowed(liveApp);
  fail('guard allowed an app whose project is saoc-webapp');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg.startsWith('door-seed refused:')) fail(`app guard refusal must start "door-seed refused:", got "${msg}"`);
}
const benignApp = initializeApp({ projectId: 'benign-fixture-project' }, 'door-teardown-skip-benign');
try {
  assertAppTargetAllowed(benignApp);
} catch (err) {
  fail(`app guard refused a benign project: ${err instanceof Error ? err.message : String(err)}`);
}
try {
  assertAppTargetAllowed({ options: {} });
  fail('app guard allowed an app with no project id');
} catch {
  // expected: fails closed
}

// The app is built the way the script builds it, so a benign project must be accepted.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const email = 'fixture@benign-fixture-project.iam.gserviceaccount.com';
for (const [id, allowed] of [['benign-fixture-project', true], ['saoc-webapp', false]] as const) {
  const app = initializeApp(buildAppOptions(id, email, privateKey), `door-teardown-skip-real-${id}`);
  try {
    assertAppTargetAllowed(app);
    if (!allowed) fail(`script-built app for ${id} was allowed`);
  } catch (err) {
    if (allowed) fail(`script-built app for ${id} was refused: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// The CLI teardown branch must set its exit status through teardownExitCode.
const source = readFileSync('scripts/seed-door-test-tickets.ts', 'utf8');
const branch = source.slice(source.indexOf("command === 'teardown'"));
const branchBody = branch.slice(0, branch.indexOf('return;'));
if (!/process\.exitCode = teardownExitCode\(skipped\)/.test(branchBody)) {
  fail('the CLI teardown branch does not set process.exitCode = teardownExitCode(skipped)');
}

if (failures.length) {
  console.error(`FAIL door-teardown-skip:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('PASS door-teardown-skip');
process.exit(0);
