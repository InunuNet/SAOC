# Payment provider seam, F1 — decision record

Mission `payment-provider-seam`, feature F1. Contract: `contracts/contract-payment-seam-f1.yaml`.

F1 defines a gateway-neutral `PaymentProvider` interface in `lib/payments/` and stands up PayFast
as its first adapter. **It is a pure, additive move.** No behaviour changes, and neither API route
is touched — route rewiring is F2.

---

## What each golden pins, and why

| File | Pins | Why it has to exist |
|---|---|---|
| `payfast-wire.golden.json` | Every byte that goes on the wire today: the eight outbound field names **in order**, their values, the outbound parameter string, the outbound MD5 on the passphrase-present / passphrase-absent / empty-passphrase paths, the full inbound ITN field set in posted order (blanks included), the inbound parameter string, both inbound digests, the two constants (`/eng/process`, `/eng/query/validate`), the four ITN source hosts, the builder-divergence vectors, and the status mapping. | The move is only safe if "identical" is *checkable*, not asserted. Every value here was produced by **executing the real pre-move code** (`lib/payfast.ts` at `b5ab57a2…`, the two routes at `b458ed70…` / `a71f9505…`) on 2026-08-19 — not transcribed from documentation, and not recomputed by the same code the checks test. |
| `interface.golden.md` | The normative `PaymentProvider` surface: file layout, every type declaration, per-method behaviour tied to the line it comes from today, and the explicit out-of-scope list. | A2/A11 compile and run against these exact declarations. Without a normative source, "the interface" would be whatever @dev happened to write, and the contract would be checking the implementation against itself. |
| `fail-closed-guards.golden.md` | Exact status codes, JSON bodies, log lines, falsiness semantics and **source position** of every refusal, plus the eleven-step ITN validation sequence with each step marked provider-owned or ours. | F2 will start producing these refusals from a provider result instead of an inline `if`. This is the byte-exact thing F2 gets held to. It also records *why* each guard is shaped the way it is, so a later "simplification" has to argue with a reason rather than a shrug. |
| `contracts/checks/payment-seam-f1/*` | The executable half. | — |

Credentials in every golden and check are fabricated. `10000100` is PayFast's own published sandbox
demo merchant id. Nothing here is a real SAOC credential, and no check reads `process.env` or makes
a network call — env, `fetch` and DNS resolution are all injected.

---

## The assertion bar, applied

This project's dominant defect class is **an assertion satisfiable by something that is not the
property under test**. The bar set for F1 was: *any assertion that would pass equally against the
pre-move and post-move code is worthless and must be rewritten or deleted.*

Applied literally, that killed the two assertions this project reaches for by reflex. `pnpm lint`
and `pnpm type-check` both pass today, unchanged, so neither can be evidence of anything F1 does.
They survive only as **A12, explicitly labelled a hygiene gate**, with the contract saying in as
many words that it may not be cited as proof the seam works. Compile-level proof that actually
discriminates lives in A11 instead, which imports `lib/payments/` and therefore cannot resolve
against unfixed code.

Ten of the twelve assertions were **observed failing against the current tree on 2026-08-19**:

| | Observed |
|---|---|
| A1-A7, A11 | exit 1 (A11: exit 2) — `lib/payments/` does not exist, imports unresolved |
| A8 | exit 1 — `FAIL A8: lib/payments/types.ts does not exist` |
| A9 | exit 1 — `FAIL A9: lib/payments/ does not exist` |

A10 and A12 are the two that pass now, and each is honest about why. A10 is a **ban** — it passes
because the ban has not yet been crossed — so it was observed failing by construction on
2026-08-19: appending a single newline to `app/api/tickets/checkout/route.ts` turned it red
(`expected b458ed70… actual 68bb2f3d…`), and `git checkout --` restored it to green. A12 is the
hygiene gate and claims nothing.

That leaves **eleven of twelve assertions with recorded failing evidence against unfixed code**,
and the twelfth labelled as not being evidence at all.

Three shapes were deliberately avoided:

- **No `agent_review` assertions.** Not one. Every property in F1 is mechanically checkable, so
  every check is `command:`.
- **No membership-instead-of-order checks.** A1 asserts `Object.keys(fields)` equals an ordered
  array. A set-equality check would pass against a reordered field list — and field order *is* the
  PayFast signature base string, so that check would be precisely the defect class named above.
- **No "the function is called" greps.** A3 could have grepped for two function names in the
  adapter. Instead it observes the algorithms' *divergence through the seam's own surface*, so an
  adapter that imports both names and then uses the wrong one still fails.

Every check that asserts a rejection also asserts an acceptance first, as a named positive control
(A1 case 1, A2 case 1, A4 case 1, A5 case 1, A6 case 1, A7 case 3). A harness that rejected
everything — the false-green shape this project hit on F4's A3, F5's A3 and F7's A2 — fails those
loudly instead of passing silently alongside the rejections.

---

## Why the interface has six members, not the four in the brief

Two members go beyond the brief. `readiness(operation)` is the sixth, added by F2 and justified in
full in `interface.golden.md`, "`readiness` — the sixth member, and why the route needs it": without
it the route cannot refuse an unconfigured gateway BEFORE reserving, because `initiate()` needs a
booking reference that only exists after the write. `confirmNotification` is the fifth, and this is
its whole justification:

**Today's ITN route performs PayFast's server-confirm round-trip at step 8 of 11 — after the amount
check and after the already-settled short-circuit — not as part of signature verification (step 2).**
Folding it into `verifyNotification` would move a network call earlier in a security sequence and
fire it on notifications the current code never confirms at all. F1 forbids behaviour change, so
the seam must be able to express that ordering, and a four-member interface cannot.

It is not a PayFast leak. All three target gateways have an out-of-band confirmation step —
PayFast's `/eng/query/validate` postback, Ozow's transaction-status query, Peach's `resourcePath`
GET, which is Peach's *primary* status source rather than a belt-and-braces check. It is therefore
required rather than optional: an adapter with no such step returns `{ confirmed: true }`
explicitly and says so in a comment, instead of the interface making fail-open the default.

## Other judgement calls

**`lib/payfast.ts` is not moved.** The mission says to move the *inlined* PayFast logic; the
primitives in `lib/payfast.ts` were already extracted, and four other contracts' check scripts
import them by that exact path. Relocating them would churn three green gates for no F1 benefit.
The adapter composes them. A10 pins the file so the decision is enforced rather than hoped for.

**`grossAmount` is an unparsed string, and the provider never compares amounts.** Today the route
does `Math.abs(Number(amount_gross) - orderAmount) >= 0.01` against an amount it read from
Firestore. The provider has no access to our order and no business deciding whether an amount is
acceptable. It reports what the gateway said; the route decides. Same reasoning keeps the order
lookup, the idempotency short-circuit, the transactional write and the confirmation email out of
the seam entirely.

**`sourceIpTrusted` is advisory and nullable.** The source-IP check went log-only on 2026-08-18
after a real, correctly-signed sandbox ITN arrived from `35.219.200.118`, outside the resolved host
set — enforcement was rejecting genuine payments. The seam records the fact and can never let it
flip `verified`. A2 case 10 asserts exactly that, because a future adapter author reading
"sourceIpTrusted" without the history would reasonably assume it is meant to gate acceptance.

**`refund` is a signature with an honest refusal.** There is no refund code in this repository —
grepped across `app/` and `lib/` on 2026-08-19; the only hits are marketing copy on `/refunds`. A
pure move cannot move what does not exist. Writing a real PayFast refund integration here would add
behaviour under cover of a refactor: reachable by no route, exercised by no live test, verifiable by
nobody. A7 asserts the refusal shape *and* that zero network calls are attempted.

**Env is read per call, not at construction.** Firebase App Hosting supplies these variables with
runtime availability only — the same constraint that makes `resolveSiteUrl()` a function rather
than a module-scope const in the checkout route. A factory that snapshots `process.env` at import
time would refuse every real purchase in production while passing every offline test that sets env
before importing. A4 case 5 is the only assertion that catches it, and it catches it by calling one
instance twice against a mutated env object.

---

## Found while writing this contract — flagged, NOT fixed

### The stale ITN pins

`app/api/tickets/itn/route.ts` currently hashes to `a71f9505…`. All four contracts that pin it are
stale:

| Golden | Pinned | Matches? |
|---|---|---|
| `ticketing-f1-show-collision/itn-route.golden.sha256` | `253c15c4…` | no |
| `ticketing-m1-m2/itn-route.golden.sha256` | `253c15c4…` | no |
| `ticketing-f10-itn-repin/itn-route.golden.sha256` | `553f67d8…` | no |
| `ticketing-hardening/itn-route.golden.sha256` | `553f67d8…` | no |

The drift is almost certainly the 2026-08-18 source-IP change, which the route's own comment
documents but which was evidently never re-pinned. Two consequences:

1. **Four contracts have a red assertion right now** that nobody is looking at. That is worth
   knowing independently of this mission.
2. **It blocks F2**, which reopens that file. The re-pin ceremony — architect-authored expected
   file, @dev makes the source byte-identical to a file @dev did not author, @dev never computes
   the pin value — has to be planned into F2's contract, and whoever writes it must decide whether
   the current content is the intended baseline or whether the drift is itself an unreviewed
   change. F1 does not touch it: a re-pin is a ceremony, not an in-passing edit.

### Things that cannot be moved without a behaviour change

Nothing in F1 hit this — the move is clean — but three couplings are recorded because F2 *will*
hit them:

1. **The ITN passphrase guard and the checkout merchant guard are not symmetric.** Checkout has no
   passphrase guard at all: it passes a possibly-`undefined` passphrase into `generateSignature`,
   which folds it in only when truthy. The ITN route *does* guard, because an unset passphrase
   there degrades verification to a plain MD5 over publicly-known fields. The asymmetry is correct
   and F1 preserves it exactly (A1 case 2 vs A2 case 7). F2 must not "tidy" it into one guard.
2. **`AMOUNT_MATCH_TOLERANCE`, the order lookup and the already-settled short-circuit sit between
   signature verification and server-confirm.** They cannot move into the provider, and the
   provider's six members are shaped the way they are so that F2 can reproduce that interleaving
   unchanged.
3. **The `RECOVERY_TOKEN_SECRET` guard is load-bearing by source position.**
   `contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh` proves it by
   textual position relative to the reservation write. Moving it — into the seam or anywhere else —
   breaks another contract's green gate. A9 asserts both that it stayed out of `lib/payments/` and
   that it is still in the route.

---

## What this contract does NOT prove

- **That a real PayFast sandbox purchase still completes.** Every check here is offline: no
  network, no DNS, no Firestore, no `process.env`. That is deliberate — it makes them fast and
  re-runnable — but a green gate has never been sufficient evidence on this subsystem, and is not
  here either. F3 owns the live proof, re-run against the deployed site with Firestore and Cloud
  Logging cross-checked, and its assertions must be re-runnable against a *fresh* purchase rather
  than tied to one historical booking reference.
- **That the routes produce the right HTTP responses.** No route is touched in F1 and no check
  makes an HTTP request to one. `fail-closed-guards.golden.md` records the response shapes for F2
  to be held to; F1 only proves the adapter returns the `reason` codes those shapes map from.
- **That the seam is sufficient for Ozow or Peach.** The interface is *drawn against* all three
  gateways' published shapes, but only PayFast has an adapter. The first real second adapter is the
  test of the design, and F4's `docs/payment-seam.md` must state plainly what a second gateway
  would have to implement so that test is a short one.
