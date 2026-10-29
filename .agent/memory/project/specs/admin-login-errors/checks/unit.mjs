// Pure-function checks for lib/admin-login-errors.ts. Run: pnpm exec tsx <this file>. No Firebase import, no network.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const copy = JSON.parse(readFileSync('.agent/memory/project/specs/admin-login-errors/goldens/copy.json', 'utf8'));
const m = await import(`${process.cwd()}/lib/admin-login-errors.ts`);
const errs = [];
console.error = (...a) => errs.push(JSON.stringify(a, (_k, v) => (v instanceof Error ? { name: v.name, code: v.code } : v)));
const coded = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

// A2: every non-enumerating code returns the identical, verbatim string.
for (const code of copy.codesSameAsInvalidCredential) assert.equal(m.passwordSignInErrorMessage(coded(code)), copy.invalidCredential, code);
assert.equal(new Set(['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential'].map((c) => m.passwordSignInErrorMessage(coded(c)))).size, 1);
assert.equal(m.passwordSignInErrorMessage(coded('auth/too-many-requests')), copy.tooManyRequests);
assert.equal(m.passwordSignInErrorMessage(coded('auth/network-request-failed')), copy.network);
assert.equal(m.NETWORK_ERROR_MESSAGE, copy.network);
assert.equal(m.GENERIC_SIGN_IN_ERROR, copy.generic);

// A3: nothing raw reaches the UI, whatever the input.
const hostile = [new Error('Firebase: Error (auth/x)'), coded('auth/x'), coded('auth/user-disabled'), new Error('Session creation failed'), 'Firebase: boom', null, undefined, 42, {}, { code: 'auth/internal-error', message: 'Firebase: Error (auth/internal-error).' }];
for (const e of hostile) {
  const out = m.passwordSignInErrorMessage(e);
  assert.equal(out, copy.generic, String(e));
  assert.ok(!/Firebase|auth\//.test(out));
}
for (const code of [...copy.codesSameAsInvalidCredential, 'auth/too-many-requests', 'auth/network-request-failed']) {
  assert.ok(!/Firebase|auth\//.test(m.passwordSignInErrorMessage(coded(code))), code);
}
assert.equal(m.firebaseErrorCode(coded('auth/x')), 'auth/x');
assert.equal(m.firebaseErrorCode(new Error('plain')), undefined);

// A4: reset is non-enumerating and prompts on empty input.
let calls = [];
const ok = async (e) => { calls.push(e); };
const reject = (e) => async (addr) => { calls.push(addr); throw e; };
const sent = { status: 'sent', message: copy.resetResponse };
assert.deepEqual(await m.requestPasswordReset('  a@b.co ', ok), sent);
assert.deepEqual(calls, ['a@b.co']);
for (const e of [coded('auth/user-not-found'), coded('auth/invalid-email'), coded('auth/too-many-requests'), coded('auth/network-request-failed'), new Error('Firebase: Error (auth/x)'), 'str', null]) {
  calls = [];
  assert.deepEqual(await m.requestPasswordReset('nobody@example.com', reject(e)), sent);
  assert.equal(calls.length, 1);
}
for (const empty of ['', '   ', '\t']) {
  calls = [];
  assert.deepEqual(await m.requestPasswordReset(empty, ok), { status: 'prompt', message: copy.resetEmptyPrompt });
  assert.equal(calls.length, 0);
}
assert.ok(errs.every((l) => !l.includes('nobody@example.com') && !l.includes('Firebase: Error')), `reset logging leaked: ${errs.join(' | ')}`);
console.log('admin-login-errors unit checks pass');
