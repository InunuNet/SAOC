# NOS order recovery (`/tickets/recover`)

Every order confirmation email links to `https://<nos origin>/tickets/recover?token=<signed>` ("Lost this email? Recover your tickets"). Until this feature the link 404ed because no route served it. Spec: `.agent/memory/project/specs/nos-order-recovery/spec.md`; governing text: `docs/ticketing-system-foundation-spec.md` section 8.2 (a), 8.4 (2), 8.5.

## What it does

A display-only Server Component page, `app/(nos)/tickets/recover/page.tsx`. A valid link shows the order's tickets (QR, attendee, type, amount, booking reference, per-ticket download) using the same `ConfirmedTicketList` component as the confirmation page. There is no form and no resend action; resend is a separate follow-up that needs the abuse limiter.

## Access (`lib/recovery-access.ts`)

Token only. No cookie, header, account or admin helper is involved. Access requires all of:

1. `verifyRecoveryToken` passes (HMAC-SHA256, 64-hex signature shape, expiry; `lib/recovery-token.ts`). A token longer than `RECOVERY_TOKEN_MAX_LENGTH` (2048) is refused first.
2. The order id inside the signed payload loads an order (`getOrderRecoveryRecord`, a get by doc id, never a query on the token).
3. That order's stored `recoveryToken` equals the presented token (constant time). Replacing the stored token revokes every older link.
4. The order's `status` is `paid`.

## Failure behaviour

- Every invalid, forged, expired, revoked, unpaid or unknown-order token gets the same 404 through the existing `(nos)/not-found.tsx`. `resolveRecoveryAccess` returns `{ ok: false }` with no reason, so the page cannot leak one.
- A token that fails parse, length, signature or expiry causes zero Firestore reads.
- A missing `RECOVERY_TOKEN_SECRET` throws before the token is inspected, so every request gets the same 500.
- A Firestore outage propagates as a 500, never the 404, so a real buyer is not told their link is invalid.

## Headers and caching

`next.config.ts` `headers()` has two disjoint rules: `/tickets/recover` (Referrer-Policy `no-referrer`, Cache-Control `private, no-store, max-age=0`, X-Robots-Tag `noindex, nofollow`, plus the rest of the security headers) and every other path (unchanged). The page also sets `force-dynamic` and noindex/no-referrer metadata so it does not rely on config alone. `proxy.ts` is unchanged: it already passes `/tickets/*` through on the NOS host and redirects the SAOC host to the NOS origin keeping the query.

## Accepted limitations

- The token is a bearer secret in a URL query, so it appears in request logs and browser history. The code never logs it. Mitigation is expiry plus revocation by rotating the stored token.
- The token lifetime is the existing 180-day placeholder in `lib/recovery-token.ts`; it is not Council-approved and is untouched here.
- No rate limit on GET: guessing needs a valid HMAC over a server secret.
- The generic 404 gives an expired-link buyer no way to ask for a new link; a recovery-specific state and the resend form await committee copy (`docs/rules/no-invention.md`).
- The success render needs live Firestore and is covered by the post-deploy checks, not the offline goldens.
