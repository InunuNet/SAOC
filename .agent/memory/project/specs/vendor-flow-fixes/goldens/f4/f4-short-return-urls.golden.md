# F4 golden: short, token-free gateway return URLs

Bug (P0, confirmed on beta 2026-10-14): vendor stand Pay Now via Ozow lands on
pay.ozow.com/request-error. `app/api/vendors/stand-payment/initiate/route.ts` (~L234) sends
`returnUrl = <site>/national-show/vendors/payment?token=<~186-char signed token>&paid=1` and
`cancelUrl = ...?token=...` (239-246 chars). Ozow documents SuccessUrl, ErrorUrl and NotifyUrl as
String(150) (CancelUrl printed as String(50), see ozow-field-caps.json notes); `lib/payments/ozow.ts` maps
returnUrl to SuccessUrl and cancelUrl to CancelUrl and ErrorUrl. NotifyUrl (58), TransactionReference
(42) and BankReference (20, fixed in a42694dc) are fine. PayFast documents return_url, cancel_url and
notify_url as unbounded, item_name and m_payment_id at 100 chars. Ticket flow already uses short URLs
(`/tickets/confirmation?ref=<ref>`).

## Decision: ONE short status page keyed by the attempt id, not a token-minting redirect

| Option | Verdict |
|---|---|
| A. `/vsp?a=<attemptId>` (alias of `/national-show/vendors/payment/status`) reads `vendorStandOrders` server-side and shows paid / pending / not-completed | CHOSEN |
| B. Short route that re-mints a payment token and redirects to `/payment` | Rejected: it turns knowledge of an identifier into a bearer token for the payment page (a minting oracle), needs rate limiting and expiry policy, and adds a redirect surface. |

Why A has the least attack surface: it mints nothing, verifies nothing, writes nothing, redirects
nowhere, reads no submission, and renders three static sentences with no business name, amount,
email or reference. The only input is a 16-hex attempt id (64 bits, server-minted by
`randomBytes(8)` per payment attempt), validated against `^[0-9a-f]{16}$` before any read.

Why key by `attemptId` and not `vendorSubmissionId`: F2 treats the submission id as semi-secret (the
public `POST /api/vendors/[id]/marketing-asset` is keyed by it and the photo-resume token exists to
avoid revealing it). Putting it in a URL that transits the gateway, browser history and Referer would
widen that. The attempt id unlocks nothing anywhere; knowing it only tells you one of three words.
It is already sent to the gateway inside TransactionReference.

Success, cancel and error all use the SAME URL. The page never trusts the query string for status
(`paid=1` is gone); it reads the stored order. Known, accepted limitation: if a vendor abandons attempt
A and then pays on attempt B, returning to A's URL shows "not completed" (A's id no longer matches the
order doc). The paid outcome is still shown on B's URL and in the confirmation email.

Not changed (proved by diff against a42694dc): settlement (`lib/vendor-stand-payment-notification.ts`),
token module, both ITN routes, the `/payment` page and form, `lib/payments/payfast.ts`. Ticket checkout changes only if A4 requires it (cancelUrl length).

## Length budget (AMENDED twice; current: 150 enforced, `/vsp` kept for margin)

Ozow's main post-variable table prints CancelUrl as String(50) and the others as String(150).
Decision (orchestrator, 2026-10-14): 150 is enforced for CancelUrl. Evidence: learned.md and
docs/payment-seam.md (line ~253) record live Ozow sandbox ticket purchases reaching `paid` while sending
a 63-68 char ticket CancelUrl, so Ozow does not enforce 50. `/vsp` is kept anyway: short URLs cost nothing and add margin.

Path `/vsp` = 4, `?a=` = 3, attempt id = 16, so path+query = 23 chars. Any siteUrl up to 127 chars stays <= 150:
https://saoc.co.za 41, https://beta.saoc.co.za 46, hosted.app fallback 70, the checks' 60-char stress host 83.
Old URLs: 239-283. The long path `/national-show/vendors/payment/status` keeps working (the alias re-exports it).

`/vsp/page.tsx` is a thin re-export (<= 20 lines): imports the status page default and `metadata` (noIndex),
re-exports `metadata`, declares `export const dynamic = 'force-dynamic'` itself (segment config cannot be
re-exported), no other logic. The ticket checkout is untouched (A5 diff against base).

`clampToMaxLength` is code-point-safe: never exceeds `max` UTF-16 units and never leaves a lone surrogate (a pair
straddling the cut is dropped whole).

## Files @dev touches

New (pure, relative imports only, loadable by plain node):
- `lib/vendor-stand-return.ts`: `VENDOR_STAND_RETURN_PATH`, `ATTEMPT_ID_PATTERN` (`/^[0-9a-f]{16}$/`),
  `buildVendorStandReturnUrl(siteUrl, attemptId)` (strips one trailing slash; throws on malformed id),
  `resolveVendorStandReturnState({ attemptId, loadOrderStatus })` -> `'paid' | 'pending' | 'not-completed'`.
  Inputs: ONLY attemptId (unknown type: non-strings and malformed ids resolve `not-completed` with no load)
  and `loadOrderStatus(attemptId): Promise<string | null | undefined>`. Exact `'paid'` -> paid,
  exact `'pending'` -> pending, anything else -> not-completed, loader throws -> pending. See return-state-matrix.json.
- `lib/payments/gateway-field-limits.ts` (NO imports): `OZOW_FIELD_MAX_LENGTH` (equals ozow-field-caps.json
  `caps`), `PAYFAST_FIELD_MAX_LENGTH` (`item_name` 100, `m_payment_id` 100),
  `findFieldLengthViolations(fields, limits)` -> `{ field, length, max }[]`, `clampToMaxLength(value, max)`.
- `app/(marketing)/national-show/vendors/payment/status/page.tsx`: copy `vendors/payment/page.tsx` shape
  (`buildPageMetadata` noIndex, `force-dynamic`, `NosHero image="/images/orchid-yellow.jpg" eyebrow="National Show"
  title="Vendor Stand Payment"`, container `mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20`, body
  `font-sans text-[15px] text-ink`). Loader: `db.collection(VENDOR_STAND_ORDERS_COLLECTION).where('attemptId','==',a).limit(1).get()`
  returning only `data().status`; on error `console.error` the attempt id (no other data) and rethrow so the
  resolver maps it to pending. Copy per copy-strings.json. No new components, colours or fonts.

Edited:
- `app/api/vendors/stand-payment/initiate/route.ts`: `returnUrl` and `cancelUrl` both
  `buildVendorStandReturnUrl(siteUrl, attemptId)`; `itemName` wrapped in `clampToMaxLength(..., PAYFAST_FIELD_MAX_LENGTH.item_name)`.
  Nothing else (step order, transaction, token verify) moves.
- `lib/payments/ozow.ts`: after `signedFields` is built and BEFORE `generateOzowHash`, call
  `findFieldLengthViolations(signedFields, OZOW_FIELD_MAX_LENGTH)`; if non-empty `throw new Error` naming each
  field and its length and the cap, never the value (same loud-500 posture as `deriveOzowBankReference`).
- `app/(marketing)/vsp/page.tsx` (new alias, see above).
- Route registries: `scripts/generate-nos-route-manifest.ts` (regenerate `content/national-show-routes.json`) and
  `scripts/checks/verify-show-page-m4.ts` (`group: 'exhibit-trade', listed: false, dynamic: false, indexable: false, owner: 'saoc-eb'`).

## Security properties

1. No signed token, submission id, status flag or PII in any gateway-bound URL, enforced repo-wide by A5.
2. The status shown comes only from the stored order status; the URL cannot assert `paid`.
3. Page is not an oracle: unknown, superseded, failed and cancelled ids render the same sentence;
   64-bit random id; closed three-value output; no PII, amount or reference.
4. Nothing minted, verified, written or redirected; no new secret, collection, index (single-field index is automatic) or API route.
5. Over-length gateway fields fail loudly at initiate (logged 500 with lengths only) instead of a silent gateway rejection.
6. A loader outage shows neutral "not confirmed yet", never "try again", so a possibly-paid vendor is not nudged to pay twice (initiate also 409s on a paid order).

## Open items (not blocking)

- Ozow CancelUrl cap (50 vs 150) remains unverified; confirm with Ozow support. If 150 is real, `/vsp` is merely shorter than needed.
- `TransactionReference` contains `::`; no evidence it is invalid, left alone as instructed.
- Verification after deploy: Ozow sandbox Pay Now on beta (BrowserAgent), then the status page for pending/paid,
  per the verification triad in `.claude/rules/workflow.md`.
