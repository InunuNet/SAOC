#!/usr/bin/env node
// F6 (ticketing-foundation) — design constraint 1: the recovery token must be signed with a
// server-only secret, never derivable from public order data. An attacker holding a FULL order
// document (id, email, amount, timestamps) must not be able to mint a valid token. This is a
// REAL forgery attempt: several plausible "derive the secret from public data" strategies are
// tried, each producing a token that must fail verification against the real, independently
// generated secret. No live Firebase, no network, no Firestore write.
//
// The secret used here is generated at runtime via crypto.randomBytes — never a hardcoded or
// committed value, and it does not resemble any real credential.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f6-recovery-token/check-forgery-resistance.mjs

import { createHash, randomBytes } from 'node:crypto';
import { mintRecoveryToken, verifyRecoveryToken } from '../../../lib/recovery-token.ts';

const failures = [];
const NOW = new Date('2027-03-01T00:00:00Z');

// The real, server-only secret. Never exposed to the "attacker" strategies below — those only
// ever see the public order fields.
const REAL_SECRET = randomBytes(32).toString('hex');

// A public order document — everything an attacker who intercepted or was sent the order (but
// NOT the server's secret) could plausibly see.
const PUBLIC_ORDER = {
  id: 'order-forgery-target',
  buyerEmail: 'buyer@example.com',
  amount: 45000,
  purchasedAt: '2027-02-14T09:30:00.000Z',
};

// Sanity control: the real secret genuinely produces a token that verifies. If this fails, the
// forgery-resistance assertions below are meaningless (they'd pass trivially if verification is
// broken outright).
{
  const real = mintRecoveryToken({ orderId: PUBLIC_ORDER.id, secret: REAL_SECRET, now: NOW });
  const result = verifyRecoveryToken({ token: real.token, secret: REAL_SECRET, now: NOW });
  if (!result.ok) {
    failures.push(`(control) A token minted with the REAL secret failed to verify against the REAL secret: ${JSON.stringify(result)}.`);
  } else if (result.orderId !== PUBLIC_ORDER.id) {
    failures.push(`(control) Verified orderId '${result.orderId}' did not match the minted orderId '${PUBLIC_ORDER.id}'.`);
  }
}

// Each strategy below is a plausible thing an attacker might try if they mistakenly believed the
// signing secret was derivable from data the order document itself exposes.
const guessedSecrets = {
  'order id as secret': PUBLIC_ORDER.id,
  'buyer email as secret': PUBLIC_ORDER.buyerEmail,
  'id + amount concatenation': `${PUBLIC_ORDER.id}:${PUBLIC_ORDER.amount}`,
  'sha256 of every public field concatenated': createHash('sha256')
    .update(`${PUBLIC_ORDER.id}${PUBLIC_ORDER.buyerEmail}${PUBLIC_ORDER.amount}${PUBLIC_ORDER.purchasedAt}`)
    .digest('hex'),
  'empty string': '',
};

for (const [label, guessedSecret] of Object.entries(guessedSecrets)) {
  // The attacker mints their OWN token, using only the guessed secret and the public orderId —
  // exactly what someone with the order document but not the real secret could construct.
  const forged = mintRecoveryToken({ orderId: PUBLIC_ORDER.id, secret: guessedSecret, now: NOW });

  // That forged token is then presented to the real verification path, which only ever knows
  // the REAL secret (the guessed secret is never passed to verify — the attacker doesn't have
  // it either; this simulates the server checking an attacker-submitted token).
  const result = verifyRecoveryToken({ token: forged.token, secret: REAL_SECRET, now: NOW });

  if (result.ok) {
    failures.push(`FORGERY SUCCEEDED using strategy '${label}': a token minted with a guessed secret verified against the real secret.`);
  } else if (result.reason !== 'bad-signature' && result.reason !== 'malformed') {
    failures.push(`(${label}) Unexpected refusal reason '${result.reason}', expected 'bad-signature' or 'malformed'.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a token minted with a REAL secret verifies correctly, and every plausible ' +
    '"derive the secret from public order data" forgery strategy (order id, buyer email, ' +
    'id+amount, a SHA-256 of every public field, the empty string) fails verification ' +
    'against the real secret.',
);
process.exit(0);
