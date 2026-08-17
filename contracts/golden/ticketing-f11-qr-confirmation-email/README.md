# F11 — QR generation and confirmation email content: decision record

Mission `ticketing-foundation`, feature F11 (spec §6, §11). This is the second half of the F10/F11
boundary F10's own golden README already drew: F10 shipped the hookup call site (strictly
after-commit, isolated by `deliverConfirmationEmailAfterCommit`) and a minimal stub body of
`sendConfirmationEmail()`. F11 replaces that body with real content and does **not** touch the
pinned `app/api/tickets/itn/route.ts` again — everything below was designed to compile and behave
correctly against the call site F10 already authored, not to require reopening it.

Everything below was read and verified against the actual current source, not assumed from the
mission brief — where reading the code surfaced something the brief didn't anticipate, that is
called out explicitly, matching F1/F10's precedent.

---

## The field the QR encodes: confirmed against `lib/checkin.ts`, not assumed

The dispatch flagged this as a trap: "The QR must encode whatever `lib/checkin.ts` actually looks
a ticket up by." Read `lib/checkin.ts:74-97` (`admit()`): the door-scan admission function queries
`db.collection('tickets').where('bookingRef', '==', bookingRef)` — it looks up by the position's
`bookingRef` field, not by Firestore document id (which happens to equal `bookingRef` today per
`lib/orders.ts`'s own comment, but the *query* is what matters and it's explicitly `bookingRef`,
not `id`). `generateBookingRefQrDataUri(bookingRef)` encodes exactly that value, verbatim, as
plain text — no JSON wrapper, no signature, no prefix/suffix. This is also spec §7.1/§6's own
explicit finding ("the unsigned, random booking-reference QR is correct as designed — confirmed,
not merely assumed"), so F11 is not re-litigating that decision, only implementing it.

---

## Blocker this contract surfaces but does not fix: checkout never creates an `orders` document

**Found while reading `app/api/tickets/checkout/route.ts` in full** (not merely grepped), because
understanding what `sendConfirmationEmail()`'s real caller actually passes required tracing the
whole chain back to reservation time. This was not previously written down anywhere in the mission
or in F10's README, and it is serious enough to flag prominently rather than quietly work around:

`app/api/tickets/checkout/route.ts`'s `reserveTicket()` (lines ~194-266) writes **directly** to the
`tickets` collection inside its own transaction — `transaction.create(tickets.doc(bookingRef),
{...})` — and never calls `createOrderWithPosition()` (`lib/orders.ts`, F2/F8's shared creation
primitive) or writes anything to the `orders` collection at all. `docs/ticketing-system-foundation-spec.md`
lines 177/251 both say "the checkout route becomes order-aware (§4.2)" as an assumed-complete
premise — it is not true of the code as it exists today (verified 2026-08-17, `grep -c
createOrderWithPosition app/api/tickets/checkout/route.ts` → `0`).

**Consequence for F10/F11 in a real purchase, traced precisely:** F10's
`markOrderAndPositionPaidByPaymentId()` resolves an order by querying
`orders.where('m_payment_id', '==', input.m_payment_id)`. Because checkout never creates that
order document, this query returns empty for every real reservation today, the function returns
`{ committed: false, reason: 'order-not-found' }`, and the pinned ITN route's own logic (per
`itn-route.expected.ts.txt`) never reaches the `deliverConfirmationEmailAfterCommit(...)` call at
all — `sendConfirmationEmail()` is **never invoked for a real purchase** regardless of how
correctly F11 builds it. The same gap independently means every real order's `recoveryToken` stays
`null` forever (F10's README already flagged the token-minting half of this; the missing order
document is the more fundamental half underneath it).

**Why this is not F11's fix, and is handed onward instead of silently absorbed:**
- `app/api/tickets/checkout/route.ts` is not the pinned file (only `app/api/tickets/itn/route.ts`
  is), so nothing here is blocked by the sha256 ceremony — but F11's dispatch scope is
  specifically "QR generation at email-send time, confirmation email with all positions' QRs and
  recovery link," tested "in isolation with fixture data." Wiring checkout to create an `orders`
  document is a materially different, order-of-magnitude-larger change (the entire reservation
  transaction's write shape, its idempotency-replay branch, and its interaction with
  `lib/data/tickets.ts`'s capacity counting, none of which any current F-item's Done criteria
  mention) that no numbered feature in this mission currently owns.
- It is the same class of gap as the two blockers already named in the dispatch (the roles
  migration never run with `--apply`; no production `ShowWindowLookup`): known, load-bearing, and
  not this feature's to fix.
- **This is queued to `.agent/memory/project/needs-human.md`** (see that file's new "Ticketing
  foundation F11" entry) rather than self-assigned to a new F-number, matching the standing rule
  established by the F5 buyer-security-proof entry in the same file: don't invent an F-number for
  an ownership gap, surface it for a human decision.

**What this means for F11's own scope, stated plainly:** F11 ships a correct, fully-tested
`sendConfirmationEmail()` that will work exactly as designed the moment a caller supplies it a
real order with real positions — which is exactly what the mission brief asks for ("The
`sendConfirmationEmail()` function is tested in isolation with fixture data... until [Resend is
configured], M2 proof will be a logged payload inspection"). It does not, and cannot, make F12's
real human purchase-and-scan proof succeed today, because the order the email would describe is
never created. F12 (or a new checkout-order-wiring feature ahead of it) inherits this.

---

## Design decisions

### Inline data-URI vs. attachment

Spec §6 already makes this call explicitly ("as an inline data-URI image, not a hosted ticket
page — a hosted page reachable by booking ref alone reintroduces the guessable-URL problem the
status endpoint already avoids") and the F11 mission brief independently restates it ("generates a
2D QR code for each position's `bookingRef` as an inline data-URI PNG"). F11 does not re-decide
this — both the spec and the brief already have — but the dispatch is right that it carries a real
deliverability consequence worth naming and gating, not merely inheriting silently:

- **Real risk, named honestly:** several major email clients (historically, Outlook desktop's
  Word-based rendering engine most notably) strip or refuse to display `data:` URIs in HTML email,
  showing a broken-image placeholder instead. Gmail, Apple Mail, and most modern webmail clients
  render them fine. This is a genuine tradeoff, not a solved problem — it is why the template also
  renders the `bookingRef` as **visible text** on every position (not merely as alt text on the
  image), so a client that drops the QR image still leaves the buyer/door-volunteer able to use
  the booking reference directly, matching `docs/ticketing.md` line 305's existing "can a door
  volunteer look them up by name" fallback pattern.
- **Attachments were considered and rejected** for the reason the spec already gives: an attached
  PDF/PNG per position on a multi-position order multiplies attachment count with order size,
  several mail providers apply stricter spam scoring to multi-attachment transactional email than
  to inline images, and — the sharper reason — an attachment is a file a buyer can forward or
  screenshot-share losslessly at higher resolution than an inline image, which does not change the
  QR's unsigned-secret security model (§7.1 already settled that the *booking ref itself* being
  shareable is fine — it's a door code, not a wallet key — so this isn't a security argument either
  way) but does not obviously improve anything over inline either. Given the spec already decided
  inline, this reasoning is recorded for completeness, not as a live re-decision.
- **Gated by A4:** the multi-position fan-out check asserts the rendered HTML retains the full
  `data:image/png;base64,` prefix for every position — proving the render step doesn't silently
  externalise the image (e.g. `@react-email/components`'s `render()` swapping to a `cid:`
  reference, or a future refactor accidentally switching to a hosted `<img src="https://...">`).
  This is the "gate the consequence" the dispatch asked for: not a fix for the client-support
  tradeoff (that requires no code change, only the visible-text fallback already built in), but a
  regression guard against the decision silently reversing itself.

### One email per order, addressed to the buyer

Direct implementation of spec §6 ("One confirmation email is sent per order, not per position...
addressed to the buyer, containing all... attendee names and all... QR codes") and F10's own
already-recorded judgement call ("`buyerName`/`buyerEmail` on the email hookup come from the
ORDER, not the position... the forward-compatible choice for the eventual multi-position order").
A4 proves `mailer.send()` is called exactly once per `sendConfirmationEmail()` call, addressed to
`input.buyerEmail`, regardless of position count.

### `siteUrl` resolution — a local three-line fallback, not an import from checkout

`app/api/tickets/checkout/route.ts` has its own private, unexported `resolveSiteUrl()` reading
`process.env.SITE_URL` with a `'https://saoc.co.za'` fallback (chosen there, per its own comment,
because `SITE_URL` is only available at Firebase App Hosting **runtime**, not build time, so it
must be read inside the function body, not hoisted to module scope). `lib/confirmation-email.ts`
cannot import it (it's private to checkout's route module, and importing across route-handler
files is not a pattern this project uses elsewhere), so it duplicates the same three-line
fallback locally rather than exporting/sharing a new cross-cutting helper for a single call site —
consistent with "Minimal Scope": this is not the moment to introduce a shared `lib/site-url.ts`
for one existing and one new consumer that already agree on the value.

### Zero-position refusal — asserted even though not reachable today

`markOrderAndPositionPaidByPaymentId()`'s `positions: [outcome.position]` (singular, always
populated when `committed: true`) means F10's real call site can never pass an empty array. A5
still asserts the refusal because: (1) the mission brief explicitly names it as a case to prove;
(2) spec §6 designs `sendConfirmationEmail()` as genuinely multi-position-capable for a future
multi-attendee checkout flow, and a defensive refusal here is the cheap insurance that a future
caller reaching this function with a malformed/empty positions array fails loudly (logged via
`onError`) rather than sending a buyer a confirmation email with a blank ticket section.

### Credential safety — recovery token never in logs

Direct implementation of the dispatch's non-negotiable rule. `sendConfirmationEmail()` contains no
`console.*` call anywhere in its own body (all diagnostic logging on the real failure path already
lives in the pinned ITN route's `onError` callback, which logs `{ m_payment_id, orderId, error }` —
never the token — and is unchanged by F11). A7 proves this behaviourally: spies on all five
console methods across a success case and a QR-failure case, using a fixture token, and asserts
the token substring appears in neither the captured console output nor the thrown error's
message/stack.

---

## Every assertion and its defeating mutation

| # | What it proves | Defeating mutation it kills |
|---|---|---|
| A1 | Whole project compiles | Any syntax/type error in the four new/changed files |
| A2 | Every new/extended exported shape is compiler-verified | A signature drift (e.g. `SendConfirmationEmailDeps` losing a member, `OrderConfirmationProps` forgetting `qrDataUri`) that a runtime-only check wouldn't catch until it crashed |
| A3 | QR genuinely decodes via jsQR to the exact input `bookingRef` | Encoding a different/truncated/JSON-wrapped value instead of the raw string |
| A4 | Full position→QR→rendered-HTML pipeline, 1 and 3 positions | Same QR reused across positions; shuffled/off-by-one QR-to-position mapping; dropped attendee name; QR silently externalised (cid:/remote URL) instead of staying inline |
| A5 | Zero-position order refused before any side effect | Sending a blank-ticket-section email instead of refusing; refusing only AFTER already calling the mailer/QR generator |
| A6 | `buildRecoveryUrl` correct at every boundary (real token, null token, trailing slash, argument-sensitivity) | Interpolating a possibly-null token directly, producing `?token=null` |
| A7 | Recovery token never reaches console/thrown-error text | A stray `console.error('...', input)` or `` `failed for ${token}` `` diagnostic |
| A8 | `sendConfirmationEmail` propagates (does not swallow) its own dependency failures | A defensive try/catch inside the function that silently resolves instead of rejecting |
| A9 | Lint clean | Style/lint regressions in the new files |

---

## `npx tsx` vs `node --import tsx/esm` — traced per check, per F10's established rule

Carried forward from `contracts/golden/ticketing-f10-itn-repin/README.md`'s note (which itself
carried it from F8's), restated because it has cost this mission a cycle twice already:

- **A3** (`check-qr-roundtrip.mjs`) imports `lib/qr.ts` (only imports the `qrcode` package — zero
  `@/*` aliases) and `lib/booking-ref.ts` (only imports `node:crypto` — zero `@/*` aliases) ->
  **`node --import tsx/esm` is sufficient.**
- **A6** (`check-recovery-link-presence.mjs`) imports only `lib/recovery-url.ts`, which has zero
  imports of any kind -> **`node --import tsx/esm` is sufficient.** This is exactly why
  `buildRecoveryUrl` was deliberately split into its own file rather than living inside
  `lib/confirmation-email.ts` — keeping it import-graph-clean makes its own check simple and fast.
- **A4, A5, A7, A8** all import `lib/confirmation-email.ts`, whose own top-level imports include
  `sendEmail` from `@/lib/email` (a VALUE import) and the default export of `@/emails/OrderConfirmation`
  (a VALUE import) — both pulled in eagerly at module load regardless of whether a given check
  overrides them via `deps` -> **`npx tsx` is required for all four.** Verified by tracing the
  import graph, not assumed from the file list; A4/A5/A7/A8 were written directly against `npx tsx`
  from the start rather than discovered wrong after a gate failure this time.

---

## What this contract does NOT prove — handed to a human step or a later feature, not downgraded to a source grep

- **A real end-to-end email arriving in an inbox.** No Resend account exists yet (spec §6, restated
  in the mission brief: "For now, Resend account does not exist... M2 proof will be a logged
  payload inspection"). Every check here uses a fixture `ConfirmationEmailMailer`, never
  `lib/email.ts`'s real `sendEmail`/Resend client, matching the offline/credential-free/no-network
  constraint. This is F12's job once Resend is configured, not F11's.
- **A real order actually reaching `sendConfirmationEmail()` in production**, for the reason
  documented above at length ("Blocker this contract surfaces but does not fix") — checkout never
  creates the `orders` document F10's lookup depends on. This is not F11's gap to close and is
  queued to `.agent/memory/project/needs-human.md` for an ownership decision.
- **A live `recoveryToken` on a real order.** Even once the blocker above is fixed, `mintRecoveryToken`
  (F6, already shipped) is still not wired into any order-creation call site — F10's README already
  named this; F11 makes `sendConfirmationEmail()` correctly handle whichever value it receives
  (real token or `null`) but does not mint one itself, because F11 does not create orders.
- **Real-world rendering across actual email clients** (Outlook's `data:` URI stripping named
  above, mobile Gmail app quirks, dark-mode CSS inversion of the QR image, etc.). A4 proves the
  HTML this project generates is structurally correct and inline; it cannot prove what a specific
  mail client does with that HTML. This is inherent to testing offline and is not something a
  contract check can close — human inbox verification (F12/F14) is the only way to observe it.
- **A physical camera/scanner reading the QR off a screen or printout at real size/lighting.** A3
  proves the generated pixel buffer is decodable by jsQR, a real independent decoder, operating on
  the exact bytes the function produces — the strongest offline proxy available, not a substitute
  for F12's physical door-scan proof.
- **The email's exact visible copy** (the "Lost your ticket? Click here" wording, subject line
  phrasing, ticket-type display formatting). These are Brad's copy calls per this project's "no
  invented brand assets" convention where applicable, and — being plain internal template text, not
  Sanity-sourced content per `docs/ticketing.md`'s CONTENT/MONEY table — are not contract-pinned
  beyond what A4 already checks structurally (attendee names present, QR present, recovery link
  present/absent correctly).

---

## Files written

- `contracts/contract-ticketing-f11-qr-confirmation-email.yaml`
- `contracts/golden/ticketing-f11-qr-confirmation-email/README.md` (this file)
- `contracts/checks/ticketing-f11-qr-confirmation-email/tsconfig.typecheck.json`
- `contracts/checks/ticketing-f11-qr-confirmation-email/fixtures/qr-confirmation-email-typecheck.ts`
- `contracts/checks/ticketing-f11-qr-confirmation-email/check-qr-roundtrip.mjs`
- `contracts/checks/ticketing-f11-qr-confirmation-email/check-multi-position-fanout.mjs`
- `contracts/checks/ticketing-f11-qr-confirmation-email/check-zero-position-refusal.mjs`
- `contracts/checks/ticketing-f11-qr-confirmation-email/check-recovery-link-presence.mjs`
- `contracts/checks/ticketing-f11-qr-confirmation-email/check-credential-safety.mjs`
- `contracts/checks/ticketing-f11-qr-confirmation-email/check-error-propagation.mjs`

Every `.mjs` check was syntax-verified with `node --check`; the QR-encode/decode round trip
(`qrcode` -> `pngjs` -> `jsQR`) and the `@react-email/components` `render()` call were both smoke-tested
directly against the real installed packages (not merely assumed to work) before being written into
the check scripts. The TypeScript fixture and tsconfig were written to compile against the exact
exported shapes specified above but have **not** been run against real `@dev`-implemented
`lib/qr.ts` / `lib/recovery-url.ts` / `lib/confirmation-email.ts` / `emails/OrderConfirmation.tsx`
code, because none of that code exists yet. None of these checks is claimed to be green.
