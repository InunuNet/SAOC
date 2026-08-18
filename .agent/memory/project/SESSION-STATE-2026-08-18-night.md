# Session state — 2026-08-18 overnight (safe compaction point)

## SHIPPED AND PUSHED (verified, chain-complete)

| Commit | What |
|---|---|
| `f6f5963` | reply_to → info@saoc.co.za. Gate 9/9, Codex PASS, docs. |
| `828a184` | QR + buyer details + downloadable PNG on the paid confirmation page. Gate 8/8, Codex PASS, @qa PASS, browser-verified. |
| `87e3457` | gh_closure_scan exit-0-on-error fix; dead TicketConfirmation.tsx removed; stale comments. |
| `ac79627` | Vendor form: strict integer validation, conditional-field gating + payload exclusion, placeholders. Gate 21/21, @qa PASS w/ live 320px browser proof. |
| docs | `docs/f4-door-checkin-manual-protocol.md`, `docs/email-reply-to.md`, `docs/email-dns-setup.md` (rewritten). |

## MISSION prove-ticket-purchase-works-end-to-end-b — 3/4

- **F1 done.** Auto-deploy proven healthy. Check reworked to pinned-commit historical proof after
  3 Codex fails + an @architect reframe.
- **F2 done.** Purchase proven TWICE on live site: automated `SAOC-2027-X8ZPQNYCVWGY` and Brad's
  own `SAOC-2027-EM1BPQJTAN7Y`. Both clean two-write to paid.
- **F3 done.** Email isolation proven under a real Resend failure. Since then
  tickets.saoc.co.za was VERIFIED at Resend, so delivery should now work — a third purchase
  `SAOC-2027-5DEFEKCF6S1R` was made to brad@inunu.net to test. **UNCONFIRMED: Brad has not yet
  said whether that email arrived.** sendEmail() has no success logging and the API key 401s on
  GET /emails, so only his inbox can settle it.
- **F4 blocked** on admin auth. Protocol written and waiting: `docs/f4-door-checkin-manual-protocol.md`.
  Gate 8/10; A9/A10 honestly red pending a real door scan.

## IN FLIGHT AT COMPACTION (uncommitted, agents mid-work)

1. **Admin nav** — `components/admin/AdminNav.tsx`, `DoorScannerClient.tsx`,
   `app/admin/{page,door/page,vendors/page}.tsx`, `app/api/admin/session/route.ts` (DELETE
   sign-out), `execution/checks/verify_admin_nav.ts`. Spec: `specs/admin-nav-menu/`. @dev running.
2. **Order reconciliation** — `lib/reconciliation.ts`, `app/api/admin/reconcile-orders/`,
   `emails/ReconciliationAlert.tsx`, `firestore.indexes.json` + `firebase.json`. Spec:
   `specs/order-reconciliation/`. A1/A2/A5 pass; A3/A4 blocked on golden fixtures being corrected
   by @architect (my error: logged booking refs without the `SAOC-2027-` prefix).
   **A Firestore composite index on orders(status, expiresAt) was deployed to saoc-webapp** — it
   never existed; firebase.json had no firestore key at all.
3. **Capacity hold** — `types/index.ts`, `lib/data/tickets.ts`, `lib/reconciliation.ts`. Spec:
   `specs/ticketing-capacity-reconciliation-hold/`. HOLDING pending @architect decisions.

## KEY FINDINGS TONIGHT

- **Capacity tracking already existed** and is rigorously proven (transactional reserveTicket,
  a real 5-concurrent-request no-oversell check). Brad's request needed no new system.
- **P1 LIVE BUG — reserved seats never release.** `buildReservationDocs` writes `expiresAt` only
  on the Order, never the Ticket position; capacity reads only `tickets`, so every reserved
  position hits "no expiresAt -> fail closed -> hold". Abandoned carts hold seats FOREVER.
  Found by a negative control. Fix interacts with the reconciliation hold — land them in order.
- **P1 stranded reserved orders** (now 4, incl. `SAOC-2027-5KYDSBMT38KX`,
  `SAOC-2027-R06HZ12P06EY`, `SAOC-2027-G08QJQK278NY`): paid at gateway, never flipped, no
  reconciliation, no alert.
- **P2 invisible focus ring** on buttons over cream (WCAG 2.4.7) — site-wide, affects Buy Ticket.
- **P2 two live contract locations** (`contracts/` 83 files vs `specs/` 33) caused a duplicated
  vendor feature. Only Codex caught it, because it reviews diffs not contracts.
- **P2 no reply_to** — fixed this session.
- ugrep note: `-P` works here; `-z` is DECOMPRESS not null-data, so `grep -Pzo` exits 2.

## AWAITING BRAD

1. **Did the confirmation email for `SAOC-2027-5DEFEKCF6S1R` arrive?** (closes F3 properly)
2. **F4 door scan** — 90 seconds, protocol written, needs his admin sign-in.
3. **Reconciliation Phase 1 scope**: confirm flag-only / never auto-settle.
4. **PayFast Transaction Query API** — invest in verifying it for future auto-settle, or not.

## PROCESS NOTES

- Codex found 2 real defects that were in NO contract's scope (a harness breaking `next build`
  while the gate read 7/7; an orphaned contract importing a symbol that no longer exists).
  Contract-scoped review is necessary but not sufficient.
- Several `next build` failures tonight were parallel-agent contention on a shared `.next`,
  not real. Check whether an error names a file outside the diff before believing it.
