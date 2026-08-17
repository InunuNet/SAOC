// A2 — `pnpm door:seed` writes exactly the three Firestore docs specified in
// fixtures.golden.json, with exact marker fields, does NOT write a doc for
// DOOR-QR-MISSING-01, and is idempotent: re-running seed resets ADMIT back to 'paid'
// after it has been flipped to 'checked-in'.

import {
  assert,
  db,
  deleteTicketByBookingRef,
  readTicketByBookingRef,
  runDoorSeedCli,
  runDoorTeardownCli,
  TICKETS_COLLECTION,
} from './_shared.mjs';

const MARKER_EMAIL = 'fixture@door-qr-check.invalid';
const MARKER_NAME = 'Door QR Fixture';

function assertDocShape(bookingRef, doc, expected) {
  assert(doc !== null, `${bookingRef}: expected a seeded Firestore doc, found none`);
  assert(doc.showId === expected.showId, `${bookingRef}.showId = ${doc.showId}, expected ${expected.showId}`);
  assert(doc.status === expected.status, `${bookingRef}.status = ${doc.status}, expected ${expected.status}`);
  assert(doc.attendeeEmail === MARKER_EMAIL, `${bookingRef}.attendeeEmail = ${doc.attendeeEmail}, expected marker`);
  assert(doc.attendeeName === MARKER_NAME, `${bookingRef}.attendeeName = ${doc.attendeeName}, expected marker`);
  assert(doc.ticketType === 'exhibitor', `${bookingRef}.ticketType = ${doc.ticketType}, expected exhibitor`);
  assert(doc.amount === 0, `${bookingRef}.amount = ${doc.amount}, expected 0`);
  assert(doc.m_payment_id === bookingRef, `${bookingRef}.m_payment_id = ${doc.m_payment_id}, expected ${bookingRef}`);
  assert(doc.pf_payment_id === null, `${bookingRef}.pf_payment_id = ${doc.pf_payment_id}, expected null`);
  if (expected.purchasedAtNonNull) {
    assert(doc.purchasedAt != null, `${bookingRef}.purchasedAt is null, expected non-null (SERVER_NOW)`);
  } else {
    assert(doc.purchasedAt === null, `${bookingRef}.purchasedAt = ${doc.purchasedAt}, expected null`);
  }
}

async function main() {
  try {
    runDoorTeardownCli(); // known clean starting state
  } catch {
    // fine if nothing existed yet
  }

  runDoorSeedCli();

  const admit = await readTicketByBookingRef('DOOR-QR-ADMIT-01');
  assertDocShape('DOOR-QR-ADMIT-01', admit, { showId: 'nationalShow', status: 'paid', purchasedAtNonNull: true });
  assert(admit.checkedInAt === null, `ADMIT.checkedInAt = ${admit.checkedInAt}, expected null on first seed`);

  const unpaid = await readTicketByBookingRef('DOOR-QR-UNPAID-01');
  assertDocShape('DOOR-QR-UNPAID-01', unpaid, { showId: 'nationalShow', status: 'reserved', purchasedAtNonNull: false });

  const wrongshow = await readTicketByBookingRef('DOOR-QR-WRONGSHOW-01');
  assertDocShape('DOOR-QR-WRONGSHOW-01', wrongshow, {
    showId: 'door-qr-check-wrong-show',
    status: 'paid',
    purchasedAtNonNull: true,
  });

  const missing = await readTicketByBookingRef('DOOR-QR-MISSING-01');
  assert(missing === null, 'DOOR-QR-MISSING-01: a doc was seeded, but this fixture must have NO Firestore doc');

  const docCountBefore = (
    await db().collection(TICKETS_COLLECTION).where('bookingRef', '==', 'DOOR-QR-ADMIT-01').get()
  ).size;
  assert(docCountBefore === 1, `expected exactly one ADMIT doc, found ${docCountBefore}`);

  // Simulate a real scan flipping ADMIT to checked-in, then prove re-seeding resets it.
  await db().collection(TICKETS_COLLECTION).doc(admit.id).update({ status: 'checked-in' });
  const flipped = await readTicketByBookingRef('DOOR-QR-ADMIT-01');
  assert(flipped.status === 'checked-in', 'precondition: manual flip to checked-in did not take');

  runDoorSeedCli(); // idempotent re-run

  const reseeded = await readTicketByBookingRef('DOOR-QR-ADMIT-01');
  assert(
    reseeded.status === 'paid',
    `after re-running door:seed, ADMIT.status = ${reseeded.status}, expected 'paid' (idempotent reset)`,
  );
  assert(reseeded.checkedInAt === null, `after re-seed, ADMIT.checkedInAt = ${reseeded.checkedInAt}, expected null`);

  console.log('PASS: A2 pnpm door:seed writes exactly the three fixture docs and is idempotent');
}

main()
  .catch((err) => {
    console.error(`FAIL: A2 — ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await deleteTicketByBookingRef('DOOR-QR-ADMIT-01');
    await deleteTicketByBookingRef('DOOR-QR-UNPAID-01');
    await deleteTicketByBookingRef('DOOR-QR-WRONGSHOW-01');
  });
