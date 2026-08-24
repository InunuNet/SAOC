// ozow-sandbox-toggle F1 — proves isOzowSandboxTestModeEnabled() fails closed on every
// non-affirmative case, offline, with a fake Firestore-shaped `db` injected via deps (same
// deps-injection pattern as createOzowProvider() — no live Firestore, no network).
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §2 for the full contract.
//
// Run as: npx tsx contracts/checks/ozow-sandbox-toggle-f1/check-fail-closed-flag-read.mjs

import { isOzowSandboxTestModeEnabled } from '../../../lib/ozow-sandbox-test-mode.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

/** Builds a fake Firestore `db` whose `.collection(x).doc(y).get()` resolves/rejects as told. */
function fakeDb({ exists, data, throws }) {
  return {
    collection() {
      return {
        doc() {
          return {
            async get() {
              if (throws) throw new Error('simulated Firestore read failure');
              return { exists, data: () => data };
            },
          };
        },
      };
    },
  };
}

async function run() {
  // 1. Doc does not exist at all -> false. This is "OFF by default."
  {
    const db = fakeDb({ exists: false, data: undefined });
    const result = await isOzowSandboxTestModeEnabled({ db });
    if (result !== false) fail(`case 1 (doc missing): expected false, got ${result}`);
  }

  // 2. Doc exists but `enabled` field is absent -> false.
  {
    const db = fakeDb({ exists: true, data: {} });
    const result = await isOzowSandboxTestModeEnabled({ db });
    if (result !== false) fail(`case 2 (field absent): expected false, got ${result}`);
  }

  // 3. `enabled` is the literal boolean true -> the ONLY case that returns true.
  {
    const db = fakeDb({ exists: true, data: { enabled: true } });
    const result = await isOzowSandboxTestModeEnabled({ db });
    if (result !== true) fail(`case 3 (enabled:true): expected true, got ${result}`);
  }

  // 4. `enabled` is the literal boolean false -> false.
  {
    const db = fakeDb({ exists: true, data: { enabled: false } });
    const result = await isOzowSandboxTestModeEnabled({ db });
    if (result !== false) fail(`case 4 (enabled:false): expected false, got ${result}`);
  }

  // 5. `enabled` is the STRING 'true', not the boolean -> false. No truthy-string shortcut.
  {
    const db = fakeDb({ exists: true, data: { enabled: 'true' } });
    const result = await isOzowSandboxTestModeEnabled({ db });
    if (result !== false) fail(`case 5 (string 'true'): expected false, got ${result}`);
  }

  // 6. `enabled` is the number 1 -> false. No numeric truthy coercion either.
  {
    const db = fakeDb({ exists: true, data: { enabled: 1 } });
    const result = await isOzowSandboxTestModeEnabled({ db });
    if (result !== false) fail(`case 6 (number 1): expected false, got ${result}`);
  }

  // 7. The Firestore read itself throws (network/permission error) -> false, not an exception
  // propagating out of isOzowSandboxTestModeEnabled(). A caller must never have to wrap this in
  // its own try/catch to stay fail-closed.
  {
    const db = fakeDb({ throws: true });
    let threw = false;
    let result;
    try {
      result = await isOzowSandboxTestModeEnabled({ db });
    } catch {
      threw = true;
    }
    if (threw) fail('case 7 (read throws): isOzowSandboxTestModeEnabled() must not throw');
    else if (result !== false) fail(`case 7 (read throws): expected false, got ${result}`);
  }

  // 8. `enabled` is `null` -> false.
  {
    const db = fakeDb({ exists: true, data: { enabled: null } });
    const result = await isOzowSandboxTestModeEnabled({ db });
    if (result !== false) fail(`case 8 (enabled:null): expected false, got ${result}`);
  }

  if (FAIL) {
    console.error('FAIL: isOzowSandboxTestModeEnabled() does not fail closed on every case.');
    process.exit(1);
  }
  console.log('PASS: isOzowSandboxTestModeEnabled() fails closed on all 8 cases.');
}

run();
