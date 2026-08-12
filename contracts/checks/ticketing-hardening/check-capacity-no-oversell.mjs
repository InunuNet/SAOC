// A6 — the capacity gate holds under concurrency. Fills the target ticket type to
// capacity-1 with real Firestore reservations, then fires CONCURRENT checkout POSTs at
// the last remaining seat. Exactly one may succeed; the held count must never exceed
// capacity.
//
// This reproduces the exact defect @qa found (49/50 + 5 concurrent POSTs -> 5x 201,
// ending at 54/50). It is a real race against the running server, not a source grep —
// a grep for "capacity" passes today and the route still oversells.
//
// Blast radius: for the ~30s this runs, the target type reads as sold out on the public
// /tickets page. The dataset is pre-production, and the seats are not merely swept —
// afterCleanup below polls the held count back down to the baseline this check started
// from and fails loudly if it does not get there, so the next assertion can never
// inherit a full house from this one. (Round 2 made capacity count unexpired
// reservations too, which is what made an unverified release able to fail A7.)

import {
  assert,
  assertSalesOpen,
  countHeldSeats,
  fillReservedSeats,
  postCheckout,
  runId,
  sanityCapacity,
  sentinelEmail,
  sweepSentinels,
  TARGET_TICKET_TYPE,
  withCleanup,
} from './_shared.mjs';

const CONCURRENT_BUYERS = 5;
const RELEASE_POLL_ATTEMPTS = 12;
const RELEASE_POLL_DELAY_MS = 500;

/** Held count before any filler was written — the state the next assertion must inherit. */
let baselineHeld = null;

/**
 * Prove the seats came back. The sweep deletes the fixtures, but "deleted" and "no
 * longer counted against capacity" are two different claims and only the second one is
 * what the next check depends on, so measure the thing that matters.
 */
async function assertSeatsReleased() {
  if (baselineHeld === null) return; // never got as far as filling anything
  for (let attempt = 0; attempt < RELEASE_POLL_ATTEMPTS; attempt += 1) {
    if ((await countHeldSeats()) <= baselineHeld) return;
    await new Promise((resolve) => setTimeout(resolve, RELEASE_POLL_DELAY_MS));
  }
  throw new Error(
    `seats were NOT released: '${TARGET_TICKET_TYPE}' still holds ${await countHeldSeats()} seats against a baseline of ${baselineHeld}. Every following capacity assertion would fail for this reason and not its own.`
  );
}

await withCleanup(
  `A6 ${CONCURRENT_BUYERS} concurrent buyers for the last seat oversell by zero`,
  async () => {
    await assertSalesOpen();
    await sweepSentinels(); // start from a known-clean baseline

    const { capacity } = await sanityCapacity();
    const heldBefore = await countHeldSeats();
    assert(
      heldBefore < capacity,
      `PRECONDITION: '${TARGET_TICKET_TYPE}' is already at ${heldBefore}/${capacity} from REAL tickets — this check cannot run without deleting real data. Pick another type or clear the collection.`
    );

    baselineHeld = heldBefore;
    const id = runId();
    await fillReservedSeats(capacity - heldBefore - 1, id);
    const held = await countHeldSeats();
    assert(
      held === capacity - 1,
      `setup failed: expected exactly one free seat (${capacity - 1} held), got ${held}`
    );

    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_BUYERS }, (_unused, i) =>
        postCheckout({ email: sentinelEmail(`race-${id}-${i}`) })
      )
    );
    const accepted = responses.filter((r) => r.status === 201).length;
    const refused = responses.filter((r) => r.status === 409).length;

    const heldAfter = await countHeldSeats();
    assert(
      heldAfter <= capacity,
      `OVERSOLD: ${heldAfter} seats held against a capacity of ${capacity} (${accepted} of ${CONCURRENT_BUYERS} concurrent POSTs were accepted)`
    );
    assert(
      accepted === 1,
      `expected exactly 1 of ${CONCURRENT_BUYERS} concurrent POSTs to be accepted, got ${accepted} (statuses: ${responses.map((r) => r.status).join(',')})`
    );
    assert(
      refused === CONCURRENT_BUYERS - 1,
      `expected the other ${CONCURRENT_BUYERS - 1} to be refused with 409 sold-out, got statuses ${responses.map((r) => r.status).join(',')}`
    );
  },
  { afterCleanup: assertSeatsReleased }
);
