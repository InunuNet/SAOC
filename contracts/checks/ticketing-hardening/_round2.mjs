// ticketing-hardening round 2 — helpers for the S1/S2/S3/S5 behavioural checks.
//
// Extends _shared.mjs rather than editing it: A1-A20 depend on that file's exact
// behaviour and this round must not perturb them.
//
// Two capabilities live here:
//   1. Seat fillers that control `expiresAt` explicitly, so a check can state whether a
//      hold is live or expired instead of relying on a default.
//   2. Ephemeral Sanity `ticketType` fixtures, so the capacity/price validation checks
//      can exercise a genuinely malformed document over the real HTTP route without
//      touching any of the five live ticket types other workstreams read.
//
// NEVER PRINT SECRETS. The Sanity write token is read from the environment and used as a
// bearer header; it is never logged, never echoed and never included in a failure
// message.

import { Timestamp } from 'firebase-admin/firestore';

import {
  db,
  NATIONAL_SHOW_ID,
  sentinelEmail,
  TICKETS_COLLECTION,
} from './_shared.mjs';

const SANITY_API_VERSION = 'v2024-01-01';

/** Matches lib/tickets-constants.ts RESERVATION_TTL_MINUTES. Kept in sync by A24. */
export const RESERVATION_TTL_MINUTES = 30;

/** Comfortably past any plausible clock skew between this process and Firestore. */
const LONG_AGO_MS = 24 * 60 * 60 * 1000;
const FAR_FUTURE_MS = 24 * 60 * 60 * 1000;

export function expiredAt() {
  return Timestamp.fromMillis(Date.now() - LONG_AGO_MS);
}

export function liveUntil() {
  return Timestamp.fromMillis(Date.now() + FAR_FUTURE_MS);
}

/**
 * Create `count` sentinel tickets with fully explicit status and expiry. Unlike
 * _shared.mjs fillReservedSeats, nothing here is left to a default — a check that means
 * "a live hold" must say so, or it is not testing what it claims.
 */
export async function fillSeats({ count, label, status = 'reserved', expiresAt, ticketType }) {
  const database = db();
  const type = ticketType ?? 'exhibitor';
  let created = 0;
  const refs = [];
  while (created < count) {
    const batch = database.batch();
    const size = Math.min(400, count - created);
    for (let i = 0; i < size; i += 1) {
      const doc = database.collection(TICKETS_COLLECTION).doc();
      const bookingRef = `HARDEN2-${label}-${created + i}`;
      batch.set(doc, {
        bookingRef,
        showId: NATIONAL_SHOW_ID,
        ticketType: type,
        attendeeName: 'Harden2 Filler',
        attendeeEmail: sentinelEmail(`f2-${label}-${created + i}`),
        status,
        amount: 0,
        purchasedAt: null,
        checkedInAt: null,
        m_payment_id: bookingRef,
        pf_payment_id: null,
        ...(expiresAt === undefined ? {} : { expiresAt }),
      });
      refs.push(doc);
      created += 1;
    }
    await batch.commit();
  }
  return refs;
}

/** Count sentinel-owned tickets of a type in a given set of statuses. */
export async function countTicketsOfType(ticketType, statuses = ['reserved', 'paid']) {
  const snap = await db()
    .collection(TICKETS_COLLECTION)
    .where('showId', '==', NATIONAL_SHOW_ID)
    .where('ticketType', '==', ticketType)
    .get();
  return snap.docs.filter((d) => statuses.includes(d.data()['status'])).length;
}

// ---------------------------------------------------------------------------
// Ephemeral Sanity ticketType fixtures
// ---------------------------------------------------------------------------

function sanityEnv() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_TOKEN;
  if (!projectId || !dataset) {
    throw new Error(
      'PRECONDITION: NEXT_PUBLIC_SANITY_PROJECT_ID / _DATASET missing from .env.local.'
    );
  }
  if (!token) {
    throw new Error(
      'PRECONDITION: SANITY_API_TOKEN missing from .env.local — this check must create and then delete a temporary ticketType document.'
    );
  }
  return { projectId, dataset, token };
}

async function mutate(mutations) {
  const { projectId, dataset, token } = sanityEnv();
  const res = await fetch(
    `https://${projectId}.api.sanity.io/${SANITY_API_VERSION}/data/mutate/${dataset}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mutations }),
    }
  );
  if (!res.ok) {
    // Status only — the response may echo the request, and the request carried the token.
    throw new Error(`Sanity mutate failed (HTTP ${res.status}).`);
  }
}

/**
 * Read a ticketType. `host: 'apicdn'` is the SAME CDN the app's client uses
 * (sanity/lib/client.ts sets useCdn: true) — that is what the checkout route will
 * actually see. `host: 'api'` is the uncached origin, i.e. the truth about the dataset.
 */
async function readTicketTypeDoc(slug, host) {
  const { projectId, dataset } = sanityEnv();
  const query = `*[_type=="ticketType" && slug.current=="${slug}" && active==true][0]{_id,price,capacity}`;
  const url = `https://${projectId}.${host}.sanity.io/${SANITY_API_VERSION}/data/query/${dataset}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity ${host} read failed (HTTP ${res.status}).`);
  const { result } = await res.json();
  return result ?? null;
}

// Sanity's CDN purges on mutation but its TTL is 60s, so a poll window of exactly 60s
// is a coin flip. 150s is comfortably past it.
const CDN_POLL_ATTEMPTS = 100;
const CDN_POLL_DELAY_MS = 1500;

async function waitForCdn(slug, predicate, what) {
  for (let i = 0; i < CDN_POLL_ATTEMPTS; i += 1) {
    if (predicate(await readTicketTypeDoc(slug, 'apicdn'))) return;
    await new Promise((resolve) => setTimeout(resolve, CDN_POLL_DELAY_MS));
  }
  // The residue that matters is DATASET residue. A stale CDN entry for a document the
  // origin no longer has expires on its own; a document still present at the origin is a
  // real leak into a dataset three other workstreams read, and must be loud.
  const atOrigin = await readTicketTypeDoc(slug, 'api');
  if (predicate(atOrigin)) {
    console.warn(
      `warning: Sanity CDN is still serving a stale entry for '${slug}' after ${what}; the origin is correct and the cached copy expires by TTL. No dataset residue.`
    );
    return;
  }
  throw new Error(
    `Sanity did not reflect ${what} for ticketType '${slug}' within ${(CDN_POLL_ATTEMPTS * CDN_POLL_DELAY_MS) / 1000}s, at the CDN OR at the origin. Check the dataset for a leftover 'harden2-check-*' document.`
  );
}

/**
 * Delete every `harden2-check-*` ticketType left in the dataset. Matches on the id
 * prefix this module owns, so it can never touch one of the five real ticket types.
 * Returns how many were removed.
 */
export async function sweepEphemeralTicketTypes() {
  const { projectId, dataset } = sanityEnv();
  // Age filter, not just the id prefix: A29 and A31 share this module, and an unfiltered
  // sweep run by one would delete the other's LIVE fixture if the two were ever run
  // concurrently. No fixture lives longer than ~6 minutes (CDN TTL x 2 waits), so
  // anything older than 15 is certainly orphaned.
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const query = `*[_type=="ticketType" && _id match "harden2-check-*" && _updatedAt < "${cutoff}"]{_id}`;
  const url = `https://${projectId}.api.sanity.io/${SANITY_API_VERSION}/data/query/${dataset}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity residue read failed (HTTP ${res.status}).`);
  const { result } = await res.json();
  const doomed = result ?? [];
  if (doomed.length === 0) return 0;
  console.log(
    `cleanup: removing ${doomed.length} leaked ticketType fixture(s) from an earlier interrupted run`
  );
  await mutate(doomed.map((doc) => ({ delete: { id: doc._id } })));
  return doomed.length;
}

/**
 * Create a temporary ticketType, wait until the checkout route can actually see it, run
 * `body`, then delete it and wait until it is gone. `active: true` is mandatory —
 * ticketTypeBySlugQuery filters on it — which means the type is briefly visible on
 * /tickets. It is named so that no human could mistake it for a real product, and the
 * window is the same one A6's capacity fill already opens.
 */
export async function withEphemeralTicketType({ slug, price, capacity }, body) {
  const id = `harden2-check-${slug}`;
  // Sweep first, exactly as every mutating check calls sweepSentinels() before it starts.
  // The finally below is not enough on its own: contract.py runs each assertion under
  // subprocess.run(timeout=...), which KILLS this process on timeout, and a killed
  // process never unwinds its finally blocks. That happened on 2026-08-12 — a 60s gate
  // timeout left `harden2-check-harden2-cap-absent` (active: true, "ZZ DO NOT SELL")
  // live in the dataset, visible on /tickets, until it was found by a manual residue
  // check. A leaked fixture must self-heal on the next run rather than wait to be
  // noticed.
  await sweepEphemeralTicketTypes();
  const doc = {
    _id: id,
    _type: 'ticketType',
    name: 'ZZ DO NOT SELL — automated check',
    slug: { _type: 'slug', current: slug },
    description: 'Temporary fixture created by contracts/checks/ticketing-hardening. Safe to delete.',
    active: true,
    order: 999,
    ...(price === undefined ? {} : { price }),
    ...(capacity === undefined ? {} : { capacity }),
  };

  await mutate([{ createOrReplace: doc }]);
  try {
    await waitForCdn(slug, (result) => result?._id === id, 'creation');
    await body();
  } finally {
    await mutate([{ delete: { id } }]);
    await waitForCdn(slug, (result) => result === null, 'deletion');
  }
}

/**
 * Slug of some active ticketType that is NOT the suite's target type. Used by the
 * idempotency-binding check to replay a key with a different product. Read live rather
 * than hardcoded so a Studio rename cannot turn the check into a silent no-op.
 */
export async function otherActiveTicketTypeSlug(exclude = 'exhibitor') {
  const { projectId, dataset } = sanityEnv();
  const query = `*[_type=="ticketType" && active==true && slug.current!="${exclude}"][0].slug.current`;
  const url = `https://${projectId}.apicdn.sanity.io/${SANITY_API_VERSION}/data/query/${dataset}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity read failed (HTTP ${res.status}).`);
  const { result } = await res.json();
  if (!result) {
    throw new Error(
      `PRECONDITION: no second active ticketType exists in Sanity besides '${exclude}' — this check needs two products to replay one key across.`
    );
  }
  return result;
}
