// A3 — the full 5-outcome decision table, proven by calling checkInByBookingRef
// (lib/checkin.ts) directly against the seeded fixtures, in this exact order:
// ADMIT scan 1 (admit), ADMIT scan 2 (already-checked-in), UNPAID scan 1 (unpaid),
// WRONGSHOW scan 1 (wrong-show), MISSING scan 1 (not-found).

import { assert, deleteTicketByBookingRef, loadEnv, runDoorSeedCli, runDoorTeardownCli } from './_shared.mjs';

loadEnv();

async function main() {
  const { checkInByBookingRef } = await import('@/lib/checkin');

  try {
    runDoorTeardownCli();
  } catch {
    // fine if nothing existed yet
  }
  runDoorSeedCli();

  const admitScan1 = await checkInByBookingRef('DOOR-QR-ADMIT-01');
  assert(
    admitScan1.ok === true && admitScan1.ticket?.status === 'checked-in',
    `ADMIT scan 1: expected ok:true with ticket.status becoming 'checked-in', got ${JSON.stringify(admitScan1)}`,
  );

  const admitScan2 = await checkInByBookingRef('DOOR-QR-ADMIT-01');
  assert(
    admitScan2.ok === false && admitScan2.code === 'already-checked-in' && admitScan2.httpStatus === 409,
    `ADMIT scan 2: expected ok:false code:'already-checked-in' httpStatus:409, got ${JSON.stringify(admitScan2)}`,
  );

  const unpaidScan1 = await checkInByBookingRef('DOOR-QR-UNPAID-01');
  assert(
    unpaidScan1.ok === false && unpaidScan1.code === 'unpaid' && unpaidScan1.httpStatus === 403,
    `UNPAID scan 1: expected ok:false code:'unpaid' httpStatus:403, got ${JSON.stringify(unpaidScan1)}`,
  );

  const wrongShowScan1 = await checkInByBookingRef('DOOR-QR-WRONGSHOW-01');
  assert(
    wrongShowScan1.ok === false && wrongShowScan1.code === 'wrong-show' && wrongShowScan1.httpStatus === 403,
    `WRONGSHOW scan 1: expected ok:false code:'wrong-show' httpStatus:403, got ${JSON.stringify(wrongShowScan1)}`,
  );

  const missingScan1 = await checkInByBookingRef('DOOR-QR-MISSING-01');
  assert(
    missingScan1.ok === false && missingScan1.code === 'not-found' && missingScan1.httpStatus === 404,
    `MISSING scan 1: expected ok:false code:'not-found' httpStatus:404, got ${JSON.stringify(missingScan1)}`,
  );

  console.log('PASS: A3 the full 5-outcome door-admission decision table is proven against real fixtures');
}

main()
  .catch((err) => {
    console.error(`FAIL: A3 — ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await deleteTicketByBookingRef('DOOR-QR-ADMIT-01');
    await deleteTicketByBookingRef('DOOR-QR-UNPAID-01');
    await deleteTicketByBookingRef('DOOR-QR-WRONGSHOW-01');
  });
