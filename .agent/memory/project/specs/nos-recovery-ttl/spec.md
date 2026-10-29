# nos-recovery-ttl (M1/F1) - recovery-token expiry follows the show

Decision (SAOC lead for Brad, 2026-10-29): expiry = the active show's end date + 7 days, absolute, read from the active show record (Sanity), never a literal. Fail closed: no active show or an unparseable end date refuses minting loudly. Already-minted tokens keep their stored expiry unless a safe re-mint path exists.

Problem today: `mintRecoveryToken` defaults to now + 180 days (`lib/recovery-token.ts:25`). A ticket bought on 29 Oct 2026 for a show ending 26 Sep 2027 stops working on about 27 Apr 2027, five months before the show.

Reader: no new Sanity query. `app/api/tickets/checkout/route.ts` already builds `showWindow` (`activeShowWindowQuery` -> `resolveActiveShow` -> `buildShowWindow`, route.ts:540-542), which returns null for no active show or any unparseable start/end date. The feature consumes that value.

## Decisions

- D1 Pure helper plus the existing reader. New `lib/recovery-expiry.ts` (no imports): `computeRecoveryExpiry({showEnd, now}): Date` (throws `RecoveryExpiryError` with a code) and `resolveRecoveryExpiry({showWindow, now})` returning `{ok:true, expiresAt}` or `{ok:false, code}` (never throws for a RecoveryExpiryError; other errors propagate). Goldens test them with no Sanity.
- D2 Boundary: the show end instant is read as a calendar day in Africa/Johannesburg (fixed UTC+2, no DST; same convention as `computeShowDays`, golden cross-checks it). Expiry = SAST midnight that starts day (end day + 8), i.e. the end of day end+7. `verifyRecoveryToken` expires at `now >= e`, so the last valid instant is 23:59:59.999 SAST on end+7. Chosen over start-of-day+7 because it can never cut a buyer short; the property test proves expiry is in (end+7d, end+8d]. Worked example: show ends 26 Sep 2027 -> expires 2027-10-03T22:00:00Z (last valid 3 Oct 23:59:59.999 SAST). An end instant already past SAST midnight (e.g. 22:00Z) counts as the next SAST day: generous, never short. Date arithmetic uses Date.UTC day overflow (leap years, month and year rollover pinned).
- D3 Fail closed at checkout, refusing the sale. In POST, directly after the `RECOVERY_TOKEN_SECRET` guard and before `reserveTicket`, resolve the expiry; on `{ok:false}` log one line `{ code }` and return HTTP 500 with the EXISTING string `Ticket recovery is not configured. Please try again later.` No Firestore write, no gateway call, so no money is taken. Rejected alternatives: sell without a token (buyer loses recovery silently), mint with the 180-day default (violates the decision, outlives or undercuts the show), mint after payment (money taken then loss). A sale blocked by a bad show record is the safer failure, same posture as the missing-secret guard. Buyer sees the existing copy; logs see `[tickets/checkout] Cannot set the recovery link expiry.` with only the code (no-active-show, invalid-show-end, invalid-now, already-expired). GAP, no copy added (freeze): that message is not specific to this failure; a tailored buyer string is a Brad/Lee-Ann copy decision for later.
- D4 Order after show end + 7 days: `already-expired`, refused by the same path (no born-expired token). Normally unreachable because ticket sales close with the active show. Edge accepted: an idempotent replay of an old checkout key after the window also gets the 500.
- D5 Mint site is the smallest hunk: the route computes once in POST and passes `recoveryExpiresAt` through `ReservationInput`; the mint call gains one line `expiresAt: input.recoveryExpiresAt`. `mintRecoveryToken` gets an additive optional `expiresAt?: Date` (takes precedence over ttlMs; must be finite and strictly after `now`, else RangeError with no secret in the message). Defence in depth: a transaction retry landing after the window throws inside the transaction before any write (existing catch returns "Failed to reserve ticket").
- D6 `RECOVERY_TOKEN_DEFAULT_TTL_MS` stays exported but unused in production. Reason: 8 F6 checks, a typecheck fixture and docs import it and the primitive's legacy `ttlMs`/default path must stay byte-compatible (A7). It is not a silent default for tickets: `check_wiring.py no-default-ttl` fails if any file in app/ or lib/ other than recovery-token.ts references it, calls mintRecoveryToken without `expiresAt`, or aliases mintRecoveryToken; the route is the only minter. Removing the constant and the legacy path is a follow-up cleanup, not this feature.
- D7 Already-minted tokens: KEEP the stored 180-day expiry. No safe re-mint exists without new behaviour: the expiry `e` is inside the HMAC payload and verify rejects at `e`; changing the stored `recoveryTokenExpiresAt` does nothing, and issuing a new token invalidates the link already emailed (the stored token is compared) unless a new email is sent, which is a resend feature (out of scope, copy-frozen). Exposure: every order placed before about 6 Apr 2027 (show end + 7 days - 180 days) has a link that expires before the show window closes; all orders today are in that set. SAOC decision, flagged in the hunk list.
- D8 Verify side untouched: `verifyRecoveryToken`, `lib/recovery-access.ts` (#165), `/tickets/recover` (byte-identical 404 posture, D9 missing-secret behaviour, no token logging) are unchanged. An expired token still gets the same 404.
- D9 `showWindow` requires BOTH start and end to parse (existing `buildShowWindow`). A show document with a good end but bad start also refuses. Accepted: fail closed, and it reuses the one proven reader.

## Hunk list (every file and hunk @dev may touch)

| file | hunk | lane |
|---|---|---|
| `lib/recovery-expiry.ts` | new file, exports per D1 | free |
| `lib/recovery-token.ts` | `expiresAt?: Date` on `MintRecoveryTokenInput`; replace the two ttl lines in `mintRecoveryToken` with the explicit-or-ttl branch (anchor `rt-explicit-guard`). Nothing from `verifyRecoveryToken` down | SAOC clearance: token primitive, frozen by nos-order-recovery and guarded by the F6 contract |
| `app/api/tickets/checkout/route.ts` | exactly 5 additions-only hunks: (1) import `resolveRecoveryExpiry`; (2) `recoveryExpiresAt: Date;` in `ReservationInput`; (3) anchored `rx-resolve`/`rx-refuse` guard block after the secret guard; (4) `recoveryExpiresAt: recoveryExpiry.expiresAt,` in the `reserveTicket({` call; (5) `expiresAt: input.recoveryExpiresAt,` in the mint call | SAOC clearance: shared lane with nos-security-tiered-access F3 (fix/sec-abuse-controls, unmerged, edits ~1240-1260) |
| `docs/nos-recovery-ttl.md` | new doc (rule, boundary, fail-closed behaviour, already-minted choice) | free |

Nothing else. `check_wiring.py hunk-list`, `unchanged` and `route-hunks` enforce this. The exact pinned route lines are in `check_wiring.py` (`ROUTE_ADDED_ALLOWED`) and the anchors:

```
  // anchor: rx-resolve
  const recoveryExpiry = resolveRecoveryExpiry({ showWindow, now: new Date() });
  // anchor: rx-refuse
  if (!recoveryExpiry.ok) {
    console.error('[tickets/checkout] Cannot set the recovery link expiry.', { code: recoveryExpiry.code });
    return NextResponse.json(
      { error: 'Ticket recovery is not configured. Please try again later.' },
      { status: 500 }
    );
  }
```
`// anchor: rt-explicit-guard` precedes `if (!Number.isFinite(expiresAtEpochMs) || expiresAtEpochMs <= input.now.getTime()) {` in recovery-token.ts.

## Items for the SAOC hunk list
1. Already-minted tokens keep 180 days (D7). Needs a decision: accept, or schedule a separate resend/re-issue feature. NOS Site writes no Firestore; any backfill is a SAOC hand-off.
2. Clearance for the two shared-lane files above.
3. Sequencing: @dev starts AFTER nos-security-tiered-access F3 merges; branch from origin/main, `git merge origin/main` (never rebase). The route hunks are additions-only so the merge is a context-only conflict at worst; re-run A5 after merging.
4. Copy gap: buyer-facing text for this refusal reuses the generic string (D3).
5. Pre-existing breakage seen, not fixed: `contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh` fails on origin/main (greps the retired `writeReservationPair`).

## Validation done by the architect
Reference implementation (throwaway, reverted; kept outside the repo at the session scratchpad `nos-recovery-ttl-reference.patch`, 132 lines): goldens A1-A3 pass (A1 under four TZ values), wiring A4-A12 pass, F6 token checks pass, eslint clean, live-write-guard 0 violations, 46/46 mutants killed. `pnpm exec tsc --noEmit` and `pnpm build` were not conclusive here: the shared node_modules in this sandbox predates origin/main (missing pdf-lib, fontkit, `agentRules` type) so tsc reports 3 unrelated errors in other files, none in touched files.
