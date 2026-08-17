/**
 * Fictional Test Show — READ-ONLY cleanup-reporting script. No `--apply` flag exists on this
 * script; it has no code path capable of writing or deleting anything, ever, in either Sanity
 * or Firestore. Deletion of any Firestore or Sanity document is Brad's decision alone — this
 * script enumerates what he could choose to delete; it never deletes anything itself. See
 * contracts/golden/fictional-test-show/README.md, "What this contract does NOT prove", and
 * .claude/rules/scope.md-adjacent project-wide deletion prohibition.
 *
 * Fetches the fictional show's Sanity documents (by isFictionalTestShowDoc() /
 * isFictionalTestShowTicketTypeDoc()), every Firestore `tickets` (position), `orders`, and
 * `checkinAttempts` document, feeds them to classifyFictionalTestShowArtifacts()
 * (lib/fictional-test-show-recoverability.ts), and prints a report: every matched document's
 * collection, id, and one or two identifying fields, plus a total count per collection.
 *
 * NOT gated by any assertion — its pure classification core is what A8 gates instead; wiring
 * it to real credentialed reads is deliberately outside this contract's offline-only gate.
 *
 * Required env (read directly from .env.local, matching scripts/seed-demo-ticket-type.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN
 *   FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY
 *     (via lib/firebase-admin.ts's initAdmin())
 *
 * Run with: node --import tsx/esm scripts/report-fictional-test-show-artifacts.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '../lib/firebase-admin';
import { ORDERS_COLLECTION } from '../lib/orders';
import { CHECKIN_ATTEMPTS_COLLECTION } from '../lib/checkin-audit';
import {
  isFictionalTestShowDoc,
  isFictionalTestShowTicketTypeDoc,
  type FictionalShowMarkerFields,
  type FictionalShowTicketTypeMarkerFields,
} from '../lib/fictional-test-show';
import {
  classifyFictionalTestShowArtifacts,
  type RecoverableCheckinAttempt,
  type RecoverableOrder,
  type RecoverablePosition,
} from '../lib/fictional-test-show-recoverability';

// Firestore positions live in the 'tickets' collection — kept as a local literal, matching
// lib/checkin.ts's own local TICKETS_COLLECTION const, since neither lib/orders.ts nor
// lib/checkin.ts exports it.
const TICKETS_COLLECTION = 'tickets';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local (see file header).
// ---------------------------------------------------------------------------

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = readEnvLocal();
const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
const token = env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, ' +
      'NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN'
  );
}

const sanityClient: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

async function fetchFictionalSanityDocs(): Promise<{
  shows: FictionalShowMarkerFields[];
  ticketTypes: FictionalShowTicketTypeMarkerFields[];
}> {
  const allShows = await sanityClient.fetch<FictionalShowMarkerFields[]>(
    `*[_type == "show"]{ _id, "slug": slug.current, fictionalTestData }`
  );
  const allTicketTypes = await sanityClient.fetch<FictionalShowTicketTypeMarkerFields[]>(
    `*[_type == "ticketType"]{ "slug": slug.current, show }`
  );
  return {
    shows: allShows.filter(isFictionalTestShowDoc),
    ticketTypes: allTicketTypes.filter(isFictionalTestShowTicketTypeDoc),
  };
}

async function fetchFirestoreArtifacts(): Promise<{
  positions: RecoverablePosition[];
  orders: RecoverableOrder[];
  checkinAttempts: RecoverableCheckinAttempt[];
}> {
  const db = getFirestore(initAdmin());

  const [positionsSnap, ordersSnap, checkinAttemptsSnap] = await Promise.all([
    db.collection(TICKETS_COLLECTION).get(),
    db.collection(ORDERS_COLLECTION).get(),
    db.collection(CHECKIN_ATTEMPTS_COLLECTION).get(),
  ]);

  const positions: RecoverablePosition[] = positionsSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      bookingRef: (data.bookingRef as string | undefined) ?? doc.id,
      ticketType: (data.ticketType as string | undefined) ?? null,
      orderId: (data.orderId as string | undefined) ?? null,
    };
  });

  const orders: RecoverableOrder[] = ordersSnap.docs.map((doc) => ({ id: doc.id }));

  const checkinAttempts: RecoverableCheckinAttempt[] = checkinAttemptsSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      bookingRef: (data.bookingRef as string | undefined) ?? null,
      orderId: (data.orderId as string | undefined) ?? null,
    };
  });

  return { positions, orders, checkinAttempts };
}

async function main(): Promise<void> {
  console.log(
    `Reporting fictional-test-show artifacts — READ-ONLY, no writes or deletes possible ` +
      `(Sanity dataset "${dataset}", project ${projectId}).`
  );

  const fictionalSanityDocs = await fetchFictionalSanityDocs();
  console.log(`\nSanity 'show' documents matching the fictional-show marker (${fictionalSanityDocs.shows.length}):`);
  for (const s of fictionalSanityDocs.shows) {
    console.log(`  - ${s._id} (slug: ${s.slug ?? 'null'})`);
  }
  console.log(
    `\nSanity 'ticketType' documents matching the fictional-show marker (${fictionalSanityDocs.ticketTypes.length}):`
  );
  for (const t of fictionalSanityDocs.ticketTypes) {
    console.log(`  - slug: ${t.slug ?? 'null'}, show._ref: ${t.show?._ref ?? 'null'}`);
  }

  const firestoreArtifacts = await fetchFirestoreArtifacts();
  const report = classifyFictionalTestShowArtifacts(firestoreArtifacts);

  console.log(`\nFirestore '${TICKETS_COLLECTION}' positions matching the fictional show (${report.positions.length}):`);
  for (const p of report.positions) {
    console.log(`  - bookingRef: ${p.bookingRef}, orderId: ${p.orderId ?? 'null'}`);
  }

  console.log(`\nFirestore '${ORDERS_COLLECTION}' orders matching the fictional show (${report.orders.length}):`);
  for (const o of report.orders) {
    console.log(`  - id: ${o.id}`);
  }

  console.log(
    `\nFirestore '${CHECKIN_ATTEMPTS_COLLECTION}' attempts matching the fictional show (${report.checkinAttempts.length}):`
  );
  for (const c of report.checkinAttempts) {
    console.log(`  - bookingRef: ${c.bookingRef ?? 'null'}, orderId: ${c.orderId ?? 'null'}`);
  }

  console.log(
    '\nThis report is read-only — it enumerates recoverable/cleanup-eligible artifacts only. ' +
      'Deleting any of them is a decision for Brad to make manually; this script cannot do it.'
  );
}

main().catch((err: unknown) => {
  console.error('Report failed:', err);
  process.exit(1);
});
