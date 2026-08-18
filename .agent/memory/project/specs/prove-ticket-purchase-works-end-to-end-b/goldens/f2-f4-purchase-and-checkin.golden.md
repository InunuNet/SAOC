# Golden: F2-F4 — real purchase, email, and door check-in proof

## F2 — purchase reaches 'paid'

Do not accept "PayFast redirected to the confirmation page" as proof of anything — that
is a client-side redirect the buyer's browser controls and it races the server-to-server
ITN by design (see `app/(marketing)/tickets/confirmation/page.tsx`'s own comment on this).

Proof requires ALL of:
- confirmation page's own poll (`GET /api/tickets/status?ref=...`) reports a body of
  the form `{ status }` — the raw Firestore `status` field, not a derived enum — with
  `status === 'paid'` before its 20-attempt/60s budget expires. (`status ===
  'checked-in'` also counts as confirmed per the page's own `CONFIRMED_STATUSES` set,
  but a fresh purchase should observe `'paid'`.) There is no `state` field and no
  literal `'confirmed'` value anywhere in this endpoint's real response shape
  (`app/api/tickets/status/route.ts`) — a genuine passing purchase observed
  `{"status":"paid"}` for booking ref `SAOC-2027-X8ZPQNYCVWGY`.
- Firestore: the order document AND its one child position document (in the `tickets`
  collection, keyed by booking ref) both show `status: 'paid'` —
  `markOrderAndPositionPaidByPaymentId` (lib/orders.ts) is a two-write transaction; seeing
  only one flipped is a real bug, not a timing artifact.
- Cloud Logging for that `m_payment_id` shows every ITN guard passed: signature match,
  amount match, `sandbox.payfast.co.za/eng/query/validate` returned exactly `VALID`, and
  `payment_status === COMPLETE`.
- The real booking reference is written into the mission's Notes — F4 cannot run without
  it.

## F3 — confirmation email/QR

Known context: `tickets.saoc.co.za` DNS is not yet live (Brad-owned, tracked separately).
A Resend failure is EXPECTED, not automatically a defect.

Proof requires:
- Cloud Logging around the ITN's post-commit hookup shows either a successful send, OR
  the caught-and-logged line `'[tickets/itn] Confirmation email failed — payment already
  committed, not rolled back'`.
- If failed: the underlying Resend error text is domain-verification-shaped (mentions the
  sending domain / "not verified" / DNS), not a code-level exception (e.g. not a
  TypeError, not a missing-field error).
- Either way: F2's order is still `paid` afterward — the isolation guarantee held under a
  REAL failure, not merely in a unit test fixture.
- Record which outcome actually happened, plainly, in mission Notes.

## F4 — door check-in

`/admin/door` has no unauthenticated or service-account path by design
(`lib/admin-auth.ts` fail-closed policy: `admin===true` claim + `email_verified===true` +
live `ADMIN_EMAIL_ALLOWLIST` membership, all three, re-checked every request). A real scan
needs a real interactive Firebase Auth sign-in.

Protocol:
1. Confirm (or provision) a test-admin identity: `scripts/admin-grant.ts <email>
   [--existing]` mints the claim; separately confirm that email is CURRENTLY in the
   deployed `ADMIN_EMAIL_ALLOWLIST` secret (the script does not do this — both are
   required, and this is the single most likely place this feature stalls if no one can
   safely add a test email to a production allowlist secret without Brad).
2. Sign in at `/admin/login`, reach `/admin/door`.
3. Submit F2's real booking reference — manual-entry field is an acceptable substitute
   for a physical/simulated camera scan.
4. Confirm `POST /api/admin/checkin` succeeds; confirm in Firestore the order/position
   now carries whatever `lib/checkin.ts` actually names its terminal admitted state (read
   the module — do not assume the string is literally `'checked-in'`).
5. Confirm a `checkinAttempts` audit document exists for this scan with the correct
   outcome, `scannedByUid`, and `bookingRef` (per `lib/checkin-audit.ts`).
6. Submit the SAME booking reference a second time and confirm it is correctly refused
   (the module's real name for "already admitted"), proving the admission rule actually
   runs, not just the happy path.

## If credentials cannot be safely obtained

If no agent in this session holds (or can safely obtain) an interactive Firebase Auth
admin session, do not silently skip F4. Produce a documented manual protocol — the exact
steps above, plus the exact Firestore/log queries to run afterward — for Brad to execute
himself, and say so explicitly in the mission Notes and in @qa's verdict.
