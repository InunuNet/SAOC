#!/usr/bin/env node
// vendor-gated-registration-flow M4/F25 -- BEHAVIOURAL proof, using the route-runner harness
// (contracts/harness/route-runner/), that reissue (a) never leaves an approved application in a
// state its vendor cannot redeem, mirroring check-approval-redemption-behavioural.mjs's proof for
// approval, and (b) genuinely REVOKES the code it replaces, not merely mints a second one
// alongside it -- the property this mission's F24/F25 fix pass added
// (registrationCodeGeneration) specifically to guarantee.
//
// WHY THIS EXISTS, TOLD PLAINLY: A51 (check-reissue-route-resets-lock.mjs) is a SOURCE-ORDER
// proof -- it can see that a FieldValue.increment(...) call exists on the generation field, but
// it cannot see whether that increment is actually CHECKED anywhere downstream, whether the old
// code is actually refused afterward, or whether the two redemption preconditions this mission
// added to reissue (same class as A50's) actually hold at runtime. Those are exactly the kind of
// cross-file, runtime-state-dependent properties this mission's defects have repeatedly hidden
// behind. This check drives the REAL reissue-code route, then the REAL verify-code route twice
// (once with the new code, once with the code it superseded) to prove the revocation is real, not
// asserted.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-gated-registration-flow-m4/check-reissue-redemption-and-revocation-behavioural.mjs

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { applications } = require('../../../contracts/harness/route-runner/store.mjs');
const { sentEmails } = require('../../../contracts/harness/route-runner/fixture-approval-email.mjs');
const { cookieJar } = require('../../../contracts/harness/route-runner/fixture-next-headers.mjs');

const REISSUE = '../../../app/api/admin/vendors/applications/[id]/reissue-code/route.ts';
const VERIFY = '../../../app/api/vendors/register/verify-code/route.ts';

const TEST_SECRET = 'test-secret-not-a-real-credential';
const failures = [];

const { POST: reissuePost } = await import(REISSUE);
const { POST: verifyPost } = await import(VERIFY);

// An already-approved, already-locked-out application -- exactly the state an operator reaches
// for reissue in.
const APPROVED_AND_LOCKED = {
  status: 'approved',
  registrationCodeId: '1111',
  registrationCodeNameSlug: 'fynbospottery',
  registrationCodeExpiresAt: { toDate: () => new Date(Date.now() + 86_400_000) },
  registrationCodeFailedAttempts: 5,
  registrationCodeLockedAt: { toDate: () => new Date() },
  registrationCodeGeneration: 3,
};

function seed(id, businessName, overrides = {}) {
  applications.clear();
  applications.set(id, {
    businessName,
    contactPersonName: 'Jane Vendor',
    contactEmail: 'jane@example.com',
    ...APPROVED_AND_LOCKED,
    ...overrides,
  });
  sentEmails.length = 0;
  cookieJar.clear();
}

async function reissue(id) {
  const res = await reissuePost({}, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

async function verify(businessName, codeId, forwardedFor) {
  const res = await verifyPost({
    json: async () => ({ businessName, codeId }),
    headers: new Headers({ 'x-forwarded-for': forwardedFor }),
  });
  return { status: res.status, body: await res.json() };
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

// -------------------------------------------------------------------------------------------
// D: VENDOR_REGISTRATION_TOKEN_SECRET unset -- reissue must refuse, application's existing
// code/lock/generation untouched. Same defect class as A50, in the reissue route instead.
// -------------------------------------------------------------------------------------------
{
  delete process.env.VENDOR_REGISTRATION_TOKEN_SECRET;
  seed('app-d', 'Fynbos Pottery');
  const result = await reissue('app-d');
  const stored = applications.get('app-d');

  check(result.status !== 200, `D (missing secret): reissue returned HTTP ${result.status}, expected a refusal (non-200).`);
  check(stored.registrationCodeId === '1111', `D (missing secret): registrationCodeId changed to "${stored.registrationCodeId}", expected the original "1111" to be untouched.`);
  check(stored.registrationCodeGeneration === 3, `D (missing secret): registrationCodeGeneration changed to ${stored.registrationCodeGeneration}, expected the original 3 to be untouched.`);
  check(stored.registrationCodeFailedAttempts === 5, `D (missing secret): registrationCodeFailedAttempts changed to ${stored.registrationCodeFailedAttempts}, expected the original lockout (5) to be untouched.`);
}

// -------------------------------------------------------------------------------------------
// E: a business name normalising to an empty slug -- same refusal, same reasoning as A50's item 2.
// -------------------------------------------------------------------------------------------
{
  process.env.VENDOR_REGISTRATION_TOKEN_SECRET = TEST_SECRET;
  seed('app-e', '太陽 陶芸', { registrationCodeNameSlug: '' });
  const result = await reissue('app-e');
  const stored = applications.get('app-e');

  check(result.status !== 200, `E (empty slug): reissue returned HTTP ${result.status}, expected a refusal (non-200).`);
  check(stored.registrationCodeId === '1111', `E (empty slug): registrationCodeId changed to "${stored.registrationCodeId}", expected the original "1111" to be untouched.`);
  check(stored.registrationCodeGeneration === 3, `E (empty slug): registrationCodeGeneration changed to ${stored.registrationCodeGeneration}, expected the original 3 to be untouched.`);
}

// -------------------------------------------------------------------------------------------
// F: the positive control AND the revocation proof -- reissue with the secret set and a usable
// name must succeed, clear the lockout, bump the generation, AND: the NEW code must genuinely
// verify (round-trip through the real verify-code route, minting a real session cookie), while
// the OLD/superseded code "1111" must be genuinely refused. Without this second half, a reissue
// that merely appends a second valid code (never actually revoking the first) would pass a check
// that only looked at the new code -- this is the property F24/F25 exist to guarantee.
// -------------------------------------------------------------------------------------------
{
  process.env.VENDOR_REGISTRATION_TOKEN_SECRET = TEST_SECRET;
  seed('app-f', 'Fynbos Pottery');
  const result = await reissue('app-f');
  const stored = applications.get('app-f');

  check(result.status === 200, `F (positive control): reissue with a valid secret and usable name returned HTTP ${result.status}, expected 200.`);
  check(typeof result.body?.registrationCodeId === 'string' && result.body.registrationCodeId !== '1111', `F (positive control): reissue did not return a fresh registrationCodeId distinct from the superseded "1111".`);
  check(stored.registrationCodeFailedAttempts === 0, `F (positive control): registrationCodeFailedAttempts is ${stored.registrationCodeFailedAttempts} after reissue, expected the lockout to be cleared to 0.`);
  check(!stored.registrationCodeLockedAt, `F (positive control): registrationCodeLockedAt (${JSON.stringify(stored.registrationCodeLockedAt)}) was not cleared by reissue.`);
  check(stored.registrationCodeGeneration === 4, `F (positive control): registrationCodeGeneration is ${stored.registrationCodeGeneration} after reissue, expected 4 (3 + 1) -- the increment that makes this a real revocation.`);

  const newCode = result.body?.registrationCodeId;
  if (newCode) {
    cookieJar.clear();
    const verifiedNew = await verify('Fynbos Pottery', newCode, '203.0.113.11');
    check(verifiedNew.status === 200, `F (positive control): verify-code with the REISSUED code returned HTTP ${verifiedNew.status} ${JSON.stringify(verifiedNew.body)}, expected 200 -- the reissued credential does not actually redeem.`);
    check(cookieJar.has('vendor_registration_session'), 'F (positive control): a successful verify-code with the reissued code did not set the session cookie.');
  }

  const verifiedOld = await verify('Fynbos Pottery', '1111', '203.0.113.12');
  check(verifiedOld.status !== 200, `F (revocation): verify-code with the SUPERSEDED code "1111" returned HTTP ${verifiedOld.status} ${JSON.stringify(verifiedOld.body)}, expected a refusal -- reissue must REVOKE the old code, not just mint a new one alongside it.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS (behavioural, real routes via the route-runner harness): reissue refuses to commit -- ' +
    "the application's existing code/lock/generation left untouched -- when " +
    'VENDOR_REGISTRATION_TOKEN_SECRET is unset OR the business name normalises to an empty slug; ' +
    'and (positive control + revocation proof) a normal reissue clears the lockout, bumps the ' +
    'generation, mints a code that genuinely redeems at the real verify-code route, and genuinely ' +
    'revokes the code it superseded (refused, not merely a second valid code).',
);
process.exit(0);
