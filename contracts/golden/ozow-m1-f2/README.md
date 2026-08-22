# ozow-payment-provider — M2/F2 (checkout wiring) decision record

Full spec: `.agent/memory/project/specs/ozow-payment-provider/spec.md` (§2, §3 M2). This file
records what the architect verified while turning that spec into `contract-m1-f2.yaml`'s
assertions, including one real defect found that the mission brief and spec did not name.

## 1. The registry (A1)

`lib/payments/index.ts` today (pre-F2) exports one const, `paymentProvider: PaymentProvider`,
hardwired to `payfastProvider`. The spec's own snippet (§2.2) is adopted verbatim:

```ts
export const paymentProviders: Readonly<Record<string, PaymentProvider>> = {
  payfast: payfastProvider,
  ozow: ozowProvider,
};
export function resolveProvider(id: string): PaymentProvider | null {
  return Object.prototype.hasOwnProperty.call(paymentProviders, id) ? paymentProviders[id] : null;
}
```

`Object.prototype.hasOwnProperty.call(...)` is load-bearing, not decoration: a naive
`paymentProviders[id]` lookup resolves `'constructor'`, `'toString'`, `'__proto__'` etc. to
inherited `Object.prototype` members, which are truthy and NOT `null` — a caller checking
`if (provider)` would treat a poisoned lookup as a valid provider. A1's check
(`check-registry.mjs`) tests this directly (case 4) and was mutation-verified: a bracket-lookup
without the guard fails 4 of its cases.

## 2. providerId validation — where, not just whether (A2)

The mission brief and spec both say "400, never a silent PayFast default" but neither pins WHERE
in `checkout/route.ts` the check must run. This matters because the route already has an early
Sanity-configuration guard (`if (!client) { ... 500 'CMS is not configured' ... }`) that today runs
before any gateway logic. Architect decision: **providerId validation must run immediately
alongside the existing `showId`/`lineItems` validation, strictly before the `client` check** — not
merely "before the reservation write" (which `readiness('initiate')` already occupies, much
later).

This positioning is what makes `check-providerid-fail-closed.mjs` provable **entirely offline**:
with `NEXT_PUBLIC_SANITY_PROJECT_ID` unset, `client` is `null` and the route's own pre-existing
code already 500s at that point. A request with a valid `providerId` must walk PAST the new gate
and land on that PRE-EXISTING 500 (the check's "control" cases, 8-9) — proving the gate ran and
passed. A request with an invalid `providerId` must 400 with its own text (cases 1-7) and must
NEVER reach that Sanity-config 500. If providerId validation were placed later (e.g. immediately
before `paymentProvider.readiness('initiate')`), every case in this script would collapse onto the
same 500 and the check would not discriminate — this positioning requirement is therefore itself
part of what @dev must implement, not just a testing convenience.

**Observed failing against the pre-F2 route on 2026-08-22**: all 6 invalid-providerId cases return
500 "CMS is not configured" instead of 400 (the route has no `providerId` concept at all yet).
Verified passing against a reference fix (git worktree, discarded after verification) placing the
gate at the specified position. Verified the check catches the exact "silent default to payfast"
defect the brief names: a mutation resolving any invalid `providerId` to `'payfast'` instead of
400ing was caught (4 of 6 invalid cases quietly succeed to the same not-configured 500 a valid
`payfast` request would produce — indistinguishable from the correct control case, which is exactly
why this is the dangerous form of this defect).

## 3. `order.gateway` — the defect neither the brief nor the spec named (A3)

Reading `lib/checkout-reservation.ts` while writing this contract surfaced a real, unflagged
finding: `types/index.ts:207` already has an order-level `gateway: string | null` field — exactly
the "which provider was this order created against" concept the spec's §2 point 3 describes as "a
new field, additive, not a schema break." **It is not a new field.** It already exists, and both
`buildReservationDocs()` and `buildMultiReservationDocs()` (the one `checkout/route.ts`'s
`reserveTicket()` actually calls) write it as the hardcoded module constant `PAYFAST_GATEWAY`,
never read from any input, as of 2026-08-22 — before this feature touches anything.

Left alone, F2 would let a buyer choose Ozow, pay through Ozow, and have their order permanently
record `gateway: 'payfast'` in Firestore — wrong data on every Ozow order, invisible to every other
assertion in this contract (A1/A2 both test *selection*, never the *write*), discoverable only by a
human reading Firestore directly. `check-gateway-threading.mjs` (A3) is the fix's own regression
net: both `BuildReservationDocsInput` and `BuildMultiReservationDocsInput` gain a required
`gateway: string` field, threaded from the SAME resolved `providerId` A2 validates, replacing the
`PAYFAST_GATEWAY` literal in both constructors' output.

**Observed failing against the pre-F2 code on 2026-08-22** (real command output, not simulated):
`case 1: buildReservationDocs writes gateway="ozow" ... actual: "payfast"` and the matching case 3
for `buildMultiReservationDocs`. Verified passing against a reference fix (scratch copy, `tsx`-run
directly against `lib/checkout-reservation.ts` with a patched `gateway` field, discarded after
verification) and verified the check catches a mutation that accepts-but-ignores the field (patched
`buildMultiReservationDocs` back to the hardcoded constant while leaving the input type change in
place — case 3 alone failed, exactly the "accepted the field, dropped it on the floor" shape a
weaker "the type has a gateway field" assertion would miss).

## 4. Two dedicated routes, one shared helper (A5/A6)

Spec §2 point 4 rejects a single route branching on a query param/path segment in favour of two
thin routes calling one extracted helper. `check-notification-routing-shape.sh` proves the actual
shape: both new files exist, both import the SAME symbol from the SAME module
(`lib/tickets-notification.ts`), each route names exactly one provider (never both — a route
naming both is exactly the branching shape rejected), each route body is ≤40 non-comment,
non-blank lines (a thin pass-through, not a duplicated 11-step reimplementation), and the rejected
query-param/`[provider]`-segment shape has zero footprint anywhere under `app/api/tickets/`.

Mutation-verified (scratch git worktree, discarded after verification): a correct two-route/shared-
helper implementation passes cleanly; mutating the PayFast route into a query-param-resolved single
route is caught on two independent grounds — it no longer statically references `payfast` alone
(case (e)), and the query-param pattern itself is directly detected (case (g)).

**The extracted helper's internal step order is not re-derived by a new script.**
`contracts/checks/payment-seam-f2/check-sequence-and-ownership.sh` already supports
`ITN_PATH_OVERRIDE` (built originally for `check-ordering-mutations.sh`'s mutation harness) — its
11-landmark ordering assertion is re-run unchanged with
`ITN_PATH_OVERRIDE=lib/tickets-notification.ts`, pointed at wherever the logic now actually lives,
rather than hand-copying the same 11 landmarks into a second, divergence-prone script.

## 5. PayFast regression proof (A4)

"PayFast's route stays at its EXACT current path, completely unchanged" cannot mean byte-identical
after this refactor — the whole point of F2 is to move its logic into a shared helper. The
regression claim this contract actually makes is **behavioural**, proven by re-running, UNMODIFIED,
the existing suites that already exercise the real exported `POST()` through real signed bodies and
real Firestore writes rather than re-deriving new ones:
`contracts/checks/payment-seam-f2/check-itn-behaviour-unchanged.sh`,
`check-reject-paths-behavioural.mts`, and the four `payfast-m1` ITN scripts
(`check-itn-amount-tamper-rejected.mts`, `check-itn-atomic-idempotent-write.mts`,
`check-itn-server-confirm-and-status-gating.mts`, `check-itn-source-ip-validation.mts` — note the
last one's own header already documents it as observed-passing only via `order-not-found` since
2026-08-18's source-IP-advisory-only change; it is re-run for continuity with the existing suite,
not as new evidence). None of these six scripts assert anything about the route FILE's shape —
only about what a real POST to the real path does — so they are the right instrument for "PayFast's
observable behaviour did not change," while `check-repin-ceremony.sh`'s sha256 pin and
`check-sequence-and-ownership.sh`'s IN-ROUTE landmark ordering (both scoped to the pre-F2 route's
exact file contents) are deliberately NOT re-asserted against the thin post-refactor route — they
pinned a shape this feature intentionally changes, and re-running them would be asserting the
refactor didn't happen.

## 6. UI scope (A8/A9)

CLAUDE.md forbids inventing brand assets; the spec (§4) explicitly permits F2 to ship a
functional radio/toggle without a Claude Design handoff, provided it uses only existing tokens.
`check-no-new-brand-tokens.sh` is scoped to the files this feature actually touches (the checkout
hand-off UI, plus anything matching `*provider*` under `components/tickets/`) rather than the whole
directory — a directory-wide scan false-positives on `DownloadTicketButton.tsx`'s unrelated
`<canvas>` `ctx.fillStyle` hex literals (observed 2026-08-22, not simulated). Two pre-existing
hardcoded-to-PayFast strings were found while reading these files and are in scope for A9 to catch
if left unconditional: `CheckoutRedirectNotice.tsx`'s `"...via PayFast…"` copy, and
`TicketPurchaseForm.tsx`'s submit-button label `"Redirecting to PayFast…"`.
