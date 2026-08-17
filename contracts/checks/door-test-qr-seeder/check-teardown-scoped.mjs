// A4 — `pnpm door:teardown` deletes exactly the three fixture docs (re-query by each
// exact bookingRef returns null afterward) and does NOT delete an unrelated control
// document planted with its own distinct marker — proving teardown matches an exact
// bookingRef set, not a marker-domain sweep or a collection-wide delete.

import {
  assert,
  db,
  deleteTicketByBookingRef,
  readTicketByBookingRef,
  runDoorSeedCli,
  runDoorTeardownCli,
  TICKETS_COLLECTION,
} from './_shared.mjs';

const CONTROL_BOOKING_REF = 'DOOR-QR-CHECK-TEARDOWN-CONTROL-01';

async function plantControlDoc() {
  const ref = await db()
    .collection(TICKETS_COLLECTION)
    .add({
      bookingRef: CONTROL_BOOKING_REF,
      showId: 'nationalShow',
      attendeeName: 'Teardown Control',
      attendeeEmail: 'control@door-qr-check-teardown-control.invalid',
      ticketType: 'exhibitor',
      status: 'paid',
      amount: 0,
      purchasedAt: null,
      checkedInAt: null,
      m_payment_id: CONTROL_BOOKING_REF,
      pf_payment_id: null,
    });
  return ref.id;
}

async function main() {
  try {
    runDoorTeardownCli();
  } catch {
    // fine if nothing existed yet
  }

  await plantControlDoc();

  runDoorSeedCli();

  const admitBefore = await readTicketByBookingRef('DOOR-QR-ADMIT-01');
  assert(admitBefore !== null, 'precondition: seed did not create the ADMIT fixture');

  runDoorTeardownCli();

  const admitAfter = await readTicketByBookingRef('DOOR-QR-ADMIT-01');
  const unpaidAfter = await readTicketByBookingRef('DOOR-QR-UNPAID-01');
  const wrongshowAfter = await readTicketByBookingRef('DOOR-QR-WRONGSHOW-01');
  assert(admitAfter === null, 'teardown left DOOR-QR-ADMIT-01 behind');
  assert(unpaidAfter === null, 'teardown left DOOR-QR-UNPAID-01 behind');
  assert(wrongshowAfter === null, 'teardown left DOOR-QR-WRONGSHOW-01 behind');

  const controlAfter = await readTicketByBookingRef(CONTROL_BOOKING_REF);
  assert(
    controlAfter !== null,
    'teardown deleted the unrelated control document — it is scoped wider than the exact three fixture bookingRefs',
  );

  console.log('PASS: A4 pnpm door:teardown deletes exactly the three fixture docs, leaves the control doc untouched');
}

main()
  .catch((err) => {
    console.error(`FAIL: A4 — ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await deleteTicketByBookingRef(CONTROL_BOOKING_REF);
    await deleteTicketByBookingRef('DOOR-QR-ADMIT-01');
    await deleteTicketByBookingRef('DOOR-QR-UNPAID-01');
    await deleteTicketByBookingRef('DOOR-QR-WRONGSHOW-01');
  });
