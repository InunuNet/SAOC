#!/usr/bin/env node
// F1 (public-supporter-registration) — a token minted for one purpose ('confirm',
// 'unsubscribe', 'erase') must NOT verify against a different expectedPurpose, and a token
// minted for one registrationId must not verify against a different registrationId's own
// verification call (i.e. the signature covers registrationId, not just purpose+expiry). See
// goldens/README.md "Purpose-scoped tokens — why confirm and erase cannot be the same token."
//
// This is the concrete security property behind that design choice: a leaked confirm-email
// link (forwarded, previewed by a mail client, crawled by a corporate link-scanner) must not
// double as a delete-my-data link.
//
// Defeating mutation: verifySupporterRegistrationToken() that ignores `expectedPurpose`
// entirely and just returns whatever purpose the token itself carries — every
// wrong-purpose case below would then wrongly report `ok: true`.
//
// Run as: node --import tsx/esm contracts/checks/public-supporter-registration-f1/check-purpose-scoped-tokens.mjs

import {
  mintSupporterRegistrationToken,
  verifySupporterRegistrationToken,
} from '../../../lib/supporter-registration-token.ts';

const failures = [];
const SECRET = 'test-secret-value';
const MINT_TIME = new Date('2026-09-01T00:00:00Z');
const VERIFY_TIME = new Date('2026-09-01T00:05:00Z');

function expectOk(label, result, expected) {
  if (!result.ok) {
    failures.push(`${label}: expected ok:true, got refusal reason "${result.reason}".`);
    return;
  }
  if (result.registrationId !== expected.registrationId || result.purpose !== expected.purpose) {
    failures.push(
      `${label}: verified payload (${JSON.stringify(result)}) did not match expected ` +
        `(${JSON.stringify(expected)}).`,
    );
  }
}

function expectRefused(label, result, reason) {
  if (result.ok) {
    failures.push(`${label}: expected refusal (${reason}), but token verified as ok:true.`);
  } else if (result.reason !== reason) {
    failures.push(`${label}: expected refusal reason "${reason}", got "${result.reason}".`);
  }
}

const confirmToken = mintSupporterRegistrationToken({
  registrationId: 'reg-A',
  purpose: 'confirm',
  secret: SECRET,
  now: MINT_TIME,
});

const eraseToken = mintSupporterRegistrationToken({
  registrationId: 'reg-A',
  purpose: 'erase',
  secret: SECRET,
  now: MINT_TIME,
});

const otherRegistrationConfirmToken = mintSupporterRegistrationToken({
  registrationId: 'reg-B',
  purpose: 'confirm',
  secret: SECRET,
  now: MINT_TIME,
});

// (1) Correct purpose + correct expectation — verifies.
expectOk(
  '(1) confirm token verified with expectedPurpose confirm',
  verifySupporterRegistrationToken({ token: confirmToken.token, expectedPurpose: 'confirm', secret: SECRET, now: VERIFY_TIME }),
  { registrationId: 'reg-A', purpose: 'confirm' },
);

// (2) THE critical case — a confirm token checked against expectedPurpose 'erase' must refuse.
expectRefused(
  '(2) confirm token checked against expectedPurpose erase',
  verifySupporterRegistrationToken({ token: confirmToken.token, expectedPurpose: 'erase', secret: SECRET, now: VERIFY_TIME }),
  'wrong-purpose',
);

// (3) And the reverse — an erase token must not verify as a confirm.
expectRefused(
  '(3) erase token checked against expectedPurpose confirm',
  verifySupporterRegistrationToken({ token: eraseToken.token, expectedPurpose: 'confirm', secret: SECRET, now: VERIFY_TIME }),
  'wrong-purpose',
);

// (4) A confirm token checked against expectedPurpose unsubscribe must also refuse (not just
// the one paired opposite from case 2/3).
expectRefused(
  '(4) confirm token checked against expectedPurpose unsubscribe',
  verifySupporterRegistrationToken({ token: confirmToken.token, expectedPurpose: 'unsubscribe', secret: SECRET, now: VERIFY_TIME }),
  'wrong-purpose',
);

// (5) Two different registrations' confirm tokens must not be interchangeable — verifying
// reg-B's token returns registrationId 'reg-B', never 'reg-A' (proves the signature genuinely
// covers registrationId, not just purpose+expiry, which a lazy implementation could satisfy
// while still confusing two different registrants' tokens).
{
  const result = verifySupporterRegistrationToken({
    token: otherRegistrationConfirmToken.token,
    expectedPurpose: 'confirm',
    secret: SECRET,
    now: VERIFY_TIME,
  });
  if (!result.ok || result.registrationId !== 'reg-B') {
    failures.push(
      `(5) reg-B's confirm token did not verify to registrationId 'reg-B' (got ${JSON.stringify(result)}).`,
    );
  }
}

// (6) A tampered token (payload segment swapped for a different registration's payload, real
// signature left in place) must fail signature verification, not silently adopt the swapped
// registrationId.
{
  const [, confirmSig] = confirmToken.token.split('.');
  const [otherPayload] = otherRegistrationConfirmToken.token.split('.');
  const tampered = `${otherPayload}.${confirmSig}`;
  const result = verifySupporterRegistrationToken({ token: tampered, expectedPurpose: 'confirm', secret: SECRET, now: VERIFY_TIME });
  expectRefused('(6) payload swapped, foreign signature reused', result, 'bad-signature');
}

// (7) Expired token — minted with a 1ms TTL, verified 5 minutes later.
{
  const shortLived = mintSupporterRegistrationToken({
    registrationId: 'reg-A',
    purpose: 'confirm',
    secret: SECRET,
    now: MINT_TIME,
    ttlMs: 1,
  });
  const result = verifySupporterRegistrationToken({ token: shortLived.token, expectedPurpose: 'confirm', secret: SECRET, now: VERIFY_TIME });
  expectRefused('(7) expired token', result, 'expired');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: supporter registration tokens are purpose- and registration-scoped — a token minted ' +
    'for one purpose refuses verification under any other expectedPurpose (checked against ' +
    'all three other purposes), two different registrations\' tokens are not interchangeable, ' +
    'a tampered/swapped payload fails signature verification, and an expired token refuses.',
);
process.exit(0);
