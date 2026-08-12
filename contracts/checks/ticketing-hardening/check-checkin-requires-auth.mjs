// A5 — the door endpoint refuses unauthenticated callers over real HTTP, and refusing
// costs a real paid ticket nothing. Runs against the live dev server and needs no
// credentials, so it is unaffected by Firebase Auth not being provisioned (see
// contracts/golden/ticketing-hardening/README.md).

import {
  assert,
  safeBody,
  createTicketDoc,
  postCheckin,
  readTicketById,
  runId,
  sentinelEmail,
  withCleanup,
} from './_shared.mjs';

await withCleanup('A5 unauthenticated check-in is refused 401 and mutates nothing', async () => {
  const id = runId();
  const bookingRef = `HARDEN-AUTH-${id}`;
  const ref = await createTicketDoc({
    bookingRef,
    attendeeEmail: sentinelEmail(`auth-${id}`),
    status: 'paid',
    purchasedAt: new Date(),
  });

  const noCookie = await postCheckin(bookingRef, null);
  assert(
    noCookie.status === 401,
    `POST with no session cookie should be 401, got ${noCookie.status} ${safeBody(noCookie.body)}`
  );

  const forged = await postCheckin(bookingRef, 'not-a-real-session-cookie');
  assert(
    forged.status === 401,
    `POST with a forged session cookie should be 401, got ${forged.status} ${safeBody(forged.body)}`
  );

  const after = await readTicketById(ref.id);
  assert(
    after?.status === 'paid' && after?.checkedInAt == null,
    `Firestore read-back: an unauthenticated request still mutated the ticket (status '${after?.status}')`
  );
});
