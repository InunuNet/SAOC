// ticketing-hardening: shared helpers for BEHAVIOURAL checks against the running dev
// server (default http://localhost:3333) and the real Firestore/Sanity backends.
//
// WHY BEHAVIOURAL, NOT GREP
// The previous session's contract produced three FALSE GREENS from source greps: a
// comment matched a substring, and a "sold out" string match passed while server-side
// capacity enforcement did not exist at all. Every security- or money-relevant claim in
// contracts/contract-ticketing-hardening.yaml is therefore proved by a real HTTP
// round-trip plus a Firestore read-back, never by reading source.
//
// CLEANUP IS STRUCTURAL (learned.md, 2026-08-06)
// Helpers THROW, never process.exit — process.exit does not unwind the stack, so any
// try/finally cleanup block up the stack is silently skipped. Every mutating check
// wraps its body in try/finally and calls sweepSentinels() in the finally, then
// assertNoResidue() to prove the world is clean. Everything this suite writes carries
// the SENTINEL_EMAIL_DOMAIN marker, so one sweep removes all of it regardless of which
// step failed.
//
// NEVER PRINT SECRETS. .env.local holds real credentials. Nothing here logs
// process.env, tokens, cookies, id tokens or PayFast keys — only booleans about them.

import {
  appendFileSync,
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { SENTINEL_DOMAINS } from '../_shared/sentinel-domains.mjs';

config({ path: new URL('../../../.env.local', import.meta.url).pathname, quiet: true });

export const BASE_URL = (process.env.CHECK_BASE_URL ?? 'http://localhost:3333').replace(/\/+$/, '');

/** Pinned nationalShow singleton id — must match lib/tickets-constants.ts. */
export const NATIONAL_SHOW_ID = 'nationalShow';

/**
 * Ticket type used by the capacity / idempotency round trips. 'exhibitor' is chosen
 * deliberately: price 0, so no check in this suite ever creates a non-zero-value
 * reservation, and its capacity (50) is small enough to fill quickly.
 */
export const TARGET_TICKET_TYPE = 'exhibitor';

/**
 * Every document and auth user this suite creates carries this domain in its email.
 * `.invalid` is reserved by RFC 2606 and can never be a real attendee address, so the
 * sweep can delete on this marker alone with no risk of touching real data.
 */
export const SENTINEL_EMAIL_DOMAIN = SENTINEL_DOMAINS[0];
export const ADMIN_TEST_UID = 'harden-check-admin';
export const ADMIN_TEST_EMAIL = `admin@${SENTINEL_EMAIL_DOMAIN}`;

export const TICKETS_COLLECTION = 'tickets';

export function runId() {
  return randomBytes(4).toString('hex');
}

export function sentinelEmail(label) {
  return `${label}@${SENTINEL_EMAIL_DOMAIN}`;
}

export function isSentinelEmail(value) {
  return typeof value === 'string' && value.toLowerCase().endsWith(`@${SENTINEL_EMAIL_DOMAIN}`);
}

let adminApp = null;

export function admin() {
  if (adminApp) return adminApp;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase admin credentials missing from .env.local (FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY). Cannot run behavioural checks.'
    );
  }
  adminApp =
    getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return adminApp;
}

export function db() {
  return getFirestore(admin());
}

// ---------------------------------------------------------------------------
// Firestore ticket helpers
// ---------------------------------------------------------------------------

/** Create a ticket document directly (fixture setup — bypasses the HTTP route on purpose). */
export async function createTicketDoc(fields) {
  if (!isSentinelEmail(fields.attendeeEmail)) {
    throw new Error('Refusing to create a ticket without the sentinel email marker.');
  }
  const ref = db().collection(TICKETS_COLLECTION).doc();
  // Manifest write happens BEFORE the Firestore write itself (see README "Point 2") —
  // a kill between the two just means the preflight sweep issues a harmless delete
  // against a document that was never created.
  recordFixtureCreated(TICKETS_COLLECTION, ref.id);
  await ref.set({
    showId: NATIONAL_SHOW_ID,
    ticketType: TARGET_TICKET_TYPE,
    attendeeName: 'Harden Check',
    status: 'reserved',
    amount: 0,
    purchasedAt: null,
    checkedInAt: null,
    pf_payment_id: null,
    ...fields,
    m_payment_id: fields.m_payment_id ?? fields.bookingRef ?? null,
  });
  return ref;
}

/** Create `count` reserved sentinel tickets in one batch (capacity filler). */
export async function fillReservedSeats(count, label) {
  const database = db();
  let created = 0;
  while (created < count) {
    const batch = database.batch();
    const size = Math.min(400, count - created);
    const refs = [];
    for (let i = 0; i < size; i += 1) {
      const ref = database.collection(TICKETS_COLLECTION).doc();
      refs.push(ref);
      // Manifest entries for the whole batch are recorded before the batch commit —
      // same "record before write" ordering as createTicketDoc, applied per-doc.
      recordFixtureCreated(TICKETS_COLLECTION, ref.id);
    }
    for (let i = 0; i < size; i += 1) {
      const bookingRef = `HARDEN-${label}-${created + i}`;
      batch.set(refs[i], {
        bookingRef,
        showId: NATIONAL_SHOW_ID,
        ticketType: TARGET_TICKET_TYPE,
        attendeeName: 'Harden Filler',
        attendeeEmail: sentinelEmail(`filler-${label}-${created + i}`),
        status: 'reserved',
        amount: 0,
        purchasedAt: null,
        checkedInAt: null,
        m_payment_id: bookingRef,
        pf_payment_id: null,
      });
    }
    await batch.commit();
    created += size;
  }
}

export async function readTicketByBookingRef(bookingRef) {
  const snap = await db()
    .collection(TICKETS_COLLECTION)
    .where('bookingRef', '==', bookingRef)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function readTicketById(id) {
  const doc = await db().collection(TICKETS_COLLECTION).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/** Count reserved + paid tickets for the target type — the same rule the app counts by. */
export async function countHeldSeats(ticketType = TARGET_TICKET_TYPE) {
  const snap = await db()
    .collection(TICKETS_COLLECTION)
    .where('showId', '==', NATIONAL_SHOW_ID)
    .where('ticketType', '==', ticketType)
    .get();
  return snap.docs.filter((d) => ['reserved', 'paid'].includes(d.data()['status'])).length;
}

/** Delete every ticket carrying the sentinel marker. Returns how many were removed. */
export async function sweepSentinels() {
  const database = db();
  const snap = await database.collection(TICKETS_COLLECTION).get();
  const doomed = snap.docs.filter((d) => isSentinelEmail(d.data()['attendeeEmail']));
  let removed = 0;
  while (removed < doomed.length) {
    const batch = database.batch();
    const slice = doomed.slice(removed, removed + 400);
    for (const doc of slice) batch.delete(doc.ref);
    await batch.commit();
    removed += slice.length;
  }
  return removed;
}

/**
 * Prove the sweep worked, and re-sweep what arrives late. Loud and distinctly
 * exit-coded if residue survives — residue in a real Firestore collection must never
 * look like an ordinary FAIL (learned.md, 2026-08-06). A check can fail while a
 * checkout POST is still in flight; the server then writes its reservation AFTER the
 * first sweep has already run, leaving residue that the original single-pass sweep
 * reported as clean. Poll for a few seconds, deleting anything that lands.
 */
export async function assertNoResidue({ attempts = 8, delayMs = 750 } = {}) {
  let left = [];
  for (let i = 0; i < attempts; i += 1) {
    const snap = await db().collection(TICKETS_COLLECTION).get();
    left = snap.docs.filter((d) => isSentinelEmail(d.data()['attendeeEmail']));
    if (left.length === 0 && i > 0) return true;
    if (left.length > 0) await sweepSentinels();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const finalSnap = await db().collection(TICKETS_COLLECTION).get();
  left = finalSnap.docs.filter((d) => isSentinelEmail(d.data()['attendeeEmail']));
  if (left.length > 0) {
    console.error(
      `\n!!! CLEANUP RESIDUE: ${left.length} sentinel ticket(s) remain in Firestore.` +
        `\n!!! Delete every tickets/* doc whose attendeeEmail ends @${SENTINEL_EMAIL_DOMAIN}.\n`
    );
    process.exitCode = 9;
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Crash-resilient cleanup manifest (F2 — see README "Point 2")
// ---------------------------------------------------------------------------
//
// WHY A MANIFEST, NOT JUST THE F1 TIMEOUT FIX
// F1 removes the *routine* trigger for a kill during normal operation, but does not make
// cleanup itself resilient to a kill from any OTHER cause (CI runner OOM, a future
// assertion's own bug, a manual Ctrl-C that races the signal handlers). Every doc a
// fixture write creates is recorded to this manifest SYNCHRONOUSLY, before the Firestore
// write is attempted — a write that has not returned before a kill cannot be trusted,
// only a synchronous one that has returned, can (same "helpers throw, never
// process.exit" discipline this file already documents, applied to disk I/O).
const MANIFEST_PATH = join(tmpdir(), 'saoc-ticketing-hardening-manifest.ndjson');

/** IDs recorded by THIS process during its current withCleanup() body — tracked in
 * memory so withCleanup() knows exactly which manifest entries are its own to clear once
 * assertNoResidue() confirms clean, without clearing entries a differently-timed
 * concurrent process may have just written. Reset at the start of each withCleanup() call. */
let currentRunRecordedIds = [];

/**
 * Append one NDJSON line recording a fixture doc this process is about to write, via
 * synchronous fs APIs (appendFileSync — NOT the promise-based fs.promises API). Call
 * this BEFORE the corresponding Firestore write, not after.
 */
export function recordFixtureCreated(collection, id) {
  const line = `${JSON.stringify({ collection, id, ts: Date.now() })}\n`;
  appendFileSync(MANIFEST_PATH, line, { encoding: 'utf8' });
  currentRunRecordedIds.push(id);
}

function readManifestEntries() {
  if (!existsSync(MANIFEST_PATH)) return [];
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  const entries = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // A partial/torn line from a write that raced a kill mid-append — skip it rather
      // than fail the whole sweep over one unrecoverable entry.
    }
  }
  return entries;
}

/**
 * Preflight sweep: deletes every doc a PRIOR run recorded but never confirmed cleaned,
 * then clears exactly those entries from the manifest (a run that got killed never got
 * to call clearManifestEntries() for its own IDs, so this sweep does it on that run's
 * behalf — otherwise the manifest would grow unboundedly across every future run
 * instead of ever going back to empty). Safe to call with an empty or missing manifest —
 * issues zero Firestore calls in that case (see the negative control in
 * check-manifest-survives-kill.mjs). Fine to no-op on a doc that no longer exists (the
 * manifest entry may predate the actual Firestore write completing). Returns the number
 * of entries swept.
 */
export async function sweepManifestFromPriorRun() {
  const entries = readManifestEntries();
  if (entries.length === 0) return 0;
  const database = db();
  const batch = database.batch();
  for (const entry of entries) {
    batch.delete(database.collection(entry.collection).doc(entry.id));
  }
  await batch.commit();
  clearManifestEntries(entries.map((entry) => entry.id));
  return entries.length;
}

/**
 * Removes only the given IDs from the manifest (rewrite, not raw truncate — an ID-scoped
 * interface stays correct even if a concurrent-but-lock-losing process's manifest write
 * ever landed mid-sweep, though under the existing suite lock this should not occur in
 * practice). Called only AFTER assertNoResidue() has confirmed clean — a kill between the
 * sweep and the clear just means the next preflight repeats a sweep on already-clean IDs,
 * a safe no-op, not a new failure mode.
 */
export function clearManifestEntries(ids) {
  const idSet = new Set(ids);
  const remaining = readManifestEntries().filter((entry) => !idSet.has(entry.id));
  const body = remaining.map((entry) => `${JSON.stringify(entry)}\n`).join('');
  writeFileSync(MANIFEST_PATH, body, { encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// Admin auth: real Firebase Auth user -> custom token -> ID token -> session cookie
// ---------------------------------------------------------------------------

async function ensureAdminUser() {
  const auth = getAuth(admin());
  try {
    await auth.getUser(ADMIN_TEST_UID);
  } catch {
    await auth.createUser({ uid: ADMIN_TEST_UID, email: ADMIN_TEST_EMAIL });
  }
  await auth.setCustomUserClaims(ADMIN_TEST_UID, { admin: true });
}

export async function deleteAdminUser() {
  try {
    await getAuth(admin()).deleteUser(ADMIN_TEST_UID);
  } catch {
    // already gone — nothing to clean
  }
}

/** Returns the raw `session` cookie value for an admin user. Never logged. */
export async function adminSessionCookie() {
  await ensureAdminUser();
  const customToken = await getAuth(admin()).createCustomToken(ADMIN_TEST_UID, { admin: true });
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing — cannot mint an ID token.');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    throw new Error(`Identity Toolkit rejected the custom token (HTTP ${res.status}).`);
  }
  const { idToken } = await res.json();
  const sessionRes = await fetch(`${BASE_URL}/api/admin/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!sessionRes.ok) {
    throw new Error(`/api/admin/session refused the ID token (HTTP ${sessionRes.status}).`);
  }
  const setCookie = sessionRes.headers.get('set-cookie') ?? '';
  const match = /session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error('/api/admin/session returned no session cookie.');
  return match[1];
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Render a response body for a failure message WITHOUT leaking credentials. The
 * checkout payload contains merchant_key and a signature; those must never reach a log,
 * a transcript or a CI record. Only field NAMES survive.
 */
export function safeBody(body) {
  if (!body || typeof body !== 'object') return String(body);
  const { fields, ...rest } = body;
  return JSON.stringify(fields ? { ...rest, fields: `<${Object.keys(fields).join(',')}>` } : rest);
}

export async function postCheckin(bookingRef, cookie) {
  const res = await fetch(`${BASE_URL}/api/admin/checkin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: `session=${cookie}` } : {}),
    },
    body: JSON.stringify({ bookingRef }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

export async function postCheckout({
  ticketType = TARGET_TICKET_TYPE,
  email,
  name = 'Harden Check',
  idempotencyKey,
  showId = NATIONAL_SHOW_ID,
} = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (idempotencyKey !== null) headers['Idempotency-Key'] = idempotencyKey ?? crypto.randomUUID();
  const res = await fetch(`${BASE_URL}/api/tickets/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ showId, ticketType, attendeeName: name, attendeeEmail: email }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/** Capacity for a ticket type, read from Sanity exactly as the checkout route reads it. */
export async function sanityCapacity(slug = TARGET_TICKET_TYPE) {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const query = `*[_type=="ticketType" && slug.current=="${slug}" && active==true][0]{capacity,price}`;
  const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity capacity read failed (HTTP ${res.status}).`);
  const { result } = await res.json();
  if (!result) throw new Error(`Ticket type '${slug}' not found or inactive in Sanity.`);
  return result;
}

export async function assertSalesOpen() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const query = '*[_id=="nationalShow"][0]{salesOpen}';
  const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const { result } = await res.json();
  if (result?.salesOpen !== true) {
    throw new Error(
      'PRECONDITION: nationalShow.salesOpen is not true — checkout would 403 for reasons unrelated to this check. Open sales in Studio, then re-run.'
    );
  }
}

/** Fail with a clear, cause-first message. Never process.exit from a helper. */
export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function pass(message) {
  console.log(`PASS: ${message}`);
}

export function readRepoFile(relativePath) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url).pathname, 'utf8');
}

// ---------------------------------------------------------------------------
// Suite mutual exclusion
// ---------------------------------------------------------------------------
//
// WHY A LOCK (measured 2026-08-12, A7 flake)
// sweepSentinels() deletes EVERY document carrying the sentinel domain, not just the
// ones the calling process wrote. Two processes running any two checks from this suite
// at the same time therefore delete each other's fixtures mid-flight. The observed
// symptom was A7 failing "no Firestore ticket was written for an accepted checkout"
// during a full gate run and passing on its own seconds later: the checkout HAD written
// its ticket, and another process's sweep removed it between the 201 and the read-back.
// Reproduced deliberately by running A7 against a competing sweep loop — same message,
// every time.
//
// A domain-wide sweep is the right cleanup rule (a crashed run must not leave paid-
// looking seats behind), so the concurrency is what gets fixed, not the sweep: every
// mutating check serialises on one advisory lock file, held for the whole body AND its
// cleanup. Stale locks from a killed process are stolen on a liveness check, so a hard
// kill can never wedge the gate.
const LOCK_PATH = join(tmpdir(), 'saoc-ticketing-hardening.lock');
const LOCK_POLL_MS = 250;
export const LOCK_WAIT_MS = 90_000; // was already a module-private const; now exported
const LOCK_STALE_MS = 600_000;

// See contracts/golden/payfast-m1-lock-cleanup-fix/README.md ("Decision on point 1") —
// any contract assertion whose command transitively imports this module must declare
// timeout_seconds >= MIN_ASSERTION_TIMEOUT_MS, so a full LOCK_WAIT_MS wait can complete
// and the script still has real network slack afterward. Do not shrink the margin to
// make an existing timeout_seconds value "just barely" pass — raise the timeout instead.
export const ASSERTION_TIMEOUT_SAFETY_MARGIN_MS = 30_000;
export const MIN_ASSERTION_TIMEOUT_MS = LOCK_WAIT_MS + ASSERTION_TIMEOUT_SAFETY_MARGIN_MS;

/** True once this process has run without exclusive ownership — failures then say so. */
let lockContended = false;
let holdingLock = false;

function readLockHolder() {
  try {
    return JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function holderIsGone(holder) {
  if (!holder || typeof holder.pid !== 'number') return true;
  if (Date.now() - (holder.startedAt ?? 0) > LOCK_STALE_MS) return true;
  try {
    process.kill(holder.pid, 0); // signal 0 tests liveness, sends nothing
    return false;
  } catch {
    return true;
  }
}

function tryTakeLock() {
  try {
    const fd = openSync(LOCK_PATH, 'wx');
    writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
    closeSync(fd);
    holdingLock = true;
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  if (!holdingLock) return;
  const holder = readLockHolder();
  if (holder && holder.pid !== process.pid) return; // stolen from us — not ours to remove
  try {
    unlinkSync(LOCK_PATH);
  } catch {
    // already gone
  }
  holdingLock = false;
}

process.on('exit', releaseLock);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    releaseLock();
    process.exit(130);
  });
}

/**
 * Acquire the suite lock, waiting for a live holder and stealing a dead one. Never
 * throws and never waits forever: if a live holder is still there after LOCK_WAIT_MS,
 * the check runs anyway (a wedged gate is worse than a contended one) and records the
 * contention so any subsequent failure is reported with its likely cause attached.
 */
async function acquireSuiteLock() {
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    if (tryTakeLock()) return;
    const holder = readLockHolder();
    if (holderIsGone(holder)) {
      try {
        unlinkSync(LOCK_PATH);
      } catch {
        // another waiter stole it first — loop and contend for it normally
      }
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  lockContended = true;
  const holder = readLockHolder();
  console.warn(
    `WARNING: another ticketing-hardening check (pid ${holder?.pid ?? 'unknown'}) has held the suite lock for over ${LOCK_WAIT_MS / 1000}s. Running anyway — its sweeps may delete this check's fixtures.`
  );
}

/**
 * Standard wrapper: take the suite lock, run `body`, always sweep, always prove the
 * sweep worked, and map the outcome to an exit code. Cleanup failures use exit 9 so
 * they are distinguishable from an ordinary assertion FAIL (exit 1).
 *
 * `afterCleanup` runs once the sweep has proved clean and is where a check verifies the
 * world it disturbed is back to its baseline before the next assertion starts.
 */
export async function withCleanup(name, body, { deleteUser = false, afterCleanup } = {}) {
  let failure = null;
  // Preflight: sweep any orphans a PRIOR run's kill left behind, before this run even
  // tries to take the lock — see README "Point 2" (a prior run's orphans must be
  // cleaned even if this run never manages to take the lock).
  const preflightSwept = await sweepManifestFromPriorRun();
  if (preflightSwept > 0) {
    console.log(`preflight: swept ${preflightSwept} manifest entr${preflightSwept === 1 ? 'y' : 'ies'} from a prior run`);
  }
  currentRunRecordedIds = [];
  await acquireSuiteLock();
  try {
    await body();
  } catch (error) {
    failure = error;
  } finally {
    try {
      const removed = await sweepSentinels();
      if (removed > 0) console.log(`cleanup: removed ${removed} sentinel ticket(s)`);
      if (deleteUser) await deleteAdminUser();
      await assertNoResidue();
      // Manifest entries are cleared only AFTER assertNoResidue() confirms clean — a
      // kill between the sweep and the clear just means the next preflight repeats a
      // sweep on already-clean IDs, a safe no-op, not a new failure mode.
      if (currentRunRecordedIds.length > 0) clearManifestEntries(currentRunRecordedIds);
      if (afterCleanup) await afterCleanup();
    } catch (cleanupError) {
      console.error(`!!! CLEANUP FAILED for ${name}:`, cleanupError.message);
      process.exitCode = 9;
    }
    releaseLock();
  }
  if (failure) {
    const contention = lockContended
      ? '\n  NOTE: this check ran while another ticketing-hardening process held the suite lock; a foreign sweep may have deleted its fixtures. Re-run it alone before treating this as a code defect.'
      : '';
    console.error(`FAIL: ${name}\n  ${failure.message}${contention}`);
    if (process.exitCode !== 9) process.exitCode = 1;
  } else if (process.exitCode !== 9) {
    pass(name);
  }
}
