// door-test-qr-seeder — shared helpers for the F6 check scripts (A2-A5, A7).
//
// Env: populated from .env.local by hand via scripts/scan-firestore-residue.ts's
// readEnvLocal() (no `dotenv` package — its startup banner has corrupted an env value
// on this project before) directly into process.env, since lib/firebase-admin.ts's
// initAdmin() (used by lib/checkin.ts) reads only process.env.
//
// Firestore access here is direct Admin SDK, mirroring
// contracts/checks/ticketing-hardening/_shared.mjs's admin()/db() pattern.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { readEnvLocal } from '../../../scripts/scan-firestore-residue.ts';

export const TICKETS_COLLECTION = 'tickets';
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let envLoaded = false;

/** Populate process.env from .env.local, once, without overwriting real CI secrets. */
export function loadEnv() {
  if (envLoaded) return;
  const envLocal = readEnvLocal();
  for (const [key, value] of Object.entries(envLocal)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  envLoaded = true;
}

let adminApp;

function admin() {
  loadEnv();
  if (!adminApp) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase admin credentials missing from .env.local (FIREBASE_ADMIN_PROJECT_ID / ' +
          '_CLIENT_EMAIL / _PRIVATE_KEY). Cannot run this check.',
      );
    }
    adminApp = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return adminApp;
}

export function db() {
  return getFirestore(admin());
}

export async function readTicketByBookingRef(bookingRef) {
  const snap = await db()
    .collection(TICKETS_COLLECTION)
    .where('bookingRef', '==', bookingRef)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function deleteTicketByBookingRef(bookingRef) {
  const snap = await db()
    .collection(TICKETS_COLLECTION)
    .where('bookingRef', '==', bookingRef)
    .limit(1)
    .get();
  if (!snap.empty) {
    await snap.docs[0].ref.delete();
  }
}

/** Runs the real npm script as a child process, proving the wiring in package.json works. */
export function runDoorSeedCli() {
  execFileSync('pnpm', ['run', 'door:seed'], { cwd: PROJECT_ROOT, stdio: 'pipe' });
}

export function runDoorTeardownCli() {
  execFileSync('pnpm', ['run', 'door:teardown'], { cwd: PROJECT_ROOT, stdio: 'pipe' });
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
