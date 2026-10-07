#!/usr/bin/env node
// F3 (conference-workshop-tickets, M2) — DEPLOYED, LIVE proof of this feature's headline
// behaviour against the real beta.saoc.co.za origin: a day-visitor checkout for an
// EXCLUDED day (Thursday, 2027-09-23) is rejected SPECIFICALLY by the new excludedDays
// branch, and the SAME shaped request for an INCLUDED day (Friday, 2027-09-24) is
// accepted (201 for the fresh reservation this script always sends, a real bookingRef
// in the body) — not a dry-run of the pure helper
// (that's A24's job), a REAL POST against the real deployed checkout route, through the
// real beta Basic-auth wall.
//
// FIX (team-lead gate run, 2026-10-07): the first version of this script sent no
// Idempotency-Key header. Thursday's checkout then returned 400 for the WRONG reason —
// app/api/tickets/checkout/route.ts:76-77's own duplicate-POST-protection header check
// rejects any request missing a valid UUID Idempotency-Key before it ever reaches the
// excludedDays branch (route.ts:689) — so the "pass" was vacuous: a missing-header 400
// looks identical to an excludedDays 400 unless the body is actually checked. Fixed by
// (1) sending a fresh real UUID per request via node:crypto randomUUID() — each POST is
// a genuinely distinct idempotency key, never reused across Thursday/Friday or across
// runs, and (2) asserting Thursday's 400 body is EXACTLY
// { error: 'Day Pass is not available on this day.' } (route.ts:691, the excludedDays
// branch's own literal string) — not just "any 400".
//
// NOT the native `type: browser_deployed_check` triad kind: that kind's own
// `execution/browser_deployed_check.sh` performs an unparameterised, bodyless GET
// live-recheck and hard-fails on anything outside 2xx (see its own header comment) — it
// structurally cannot represent a POST request, let alone a 400 response, so routing this
// assertion through it would either misrepresent the check or require fabricating a 2xx
// result for what is genuinely a rejection. This is a documented harness-mechanism gap
// (file upstream per .claude/rules/athanor.md — this script does not try to route around
// it, it is a separate, honestly-labelled plain deployed check). This feature's triad
// `browser_deployed_check` coverage is instead the /tickets pricing-render assertion
// (A27), which IS a plain GET and fits the mechanism as designed.
//
// CREDENTIALS: BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD. Read from the environment
// first; if either is unset (e.g. the gate runs this without exported env — team-lead's
// 2026-10-07 run did exactly that), this script greps ONLY those two `KEY=value` lines
// out of .env.local itself (this project's own dotenv — reading it is allowed per
// .claude/rules/security.md) and never logs, echoes, or otherwise prints either value.
//
// Usage: node contracts/checks/conference-workshop-tickets-f3/check-deployed-thursday-rejected-friday-accepted.mjs [origin]
// Exit 0 = PASS, 1 = FAIL, 2 = usage/setup error.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');

const DEFAULT_ORIGIN = 'https://beta.saoc.co.za';
const NATIONAL_SHOW_ID = 'nationalShow';
const EXCLUDED_THURSDAY = '2027-09-23';
const INCLUDED_FRIDAY = '2027-09-24';
const EXCLUDED_DAYS_ERROR = 'Day Pass is not available on this day.';

function usageError(message) {
  console.error(`usage error: ${message}`);
  process.exit(2);
}

// Reads exactly one `KEY=value` line from .env.local, never the whole file into a
// variable that could be logged by accident — mirrors the posture of
// execution/env_keys.py (name + presence, never the value, except here we must actually
// use the value to build an Authorization header, so it stays in a local const and is
// never passed to console.log/error).
function readEnvLocalValue(key) {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!existsSync(envPath)) return undefined;
  const contents = readFileSync(envPath, 'utf8');
  for (const line of contents.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && match[1] === key) {
      // Strip a single layer of matching quotes, same convention dotenv itself uses.
      return match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return undefined;
}

function resolveCredential(envVarName) {
  return process.env[envVarName] ?? readEnvLocalValue(envVarName);
}

function sentinelEmail(tag) {
  // Same sentinel convention as this project's other live-deployed checks
  // (contracts/checks/ticketing-hardening/_shared.mjs's sentinelEmail) — a clearly-marked,
  // never-real address so a stray sandbox order is identifiable and never confused with a
  // real buyer's data.
  return `cwt-f3-deployed-${tag}-${Date.now()}@sentinel.inunu.net`;
}

async function postCheckout(origin, authorization, chosenDay) {
  const body = {
    showId: NATIONAL_SHOW_ID,
    lineItems: [
      {
        ticketType: 'day-visitor',
        attendeeName: 'Contract Check Sentinel',
        attendeeEmail: sentinelEmail(chosenDay),
        chosenDay,
      },
    ],
  };
  const res = await fetch(`${origin}/api/tickets/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      // A fresh UUID per request — route.ts:76-77 rejects any request missing a valid
      // UUID Idempotency-Key before the excludedDays branch ever runs, and reusing one
      // key across Thursday/Friday (or across repeated gate runs) would risk a stale
      // 409 "already reserved" instead of the behaviour under test.
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
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

  const failures = [];

  const thursday = await postCheckout(origin, authorization, EXCLUDED_THURSDAY);
  if (thursday.status !== 400) {
    failures.push(
      `Thursday (${EXCLUDED_THURSDAY}) day-visitor checkout returned ${thursday.status}, expected 400 — ` +
        `body: ${JSON.stringify(thursday.json)}`,
    );
  } else if (thursday.json?.error !== EXCLUDED_DAYS_ERROR) {
    failures.push(
      `Thursday (${EXCLUDED_THURSDAY}) returned 400 but NOT from the excludedDays branch — ` +
        `expected error ${JSON.stringify(EXCLUDED_DAYS_ERROR)}, got body: ${JSON.stringify(thursday.json)} ` +
        '(a 400 for a different reason, e.g. a missing/invalid Idempotency-Key, would make this assertion vacuous)',
    );
  }

  const friday = await postCheckout(origin, authorization, INCLUDED_FRIDAY);
  // route.ts:885-887's own contract: 201 for a FRESH reservation, 200 only for an
  // idempotent replay of an already-seen Idempotency-Key (comment at route.ts:885-886).
  // This script sends a brand-new randomUUID() per run (see postCheckout above), so the
  // correct expected status here is 201, not 200 — accepting either keeps this
  // assertion correct if a retry within the same process ever replayed a key, without
  // masking a genuine rejection status (4xx/5xx) either way.
  if (friday.status !== 200 && friday.status !== 201) {
    failures.push(
      `Friday (${INCLUDED_FRIDAY}) day-visitor checkout returned ${friday.status}, expected 201 (fresh ` +
        `reservation) or 200 (idempotent replay) — body: ${JSON.stringify(friday.json)}`,
    );
  } else if (!friday.json || typeof friday.json.bookingRef !== 'string' || friday.json.bookingRef.length === 0) {
    failures.push(`Friday (${INCLUDED_FRIDAY}) day-visitor checkout returned 200 but no real bookingRef — body: ${JSON.stringify(friday.json)}`);
  }

  if (failures.length > 0) {
    console.error('FAIL: check-deployed-thursday-rejected-friday-accepted.mjs');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `PASS: live POST against ${origin}/api/tickets/checkout — Thursday (${EXCLUDED_THURSDAY}) rejected 400 ` +
      `specifically via the excludedDays branch (${JSON.stringify(EXCLUDED_DAYS_ERROR)}), ` +
      `Friday (${INCLUDED_FRIDAY}) accepted ${friday.status} with a real bookingRef.`,
  );
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(2);
});
