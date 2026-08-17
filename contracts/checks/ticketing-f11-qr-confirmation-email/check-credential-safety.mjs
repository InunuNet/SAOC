#!/usr/bin/env node
// F11 (ticketing-foundation) — dispatch instructions: "No credential, passphrase, signature or
// recovery-token VALUE may reach gate output on pass or fail... a naive failure message would
// dump it." This check proves sendConfirmationEmail() itself never writes the recoveryToken's
// VALUE to console output (log/error/warn/info/debug) or into a thrown Error's message, on
// EITHER the success path or a failure path.
//
// Scope, stated precisely: this is about LOGS and thrown-error TEXT, not about the email
// content itself. The recovery token legitimately reaching the rendered email (inside the
// recovery URL, addressed only to the buyer's own inbox via Resend) is the FEATURE, not a leak
// — that is proven separately by A6 (buildRecoveryUrl) and A4 (the fan-out check, for a
// zero-position-free flow). This check only inspects what would land in gate/server logs.
//
// DEFEATING MUTATION this check kills: a stray `console.error('confirmation failed', input)` or
// `console.log(JSON.stringify(input))` diagnostic left in sendConfirmationEmail() (or a thrown
// `new Error(\`failed for token ${token}\`)`) — either would put a live recovery-token value
// into Cloud Logging, which this project treats as a credential-corruption-class incident (see
// the golden README's "Judgement calls" for the prior-incident context that makes this
// non-hypothetical).
//
// NOTE ON THE FIXTURE TOKEN: never a real minted token (no real secret is available offline
// anyway) — but held to the exact same "must not appear in output" standard regardless, so this
// check's own methodology matches what it is proving.
//
// Run as: npx tsx contracts/checks/ticketing-f11-qr-confirmation-email/check-credential-safety.mjs

import { sendConfirmationEmail } from '../../../lib/confirmation-email.ts';

const failures = [];
const FIXTURE_TOKEN = 'ZmFrZS1wYXlsb2FkLXNlZ21lbnQ.deadbeefcafefeed0011223344556677889900aabbccddeeff';

function stringifyArgs(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`;
      try {
        return typeof a === 'string' ? a : JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

async function withConsoleSpy(fn) {
  const captured = [];
  const methods = ['log', 'error', 'warn', 'info', 'debug'];
  const originals = {};
  for (const method of methods) {
    originals[method] = console[method];
    console[method] = (...args) => {
      captured.push(stringifyArgs(args));
    };
  }
  let thrown = null;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  } finally {
    for (const method of methods) console[method] = originals[method];
  }
  return { captured, thrown };
}

// (1) Success path — real fixture token, everything succeeds.
{
  const { captured } = await withConsoleSpy(() =>
    sendConfirmationEmail(
      {
        orderId: 'order-cred-safety-success',
        buyerEmail: 'buyer@example.test',
        buyerName: 'Buyer Person',
        recoveryToken: FIXTURE_TOKEN,
        positions: [{ bookingRef: 'SAOC-2027-CREDSAFE01', attendeeName: 'Attendee', ticketType: 'general-admission' }],
      },
      { mailer: { send: async () => {} } }
    )
  );
  const leaked = captured.some((line) => line.includes(FIXTURE_TOKEN));
  if (leaked) failures.push('(1) success path: the fixture recovery-token value appeared in console output.');
}

// (2) Failure path — QR generation throws mid-flight. The rejection AND any console output
// during the call must not contain the token value.
{
  const { captured, thrown } = await withConsoleSpy(() =>
    sendConfirmationEmail(
      {
        orderId: 'order-cred-safety-failure',
        buyerEmail: 'buyer@example.test',
        buyerName: 'Buyer Person',
        recoveryToken: FIXTURE_TOKEN,
        positions: [{ bookingRef: 'SAOC-2027-CREDSAFE02', attendeeName: 'Attendee', ticketType: 'general-admission' }],
      },
      {
        mailer: { send: async () => {} },
        generateQrDataUri: async () => {
          throw new Error('simulated QR generation failure');
        },
      }
    )
  );
  if (!thrown) {
    failures.push('(2) expected sendConfirmationEmail to reject when generateQrDataUri throws — see A8 for the dedicated propagation proof; this case exists here only as a vehicle to inspect failure-path logging.');
  } else {
    const thrownText = `${thrown.message ?? ''}\n${thrown.stack ?? ''}`;
    if (thrownText.includes(FIXTURE_TOKEN)) {
      failures.push('(2) failure path: the thrown error\'s message/stack contained the fixture recovery-token value.');
    }
  }
  const leaked = captured.some((line) => line.includes(FIXTURE_TOKEN));
  if (leaked) failures.push('(2) failure path: the fixture recovery-token value appeared in console output during a failed send.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: sendConfirmationEmail() never writes the recoveryToken value to console output or into ' +
    "a thrown error's message/stack, on either the success path or a QR-generation-failure path."
);
process.exit(0);
