// d6-door-checkin — shared helpers. Reuses admin-auth-hardening's isolated built-server
// lifecycle, HTTP helpers, and fixture-user helpers directly (same server-ctl.sh, same
// http://127.0.0.1:3400 target, same .env.local loading) rather than duplicating them —
// see contracts/checks/admin-auth-hardening/_shared.mjs. This file adds only what D6
// needs on top: a REAL ticket fixture in Firestore, and a way to mint a genuinely valid
// Firebase session cookie for a user who is authenticated but NOT admin — bypassing the
// app's own /api/admin/session route on purpose, so the checkin route's OWN admin-claim
// check (app/api/admin/checkin/route.ts -> lib/admin-auth.ts getAdminSession) is proved
// in isolation from the session-mint route's independent enforcement of the same rule.
// Without this, a regression that removed the claim check from the checkin route alone
// would go undetected as long as the session-mint route still enforced it, because no
// non-admin caller could otherwise ever hold a syntactically valid session cookie to test
// with.

import { randomBytes } from 'node:crypto';

export {
  BASE_URL,
  loadEnvOrFail,
  postSession,
  getAdminPage,
  getTicketsApi,
  postCheckinApi,
  warmUp,
  runCheck,
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  PreconditionError,
} from '../admin-auth-hardening/_shared.mjs';

const SENTINEL_EMAIL_DOMAIN = 'd6-door-checkin-check.invalid';
export const NATIONAL_SHOW_ID = 'nationalShow';
export const TICKETS_COLLECTION = 'tickets';

export function runId() {
  return randomBytes(4).toString('hex');
}

export function sentinelEmail(label) {
  return `${label}@${SENTINEL_EMAIL_DOMAIN}`;
}

function isSentinelEmail(value) {
  return typeof value === 'string' && value.toLowerCase().endsWith(`@${SENTINEL_EMAIL_DOMAIN}`);
}

let adminAppPromise;

async function getAdminApp() {
  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { loadEnvOrFail } = await import('../admin-auth-hardening/_shared.mjs');
      const projectId = loadEnvOrFail('FIREBASE_ADMIN_PROJECT_ID');
      const clientEmail = loadEnvOrFail('FIREBASE_ADMIN_CLIENT_EMAIL');
      const privateKey = loadEnvOrFail('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');
      return (
        getApps().find((a) => a.name === 'd6-door-checkin-check') ??
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'd6-door-checkin-check')
      );
    })();
  }
  return adminAppPromise;
}

async function db() {
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore(await getAdminApp());
}

/** Create a real 'paid' ticket fixture for the national show. Always sentinel-marked. */
export async function createPaidTicketFixture(bookingRef) {
  const database = await db();
  const ref = await database.collection(TICKETS_COLLECTION).add({
    bookingRef,
    showId: NATIONAL_SHOW_ID,
    attendeeName: 'D6 Door Checkin Check',
    attendeeEmail: sentinelEmail(`fixture-${bookingRef}`),
    ticketType: 'visitor',
    status: 'paid',
    amount: 0,
    purchasedAt: null,
    checkedInAt: null,
    m_payment_id: bookingRef,
    pf_payment_id: null,
  });
  return ref.id;
}

export async function readTicketByBookingRef(bookingRef) {
  const database = await db();
  const snap = await database
    .collection(TICKETS_COLLECTION)
    .where('bookingRef', '==', bookingRef)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function deleteTicketFixture(bookingRef) {
  const database = await db();
  const snap = await database
    .collection(TICKETS_COLLECTION)
    .where('bookingRef', '==', bookingRef)
    .limit(1)
    .get();
  if (snap.empty) return;
  await snap.docs[0].ref.delete();
}

/**
 * Creates a real, verified, NON-admin Firebase Auth user (no custom claims at all — the
 * shape of an ordinary signed-in, verified account, e.g. a committee member who is not a
 * door admin) and mints a GENUINELY VALID session cookie for it by calling
 * createSessionCookie() directly via the Admin SDK — the same call
 * app/api/admin/session/route.ts makes, but WITHOUT going through that route's own
 * isAdminToken() gate. verifySessionCookie() (what lib/admin-auth.ts calls) will accept
 * this cookie without error; only the admin-claim check inside getAdminSession() can
 * refuse it. This is what proves D6-11 rather than merely re-proving the session route's
 * own gate a second time.
 */
export async function mintNonAdminSessionCookie(email) {
  const { getAuth } = await import('firebase-admin/auth');
  const auth = getAuth(await getAdminApp());
  const { exchangeCustomToken } = await import('../admin-auth-hardening/_shared.mjs');
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, emailVerified: true, password: randomBytes(24).toString('base64url') });
  }
  await auth.updateUser(user.uid, { emailVerified: true });
  await auth.setCustomUserClaims(user.uid, null); // explicitly NO admin claim
  const customToken = await auth.createCustomToken(user.uid);
  const idToken = await exchangeCustomToken(customToken);
  const SESSION_DURATION_MS = 60 * 60 * 24 * 5 * 1000;
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
  return { uid: user.uid, cookie: `session=${sessionCookie}` };
}

export async function deleteAuthUserByEmail(email) {
  const { getAuth } = await import('firebase-admin/auth');
  const auth = getAuth(await getAdminApp());
  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
  } catch {
    // already gone — fine, this is cleanup.
  }
}

export function randomNonAdminFixtureEmail() {
  const rand = randomBytes(4).toString('hex');
  return `d6-door-checkin-check-nonadmin-${rand}@saoc-contract-check.invalid`;
}

export { isSentinelEmail };
