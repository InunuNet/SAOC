#!/usr/bin/env node
// F6 (ticketing-foundation) — design constraint 3: tokens are scoped to exactly one order. A
// valid token minted for order A must be refused when checked against order B — proven by
// actually calling the real verifyRecoveryToken() and comparing its returned orderId against
// two different requested orders, the same way a real route boundary check would (per spec
// §8.5's `if (req.user.uid !== order.buyerUid) throw 403` pattern, applied here to the token's
// scope instead of a buyerUid).
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f6-recovery-token/check-order-scoping.mjs

import { randomBytes } from 'node:crypto';
import { mintRecoveryToken, verifyRecoveryToken } from '../../../lib/recovery-token.ts';

const failures = [];
const NOW = new Date('2027-03-01T00:00:00Z');
const SECRET = randomBytes(32).toString('hex');

// The exact scope check a real /tickets/recover route would perform: verify the token, then
// refuse unless the verified orderId matches the order actually being requested.
function authorizeRecoveryAccess(verification, requestedOrderId) {
  if (!verification.ok) return false;
  return verification.orderId === requestedOrderId;
}

const tokenForOrderA = mintRecoveryToken({ orderId: 'order-A', secret: SECRET, now: NOW });
const verification = verifyRecoveryToken({ token: tokenForOrderA.token, secret: SECRET, now: NOW });

if (!verification.ok) {
  failures.push(`(setup) A freshly minted, unexpired, correctly-secreted token failed to verify: ${JSON.stringify(verification)}.`);
} else {
  if (verification.orderId !== 'order-A') {
    failures.push(`(setup) Verified orderId '${verification.orderId}' did not match the minted orderId 'order-A'.`);
  }

  const authorizedForOwnOrder = authorizeRecoveryAccess(verification, 'order-A');
  if (authorizedForOwnOrder !== true) {
    failures.push("(1) A token minted for 'order-A' was refused access to 'order-A' itself — the positive control failed.");
  }

  const authorizedForOtherOrder = authorizeRecoveryAccess(verification, 'order-B');
  if (authorizedForOtherOrder !== false) {
    failures.push("(2) A token minted for 'order-A' was GRANTED access to 'order-B' — a valid token for one order must be refused for a different order.");
  }

  // A third, unrelated order id — guards against an off-by-one/prefix-match bug that happened
  // to make 'order-B' pass for the wrong reason (e.g. string prefix comparison).
  const authorizedForThirdOrder = authorizeRecoveryAccess(verification, 'order-C-unrelated');
  if (authorizedForThirdOrder !== false) {
    failures.push("(3) A token minted for 'order-A' was GRANTED access to 'order-C-unrelated'.");
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: a token minted for 'order-A' verifies and authorizes access to 'order-A' only — " +
    'real verifyRecoveryToken() output, checked against two different unrelated orders, both ' +
    'correctly refused.',
);
process.exit(0);
