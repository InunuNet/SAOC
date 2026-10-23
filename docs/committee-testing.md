# Committee testing

Mission `committee-testing` (M1/F1), 2026-10-23.

Brad, verbatim: "We need to take down the password wall, but the ticketing needs a big warning
banner testing only, not live, so we can get the committe to start testing?"

Two parts, shipped in this order: the **testing treatment** on every ticketing surface, then the
runtime switch **`BETA_PASSWORD_WALL_OFF`** that lifts only the Basic Auth prompt.

## The testing treatment

Every element says **"Testing only, not live"**, with the sub-line **"No real payment is taken"**
where there is room for one. All of them are gated by one helper, `isTicketingTestMode()` in
`lib/ticketing-test-mode.ts`, which is `!TICKETING_PAYMENTS_LIVE` where the constant is a plain
`false` in code. It reads no env, no Firestore and no flag, so a blank variable or a failed read
cannot hide the treatment. `BETA_PASSWORD_WALL_OFF` and `SITE_PUBLIC_LAUNCH` never affect it.

| Element | Where |
|---|---|
| Sticky amber bar, first element of the page, above the skip link and header | `components/tickets/TicketingTestBar.tsx` (mounted once in `components/site-chrome/NosFrame.tsx`), view in `TicketingTestBarView.tsx` |
| Notice directly above the submit button | `components/tickets/TicketingTestPayNotice.tsx` in `TicketPurchaseForm.tsx` and `VendorStandPaymentForm.tsx` |
| Page title prefix `[Testing only, not live]` | `lib/ticketing-test-metadata.ts`, one layout per ticketing route chain |
| Email subject prefix (order confirmation with QR tickets, ticket sale admin notice, vendor payment confirmation, vendor payment admin notice, vendor stand payment ready) | `withTestSubjectPrefix()` at the five send sites; bodies unchanged |
| PDF watermark: the headline once, diagonal across each page, 30 percent opacity | `lib/ticket-pdf.ts` |

The bar shows on 10 public NOS-host surfaces: `/tickets`, `/tickets/[slug]`,
`/tickets/confirmation`, `/tickets/cancelled`, `/vsp`, `/conferences`, `/workshops`,
`/wosa-conference`, `/vendors/payment`, `/vendors/payment/status`. The SAOC host serves no
ticketing surface (it 308-redirects to NOS), so it has no bar. Visual values (amber `#F2C230`, ink
`#14110A`, sizes) are NOS Design's ruling and are pinned in the static check.

### How payments are sandboxed

1. Adapter level, always on: `lib/payments/ozow.ts` hard-codes `OZOW_IS_TEST = 'true'` and reads
   only `OZOW_SANDBOX_*` keys; `lib/payments/payfast.ts` reads only the sandbox keys and URL. The
   code has no live path, so the adapters are sandbox-only.
2. `adminSettings/ozowSandboxTestMode` only decides whether Ozow is asked to charge R0.01 instead of
   the displayed price. It is not the sandbox/live switch, and the treatment does not read it.

While the constant is `false` the adapters must stay sandbox-only; the contract fails if they stop
being so.

## `BETA_PASSWORD_WALL_OFF`

`isPasswordWallOff()` in `lib/beta-public-launch.ts` is true only for the exact, case-sensitive
string `true`. `proxy.ts` passes it to `decideBasicAuth()` as `passwordWallOff`, which allows the
request after the exempt-path and `publiclyLaunched` checks and before the credentials check.

It lifts the Basic Auth prompt and nothing else. `wallUp` is still `!publiclyLaunched`, so with the
switch on:

- `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store, max-age=0` and the
  `saoc_beta_wall=1` cookie are still sent on every response.
- `robots.txt` still disallows everything (`app/robots.ts` keys only on `SITE_PUBLIC_LAUNCH`).
- `/admin` and `/studio` keep their own sign-in.
- `/api/*` is reachable without Basic Auth (the routes keep their own checks).

`apphosting.yaml` carries a comment for the variable and never a value.

## Deploy order

1. Merge and deploy with `BETA_PASSWORD_WALL_OFF` unset. The wall is unchanged.
2. Verify the treatment on the deployed site, with Basic Auth still on: the 10 routes at 390px and
   desktop, the bar above the header, the sub-line, the notice above Pay, and a test order's email
   subject and PDF watermark.
3. Only then does SAOC ops set `BETA_PASSWORD_WALL_OFF=true` as a runtime variable and confirm that
   `/` opens without a prompt, `/robots.txt` still disallows all, and responses still carry
   noindex and no-store.
4. Rollback: unset `BETA_PASSWORD_WALL_OFF` and roll out.

Nobody sets the variable in the pull request that adds it.

## Going live (separate from this change)

Verify the live payment adapters first, then flip `TICKETING_PAYMENTS_LIVE` in
`lib/ticketing-test-mode.ts` (this removes every testing element at once) and update the
committee-testing contract in the same change, and only then set `SITE_PUBLIC_LAUNCH=true`.
