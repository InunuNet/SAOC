# F4 spec: door rejects test-mode tickets (SEC-06), re-based on main ada42c41

Mission nos-security-tiered-access M1/F4. Branch fix/door-reject-test-tickets (PR #69, base main).
Spec, contract and goldens only. Product code is the dev's job.

## DECISION

1. Land PR #69 on current main as is, plus ONE new module and three one-line call-site swaps (below).
2. Legacy untagged documents: keep the existing admit-list rule. The door admits only a ticket whose
   `issuedInTestMode` is the literal boolean `false`, once `isTicketingTestMode()` is false. Missing,
   null, 0, "false", {} and [] all refuse. Untagged = test. Rejected alternative: a go-live cutoff
   timestamp (see ANALYSIS).
3. The stamp is no longer derived from `isTicketingTestMode()` alone. New `lib/ticket-issuance-mode.ts`
   exports `isIssuanceTestMode()` = `isTicketingTestMode() || PAYMENT_GATEWAYS_SANDBOX_ONLY`. A new
   order or ticket is stamped `false` only when BOTH the launch constant and the sandbox-only flag are
   flipped.

## ANALYSIS

### Merge map (git merge --no-commit --no-ff origin/main, then abort)

No conflicts. Textual merge is clean ("Automatic merge went well"). Auto-merged: `docs/launch-checklist.md`,
`types/index.ts`. Main since the PR base touched neither checkin.ts nor the builders in ways that clash.
Per-file resolution intent, so the dev can verify after merging (merge main into the branch, never rebase):

| file | #69 change | on merge |
|---|---|---|
| `lib/checkin.ts` | guard call after the wrong-show refusal, `test_ticket` refusal | takes cleanly; no change |
| `lib/checkin-test-ticket-guard.ts` | new, strict `!== false` rule | no change |
| `lib/checkin-audit.ts`, `app/api/admin/checkin/route.ts` | `test_ticket` outcome, `code` in refusals | takes cleanly |
| `lib/checkout-reservation.ts` | stamp in both builders | takes cleanly; F4 swaps the source of the value (below) |
| `lib/orders.ts` | stamp + replay-preserves-provenance read in `createOrderWithPosition` | takes cleanly; same swap |
| `types/index.ts` | optional `issuedInTestMode` on Order and Ticket | auto-merged; confirm both fields remain after merge |
| `docs/launch-checklist.md` | item 6 under the payment steps | auto-merged; edit item 6 per the doc section below |
| `docs/door-reject-test-tickets.md` | new | extend with the legacy and gateway sections |

Changes since the PR base that do NOT touch these files: #150 vendor admin view, #151 `live` Sanity reads.
Neither reads or writes tickets, orders or the check-in path. No interaction.

### PR #75 (fix/door-day-aware): still OPEN, not merged

`git merge-base --is-ancestor` shows #69's head is inside #75's history: #75 is stacked on #69 and carries
its guard (same call site, same position before the day decision). `git merge origin/fix/door-day-aware`
into #69's head is also clean. Consequences:
- Merge order: #69 first (it is the smaller, SEC-06 launch blocker), then #75. Merging #75 alone would
  land the guard through the back door without this F4 work, so do not merge #75 before #69.
- After #69 is updated by F4, #75 must merge #69 again to pick up the new module. The only overlap
  files are `lib/checkin.ts`, `lib/checkin-audit.ts`, the check-in route, `types/index.ts`,
  `docs/launch-checklist.md` and `contracts/checks/door-reject-test-tickets/admission.test.mjs`. F4
  edits none of the first five beyond what #69 already has, and edits the sixth (one stub line, below).
  Expect a trivial text merge in `admission.test.mjs` only.
- #75's `checkInByBookingRef(ref, deps)` gains `getContext`. The new `legacy-and-stamp.test.mjs` calls
  `checkInByBookingRef('ref')` as on #69. After #75 lands, the dev of whichever feature merges second
  adds the `getContext` dep exactly as #75's commit 194be469 did for the #69 suite. Do not change the
  guard position: it must stay before the day decision so a legacy ticket is never told "wrong day".

### The legacy gap

Prod today: 48 orders (17 paid, 31 reserved), 64 tickets, no marker anywhere (live probe, audit
2026-10-29). The 17 paid orders were settled through Ozow sandbox (`OZOW_IS_TEST = 'true'`,
lib/payments/ozow.ts:87). A rule keyed on "marker is true" would admit all of them after go-live.

The branch guard (`lib/checkin-test-ticket-guard.ts`) is already the safe shape: reject when
`liveMode && issuedInTestMode !== false`. The gap is closed by keeping that shape. New golden rows pin
it at door level with prod-shaped documents (`legacy-untagged.json`): paid, reserved, checked-in and comp
tickets with no marker, plus null, "false" and 0, all refused live; explicit `false` admitted.

Recommended: strict literal-false admit-list (untagged = test). Reasons: no new constant to coordinate at
go-live; no clock; the safe state needs no data change, and no backfill is possible by mistake because the
guard never reads a default; the only way for a document to be admitted is for the server to have written
literal false at creation.

Alternative: a go-live cutoff (`LIVE_SINCE` timestamp; reject any ticket whose `purchasedAt` precedes it,
whatever its marker). Not chosen: it needs a hand-set date in the same commit as the launch flip, a wrong
date either admits sandbox tickets or rejects real ones, and `purchasedAt` is also set on reservations.
It could be added later as defence in depth; it does not replace the marker.

Cost of the recommendation: every ticket that is legitimately real but untagged is refused. There are none
by construction (below), but pre-launch comps are tagged `true` and are refused too; the launch checklist
already says to re-issue them.

### How a real order is guaranteed to carry `false`

Today's stamp is `isTicketingTestMode()`, i.e. `!TICKETING_PAYMENTS_LIVE`. That is not enough: go-live in
lib/ticketing-test-mode.ts says the constant flips "together with the payment adapters", but nothing couples
them. If the constant is flipped while the adapters are still sandbox (`OZOW_IS_TEST = 'true'`, sandbox
credentials in apphosting.yaml), new sandbox-paid orders are stamped `false` and the door admits them. That
is the same hole SEC-06 describes, one flip later.

Fix: `lib/ticket-issuance-mode.ts` (new, client-safe, no env, no I/O)
```
export const PAYMENT_GATEWAYS_SANDBOX_ONLY = true;
export function isIssuanceTestMode(): boolean { return isTicketingTestMode() || PAYMENT_GATEWAYS_SANDBOX_ONLY; }
```
Both builders and `createOrderWithPosition` use `isIssuanceTestMode()`. The door keeps
`liveMode: !isTicketingTestMode()` (the committee-testing behaviour is unchanged). The flag is flipped to
`false` only in the reviewed go-live commit, with the adapters. `gateway-coupling.sh` fails the build if
the flag is `false` while `lib/payments/ozow.ts` or `payfast.ts` still show a sandbox marker, so the flip
cannot happen alone. Stamp matrix (golden): `false` only in the row where both switches are live.
AMENDMENT 2 (orchestrator decision; supersedes the first amendment, which put the flags in the adapters and broke
`pnpm build`: builders -> ticket-issuance-mode -> payfast.ts -> node:dns reached a client bundle). The flags live in a new
import-free leaf, `lib/payments/sandbox-mode.ts`: `export const OZOW_SANDBOX_MODE = true;` and
`export const PAYFAST_SANDBOX_MODE = true;`. Allowed `lib/payments` changes, and only these (comments aside):
that file; in ozow.ts the flag import and `const OZOW_IS_TEST = String(OZOW_SANDBOX_MODE);` replacing
`const OZOW_IS_TEST = 'true';`; in payfast.ts the flag import and, at the start of `initiate`,
`if (!PAYFAST_SANDBOX_MODE) return { ok: false, reason: 'not-configured' };` (fail closed). `lib/ticket-issuance-mode.ts`
imports both flags from the leaf only and computes `PAYMENT_GATEWAYS_SANDBOX_ONLY = OZOW_SANDBOX_MODE || PAYFAST_SANDBOX_MODE`.
`adapter-guard.mjs` has three modes: `coupling` (leaf, stamp, IsTest and fail-closed agree), `client-safe` (the stamp module
imports nothing from lib/payments but the leaf, no node: module, no dynamic import) and `diff` (rejects any other
lib/payments change). `adapter-mutation.mjs` proves each bites. The flags stay true; this feature does not launch
payments. At go-live the flags are flipped together with the credentials and URLs they guard.

AMENDMENT 3 (SAOC lead request): the admin toggle `adminSettings/ozowSandboxTestMode` joins the rule. A document is stamped
`issuedInTestMode: true` if ANY of these says test or sandbox: the launch constant (`isTicketingTestMode()`),
`OZOW_SANDBOX_MODE`, `PAYFAST_SANDBOX_MODE`, or the toggle as read at checkout. An R0.01-paid order is therefore never admitted
live, and the toggle can never switch issuance to live while a constant says sandbox. A toggle value that is not literally
`false` (missing, unread) counts as on. Comps are admin-issued, never gateway-paid, and carry no toggle term (explicit `false`).
The R0.01 override (`resolveExpectedGatewayAmount` / `resolveOzowInitiateAmount`) is unchanged.

Code delta for the dev, exact text (the guards pin it):
1. `lib/ticket-issuance-mode.ts`:
   `export function isIssuanceTestMode(options: { ozowSandboxTestMode: boolean }): boolean { return isTicketingTestMode() || PAYMENT_GATEWAYS_SANDBOX_ONLY || options.ozowSandboxTestMode !== false; }`
2. `lib/checkout-reservation.ts`: `ozowSandboxTestMode: boolean;` (required) on `BuildReservationDocsInput` and
   `BuildMultiReservationDocsInput`; both builders stamp `isIssuanceTestMode({ ozowSandboxTestMode: input.ozowSandboxTestMode })`.
3. `lib/orders.ts` `createOrderWithPosition`: `isIssuanceTestMode({ ozowSandboxTestMode: false })`.
4. `app/api/tickets/checkout/route.ts`: pass `ozowSandboxTestMode: <the value from the existing isOzowSandboxTestModeEnabled() read>` in the
   `buildMultiReservationDocs({ ... })` call; thread it as a parameter if the call is outside that scope. No new Firestore read.
5. `docs/launch-checklist.md` go-live note: the single go-live commit flips `TICKETING_PAYMENTS_LIVE`, `OZOW_SANDBOX_MODE` and
   `PAYFAST_SANDBOX_MODE` (with credentials and URLs), and the `ozowSandboxTestMode` toggle is turned off at the same deploy.
   (Backlog P1 is recorded.)
F3 note: the two builder input types gain one required field. If F3 adds fields to them it must keep `ozowSandboxTestMode`.

A reservation is stamped at creation and never relabelled (settlement preserves it, #69 behaviour). A real
paid order therefore carries `false` exactly when it was created after the full go-live. Ozow
`ozowSandboxTestMode` (adminSettings) is an amount toggle, not an environment marker, and is not used.

Residual risk, stated: the 31 reserved prod orders are unmarked. If one were somehow settled after go-live
it stays untagged and the door refuses it. They are expired holds; F3 (SEC-18) reconciles them. SAOC
should cancel them (hand-off 2).

## SPECIFICATION (dev)

1. In a subshell: `git merge origin/main` into fix/door-reject-test-tickets (no rebase, no force-push).
   Expect no conflicts; confirm the table above.
2. Add `lib/ticket-issuance-mode.ts` and `lib/payments/sandbox-mode.ts` as in AMENDMENT 2.
3. `lib/checkout-reservation.ts`: replace the import with `isIssuanceTestMode` and the two lines
   `const issuedInTestMode = isTicketingTestMode();` with `isIssuanceTestMode()`. Update the header comment
   (lines 11-13) to name the new module. NOTHING else in this file.
   `lib/orders.ts`: the same import and one-line swap in `createOrderWithPosition`. NOTHING else.
4. Leave `lib/checkin.ts`, the guard and the route untouched.
5. Docs: `docs/door-reject-test-tickets.md` gains "Legacy documents" and "Gateway coupling" sections;
   `docs/launch-checklist.md` item 6 gains: flip `PAYMENT_GATEWAYS_SANDBOX_ONLY` with the adapters; hand-off
   items from this spec.
6. Do not run any backfill, do not touch the launch constant, and edit `lib/payments/**` only as the amendment above allows.

### F3 coordination (lib/checkout-reservation.ts)

F4's only hunks there: the import line, the doc comment at lines 11-13, and the two
`const issuedInTestMode = ...` lines (one in `buildReservationDocs`, one in `buildMultiReservationDocs`),
plus the existing `issuedInTestMode,` fields inside the order/position literals that #69 already added.
F3 (SEC-02 seat-hold limits, SEC-18 expiry at read time) may freely touch: `expiresAt` handling, hold-count
or limit logic, new input fields and types (`BuildReservationDocsInput`, `BuildMultiReservationDocsInput`),
`writeReservationPair` / `writeMultiReservationPair`, and any new helper above or below the builders. F3
must keep the `issuedInTestMode` lines and the `isIssuanceTestMode()` import intact if it rebases on
this branch, and must not move them. The F4 test constructs the builders with the existing input shape; if
F3 adds a required input field, F3 updates `builderInput` in `legacy-and-stamp.test.mjs` and
`admission.test.mjs` (one line each).

## SAOC hand-offs (NOS Site never writes prod data)

1. No backfill. Do NOT set `issuedInTestMode` on any existing order or ticket in prod. Absent is the safe state.
2. Before go-live, cancel the 31 expired `reserved` orders and their tickets (or let F3's reconcile do it).
3. Before go-live, void or purge the 17 sandbox-paid orders and their tickets (SEC-06 fix sketch). Not required for
   door safety after this change, required for clean reporting and so no sandbox PDF or QR is left in circulation.
4. At go-live, flip in ONE reviewed commit: `TICKETING_PAYMENTS_LIVE`, the payment adapters and credentials, and
   `PAYMENT_GATEWAYS_SANDBOX_ONLY`. After deploy, make one real-money R-minimum purchase, confirm the new ticket doc
   in Firestore has `issuedInTestMode: false`, and scan it at the door.
5. Vendor stand orders (SEC-06 second half) are out of scope for F4: they have no door path. Route to the
   stand-allocation owner (SAOC).

## RISKS

- Flag is a manual constant: mitigated by the coupling check, not eliminated. A flip of the launch constant
  alone is now safe (tickets stay `true`, door rejects all, shop looks live but cannot admit) which is the
  desired failure direction, and loud in the post-deploy test purchase.
- Dev forgets to swap `createOrderWithPosition` (comp path): mutation `orders-bypasses-helper` kills it.
- Committee testing: unchanged. Test mode stamps `true` and the door allows everything.
- #75 merge-order mistakes (above).
