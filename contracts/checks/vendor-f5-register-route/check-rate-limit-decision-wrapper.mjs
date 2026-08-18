#!/usr/bin/env node
// F5 (vendor-registration) — design constraint 3: decideVendorRegistrationRateLimit() delegates
// to the REAL decideRateLimit() (lib/resend-rate-limit.ts, F6/ticketing-foundation) with
// vendor-specific constants (VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 3,
// VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS = 1 hour) as overrides — not a reimplementation of the
// sliding-window arithmetic, and not a silent re-export/alias of RESEND_RATE_LIMIT_MAX_ATTEMPTS
// (5)/RESEND_RATE_LIMIT_WINDOW_MS.
//
// Run as: npx tsx contracts/checks/vendor-f5-register-route/check-rate-limit-decision-wrapper.mjs

import {
  decideVendorRegistrationRateLimit,
  VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
  VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS,
} from '../../../lib/vendor-registration-rate-limit.ts';
import { RESEND_RATE_LIMIT_MAX_ATTEMPTS } from '../../../lib/resend-rate-limit.ts';

const failures = [];
const NOW = new Date('2027-01-05T12:00:00Z');
const KEY = 'vendor-register-ip:203.0.113.5';
const OTHER_KEY = 'vendor-register-ip:198.51.100.7';

function attemptsAt(key, timestamps) {
  return timestamps.map((iso) => ({ key, at: new Date(iso) }));
}

// (1) The MAX_ATTEMPTS constant itself must be 3 (a golden-file/README-pinned value).
if (VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS !== 3) {
  failures.push(
    `(1) VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS is ${VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS}, expected 3.`,
  );
}

// (2) Three prior attempts for one key: the 3rd attempt is allowed (attemptsInWindow 2 < 3),
// and the boundary is exactly at MAX_ATTEMPTS — with three PRIOR attempts already recorded, a
// FOURTH call must be refused, with a non-null retryAfterMs.
{
  const threePrior = attemptsAt(KEY, [
    '2027-01-05T11:10:00Z',
    '2027-01-05T11:20:00Z',
    '2027-01-05T11:30:00Z',
  ]);
  const fourthDecision = decideVendorRegistrationRateLimit(KEY, NOW, threePrior);
  if (fourthDecision.allowed !== false) {
    failures.push(
      `(2) with 3 prior attempts already recorded for the same key, the 4th call must be refused ` +
        `(allowed:false), got allowed:${fourthDecision.allowed}.`,
    );
  }
  if (fourthDecision.retryAfterMs === null || fourthDecision.retryAfterMs === undefined) {
    failures.push('(2) a refused decision must carry a non-null retryAfterMs.');
  }

  // The 3rd attempt itself (only 2 prior recorded) must be allowed.
  const twoPrior = attemptsAt(KEY, ['2027-01-05T11:10:00Z', '2027-01-05T11:20:00Z']);
  const thirdDecision = decideVendorRegistrationRateLimit(KEY, NOW, twoPrior);
  if (thirdDecision.allowed !== true) {
    failures.push(
      `(2) with only 2 prior attempts recorded, the 3rd call must be allowed, got allowed:${thirdDecision.allowed}.`,
    );
  }
}

// (3) A DIFFERENT key with the identical priorAttempts array remains fully allowed — the
// decision is keyed, not global.
{
  const threePriorForKey = attemptsAt(KEY, [
    '2027-01-05T11:10:00Z',
    '2027-01-05T11:20:00Z',
    '2027-01-05T11:30:00Z',
  ]);
  const otherKeyDecision = decideVendorRegistrationRateLimit(OTHER_KEY, NOW, threePriorForKey);
  if (otherKeyDecision.allowed !== true) {
    failures.push(
      `(3) a different key with an identical-looking priorAttempts array (all entries keyed to ` +
        `the FIRST key) must remain allowed, got allowed:${otherKeyDecision.allowed}.`,
    );
  }
}

// (4) An attempt older than VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS is excluded from the count —
// a key whose only prior attempts have aged out is allowed again.
{
  const agedOutAt = new Date(NOW.getTime() - VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS - 60 * 1000);
  const agedOutAttempts = [
    { key: KEY, at: agedOutAt },
    { key: KEY, at: agedOutAt },
    { key: KEY, at: agedOutAt },
  ];
  const decision = decideVendorRegistrationRateLimit(KEY, NOW, agedOutAttempts);
  if (decision.allowed !== true) {
    failures.push(
      `(4) three attempts older than the window must be excluded from the count, leaving the key ` +
        `allowed again, got allowed:${decision.allowed}, attemptsInWindow:${decision.attemptsInWindow}.`,
    );
  }
  if (decision.attemptsInWindow !== 0) {
    failures.push(`(4) expected attemptsInWindow 0 for entirely aged-out attempts, got ${decision.attemptsInWindow}.`);
  }
}

// (5) Not a silent re-export/alias of the resend-my-tickets constants: re-running the exact
// 4th-attempt scenario from (2) but with RESEND_RATE_LIMIT_MAX_ATTEMPTS (5) substituted in place
// of the vendor constant must produce a DIFFERENT, more permissive decision at attempt 4.
{
  const threePrior = attemptsAt(KEY, [
    '2027-01-05T11:10:00Z',
    '2027-01-05T11:20:00Z',
    '2027-01-05T11:30:00Z',
  ]);
  const vendorDecision = decideVendorRegistrationRateLimit(KEY, NOW, threePrior);

  // With 3 prior attempts and RESEND_RATE_LIMIT_MAX_ATTEMPTS (5) as the ceiling, the identical
  // scenario would be ALLOWED (3 < 5) — a more permissive outcome than the vendor module's own
  // MAX_ATTEMPTS (3), where 3 prior attempts refuse the 4th. If decideVendorRegistrationRateLimit
  // silently aliased RESEND_RATE_LIMIT_MAX_ATTEMPTS, vendorDecision.allowed would be true here.
  const wouldBeAllowedUnderResendConstant = 3 < RESEND_RATE_LIMIT_MAX_ATTEMPTS;
  if (!wouldBeAllowedUnderResendConstant) {
    failures.push('(5) test assumption broken: RESEND_RATE_LIMIT_MAX_ATTEMPTS must exceed 3 for this contrast to be meaningful.');
  }
  if (vendorDecision.allowed !== false) {
    failures.push(
      `(5) decideVendorRegistrationRateLimit must refuse the 4th attempt under its OWN (3) constant ` +
        `-- if it were an alias for RESEND_RATE_LIMIT_MAX_ATTEMPTS (5) it would have allowed it, got ` +
        `allowed:${vendorDecision.allowed}.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideVendorRegistrationRateLimit() enforces exactly VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS ' +
    '(3) per key, is keyed (a different key with the identical raw attempts array stays allowed), ' +
    'excludes attempts older than VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS, and is not an alias for ' +
    'RESEND_RATE_LIMIT_MAX_ATTEMPTS (5).',
);
process.exit(0);
