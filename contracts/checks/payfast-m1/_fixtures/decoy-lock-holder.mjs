// Decoy fixture — gives F2 and F4's checks a safe, deliberate way to reproduce "process
// killed after writing a fixture, before cleanup runs" without ever doing that to a real
// suite script. See
// contracts/golden/payfast-m1-lock-cleanup-fix/decoy-lock-holder.golden.md.
//
// This file is a fixture, not a production check — it is never listed in
// contract-payfast-m1.yaml's own assertion commands as anything other than a child
// process spawned BY another check's script (check-manifest-survives-kill.mjs and
// check-suite-leaves-no-ticket-residue.mjs's capability-proof half).
//
// Deliberately calls none of _shared.mjs's own cleanup-or-locking wrapper helpers (the
// suite-lock acquirer, the sentinel sweep, or the standard cleanup wrapper) — the whole
// point is that this fixture behaves like a process that got killed before any of those
// had a chance to run. Its only cleanup responsibility is participating correctly in the
// fixture manifest (via createTicketDoc(), see below) so the manifest-based preflight
// sweep (F2) can find and remove what it left behind.

import { createTicketDoc, sentinelEmail } from '../../ticketing-hardening/_shared.mjs';

// The parent process waits for this exact stdout line before sending SIGKILL, so the
// kill always lands after the write completes, never racing it.
export const WRITE_COMPLETE_MARKER = 'DECOY: write completed';

// The parent kills this process well before 60s returns — this script must never
// legitimately reach its own exit under normal test execution.
const SLEEP_MS = 60_000;

async function main() {
  const runId = process.env.DECOY_RUN_ID ?? String(process.pid);
  const email = sentinelEmail(`decoy-lock-holder-${runId}`);
  // createTicketDoc() generates its own doc ref and calls recordFixtureCreated()
  // BEFORE the Firestore write (see ticketing-hardening/_shared.mjs) — reused here
  // rather than reinvented, so the kill-and-recover proof exercises the exact same
  // manifest wiring a real fixture-writing check would take.
  const ref = await createTicketDoc({ attendeeEmail: email, bookingRef: `DECOY-${runId}` });
  console.log(`${WRITE_COMPLETE_MARKER}: tickets/${ref.id}`);
  await new Promise((resolve) => setTimeout(resolve, SLEEP_MS));
}

main();
