#!/usr/bin/env node
// F3 (conference-workshop-tickets, M2) — ONE-OFF MANUAL HELPER for producing A30's gws
// inbox-check manifest. NEVER part of the automated gate — no contract assertion calls
// this script, and it must not be added as one.
//
// WHY A SEPARATE SCRIPT FROM A29
// A29 (check-payfast-sandbox-e2e-day-visitor.mjs) uses a sentinel email
// (shared.sentinelEmail(), the `...@sentinel.inunu.net` convention) and is swept clean
// by withCleanup() every run — that's correct and must stay that way, since A29 runs
// automatically on every gate pass and a sentinel address is what makes that safe
// (contracts/checks/ticketing-hardening/_shared.mjs's sweepSentinels() finds and deletes
// it by domain match). But `gws` only reads a REAL inbox (brad@inunu.net — see
// .agent/memory/scratch or project memory "gws CLI reads Brad's email read-only"), so a
// sentinel-addressed order's confirmation email is never readable by gws at all. A30
// therefore needs its OWN real purchase, made once, by hand, with a real address — not
// A29's automated sentinel run repurposed. This script is that one-off purchase, built
// on the exact same live-POST shape as A28's script (same Idempotency-Key-header
// requirement, same checkout body shape) but:
//   - uses a FIXED included day (Friday, 2027-09-24) — proving the ACCEPTED-day path,
//     the fact A30 exists to protect, same as A29;
//   - sends attendeeEmail: 'brad@inunu.net' (real, readable) instead of a sentinel;
//   - is NEVER run automatically and performs NO cleanup — the resulting order is a real,
//     deliberately-kept artefact, read once via gws, then left as an ordinary real ticket
//     sale (not deleted — this project's convention is "never delete a sandbox/produced
//     artefact casually"; a stray R150 sandbox-gateway day-visitor order is immaterial and
//     the PayFast/Ozow side is already sandbox-mode, see the live response's "IsTest":"true").
//
// USAGE (run by hand, exactly once, whenever A30's manifest needs (re)producing):
//   node contracts/checks/conference-workshop-tickets-f3/produce-a30-source-purchase.mjs [origin]
// Prints the resulting bookingRef. After running:
//   1. Wait for the confirmation email to arrive at brad@inunu.net (Resend -> gws-readable
//      inbox — not instant; may take up to a few minutes).
//   2. Find it: gws mail search "bookingRef <the one just printed>" (or search by subject/
//      recent arrival — see reference_gws_cli_email_readonly in project memory).
//   3. Read it: gws mail read <message_id>.
//   4. Write the manifest at
//      .agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures/f3-a30-confirmation-email-manifest.json
//      in the shape .agent/memory/project/specs/verification-triad-gate/goldens/fixtures/gws_manifest_good.json
//      uses: {gws_subcommand, message_id, subject, from, recipient, timestamp,
//      content_sha256, outcome, notes}. `recipient` must be brad@inunu.net (what this
//      script actually sent) and `timestamp` must be within gws_inbox_check.sh's 4h
//      freshness window at the moment A30 is gated, so this step must happen close to
//      gate time, not once and reused indefinitely.
//
// CREDENTIALS: same as check-deployed-thursday-rejected-friday-accepted.mjs — reads
// BETA_BASIC_AUTH_USER/PASSWORD from the environment, falling back to .env.local, never
// printed.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');

const DEFAULT_ORIGIN = 'https://beta.saoc.co.za';
const NATIONAL_SHOW_ID = 'nationalShow';
const INCLUDED_FRIDAY = '2027-09-24';
const REAL_READABLE_RECIPIENT = 'brad@inunu.net';

function usageError(message) {
  console.error(`usage error: ${message}`);
  process.exit(2);
}

function readEnvLocalValue(key) {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!existsSync(envPath)) return undefined;
  const contents = readFileSync(envPath, 'utf8');
  for (const line of contents.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && match[1] === key) {
      return match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return undefined;
}

function resolveCredential(envVarName) {
  return process.env[envVarName] ?? readEnvLocalValue(envVarName);
}

async function main() {
  const origin = (process.argv[2] ?? DEFAULT_ORIGIN).replace(/\/$/, '');
  const user = resolveCredential('BETA_BASIC_AUTH_USER');
  const password = resolveCredential('BETA_BASIC_AUTH_PASSWORD');
  if (!user || !password) {
    usageError(
      'BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD not found in the environment or .env.local',
    );
  }
  const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

  const body = {
    showId: NATIONAL_SHOW_ID,
    lineItems: [
      {
        ticketType: 'day-visitor',
        attendeeName: 'Brad (A30 manifest source purchase)',
        attendeeEmail: REAL_READABLE_RECIPIENT,
        chosenDay: INCLUDED_FRIDAY,
      },
    ],
  };
  const res = await fetch(`${origin}/api/tickets/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);

  if (res.status !== 200 && res.status !== 201) {
    console.error(`FAIL: checkout returned ${res.status}, expected 200/201 — body: ${JSON.stringify(json)}`);
    process.exit(1);
  }
  if (!json || typeof json.bookingRef !== 'string' || json.bookingRef.length === 0) {
    console.error(`FAIL: checkout returned ${res.status} but no bookingRef — body: ${JSON.stringify(json)}`);
    process.exit(1);
  }

  console.log(`Purchase created: bookingRef=${json.bookingRef}, recipient=${REAL_READABLE_RECIPIENT}`);
  console.log('Next: wait for the confirmation email, then run `gws mail search`/`gws mail read` ' +
    'per this script\'s own header comment to produce f3-a30-confirmation-email-manifest.json.');
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(2);
});
