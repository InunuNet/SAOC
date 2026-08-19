# Payment provider seam, F2 — decision record

Mission `payment-provider-seam`, feature F2. Contract: `contracts/contract-payment-seam-f2.yaml`.

F2 rewires both ticket routes to depend only on the `PaymentProvider` interface F1 defined. The
point is not tidiness. It is that after F2 the next gateway is a config change, and the way that is
proven is a negative: **no PayFast identifier survives anywhere in either route.**

---

## What each golden pins

| File | Pins |
|---|---|
| `itn-route.expected.ts.txt` | The complete post-rewire ITN route, authored **before** any code changed. Verified `tsc --noEmit` exit 0 and `eslint` exit 0 against the interface in `../payment-seam-f1/interface.golden.md`, and verified to satisfy A1's symbol ban and A4's code-order claim. |
| `itn-route.golden.sha256` | `893dfeff…` — the post-F2 pin. @dev makes the source match this file; @dev never computes this value. |
| `itn-route.baseline-2026-08-18.sha256` | `a71f9505…` — the reviewed pre-F2 baseline. |
| `itn-route.baseline-2026-08-18.blob` | `8b8a3f71…` — the **immutable git blob** that held that baseline at the moment F2 began. |

---

## The re-pin is two steps, and they must never be collapsed

The four contracts pinning the ITN route were stale **before F2 existed**, for an unrelated reason:
the 2026-08-18 source-IP "logged, not enforced" change, reviewed and deliberate, documented in the
route's own comment, simply never re-pinned. The team lead confirmed on 2026-08-19 that the on-disk
content is the intended baseline.

If F2 just overwrote all four pins with its own new value, that history would vanish — the record
would say "F2 changed this file" and nothing would ever again show that four gates had been red for
a day and a half for an entirely different reason. So:

**Step 1 (A2) — the catch-up audit.** Proves the reviewed baseline hashes to `a71f9505…`, against
the *git blob*, not the working tree. A working-tree check would evaporate the moment F2 edits the
file; the blob is immutable, so this claim stays checkable forever. It is also the only thing that
would catch the scenario the team lead's ruling implicitly rests on: that the source-IP change was
the *only* thing that drifted, and nothing else rode in alongside it.

**Step 2 (A3) — the F2 re-pin.** Route becomes byte-identical to the architect-authored expected
file; all four downstream goldens move to `893dfeff…`. A3 additionally re-hashes the expected file
itself, so @dev cannot quietly edit the target to match whatever the code ended up being.

A2 also asserts the two values *differ* — a "rewire" that changed nothing cannot pass.

Observed on 2026-08-19: step 1 green, step 2 red on all five counts (the route, plus each of the
four downstream pins still reading `253c15c4…` / `553f67d8…`).

---

## The decisive assertion, observed failing

A1 was run against the pre-rewire tree on 2026-08-19. Abridged transcript — 18 hit classes:

```
FAIL A1: app/api/tickets/checkout/route.ts does not import the payment seam (@/lib/payments)
FAIL A1: gateway-specific vocabulary in app/api/tickets/checkout/route.ts:
    8:import { generateSignature, PAYFAST_SANDBOX_PROCESS_URL } from '@/lib/payfast';
    307:  const merchantId = process.env.PAYFAST_SANDBOX_MERCHANT_ID;
    387:    merchant_id: merchantId,
    391:    notify_url: `${siteUrl}/api/tickets/itn`,
    396:  const signature = generateSignature(signedFields, passphrase);
FAIL A1: gateway-specific vocabulary in app/api/tickets/itn/route.ts:
    12:} from '@/lib/payfast';
    214:  const amountGross = fields['amount_gross'];
    235:    const confirmResponse = await fetch(PAYFAST_SANDBOX_VALIDATE_URL, {
FAIL A1: the gateway's own status vocabulary appears in app/api/tickets/itn/route.ts:
    47:const COMPLETE_STATUS = 'COMPLETE';
FAIL A1: m_payment_id appears 19 times in app/api/tickets/itn/route.ts; exception E3 permits exactly 1
OBSERVED EXIT=1
```

Note the last line. Exception E3 permits **one** occurrence and the pre-rewire route has nineteen —
so the exception is not a loophole that pre-existing code slides through; it is a budget the rewire
has to get down to.

## The three exceptions, and why each cannot be paid off inside F2

| | Exception | Why it stays | Cost of removing it |
|---|---|---|---|
| **E1** | the path literal `/api/tickets/itn` | It is **our** route path, not the gateway's word for it. We happened to name it after PayFast's acronym. | Renaming it changes the `notify_url` already registered against in-flight reservations — payments in progress would post to a 404. A live-integration change, not a refactor. |
| **E2** | the `[tickets/itn]` log prefix | Derived from E1. | Same as E1, plus every existing log query and Cloud Logging filter. |
| **E3** | one `m_payment_id` object key | It is a **Firestore document field name** — an indexed column the `orders` collection has carried since ticketing-F2, queried by `lib/orders.ts` at three call sites. | A data migration over live documents, plus re-pinning `lib/orders.ts` in a fifth contract. Squarely out of scope. |

All three are hard-counted, so none can grow. All three are naming debt, recorded here rather than
waved through: **`/api/tickets/itn` and the `m_payment_id` column are PayFast vocabulary that has
leaked into our URL space and our data model**, and the seam does not reach either. That is worth
knowing before the second gateway lands, because it is the part the seam will *not* make painless.

---

## Why checkout is not pinned

The ITN route is pinned because it already was — four times over, and F2 cannot reopen it without
the ceremony. Checkout is not pinned by anything today, and F2 deliberately does not start.

A pin is a standing tax: every future edit needs an architect-authored expected file. The checkout
route is 509 lines, actively evolving, and the multi-line-cart work lands next — pinning it now
would mean a ceremony per cart iteration. Its PayFast surface is also small and entirely covered by
other means: one import, three env reads, one signature call and one response object, all of which
A1's ban catches, with A4 holding the recovery-secret position and the shared export. The security
sequence that justifies a pin lives in the ITN route, not here.

---

## The four downstream repoints

Rewiring the route breaks four artefacts in *other* contracts that depend on gateway internals
living inside it. Enumerated so they are repointed deliberately, not found later as red gates:

| | Artefact | Breaks because | Repoint |
|---|---|---|---|
| R1-R3 | F10's `check-signature-brutal.mjs`, `check-break-fix-field-order.mjs`, `fixtures/itn-repin-typecheck.ts` | all three `import { parseOrderedFields }` **from the route** | that function is the gateway's own inbound body parse — it moves to `lib/payments/payfast.ts` (exported, same signature) and all three imports follow it. F10's assertions keep asserting exactly what they asserted, against the same function in its proper home. |
| R4 | payfast-m1's `check-server-confirm-fetch-outside-transaction-scope.mjs` (A32) | requires a literal `fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...)` **in the route source**, which F2 necessarily removes | claim 1 repoints to the `paymentProvider.confirmNotification` call site; the `lib/orders.ts` claim is untouched. |

**R4 is the sharpest conflict in this mission and worth stating plainly: an existing green assertion
required a PayFast symbol to be in the route, and F2's decisive assertion forbids it.** One of them
had to move. A32's *intent* — the network round-trip is not inside the Firestore transaction —
survives, and F2 additionally retires the whole defect class rather than relocating it: A5 part 3
asserts the adapter touches no Firestore at all, so the confirm call now lives in a module that
**cannot** open a transaction around itself, whatever anyone later writes there.

A5 does not take any of this on trust. It re-runs all four repointed checks and requires exit 0.

---

## The enumeration defect — found three times, in this contract

A3 originally listed the four `.sha256` goldens it knew about. A5 originally listed four artefacts.
@dev updated all of them correctly and both went green. **Both were wrong**, because the same file
is also pinned and asserted by things neither list contained:

| Assertion | Form | Why the rewire breaks it |
|---|---|---|
| `ticketing-hardening` A33 | `diff` against an `.expected.ts.txt` | a second pin form for the same file |
| `payfast-itn-signature` A5 | greps the route for `generateNotifySignature(fields, passphrase)` | that call moves into the adapter |
| `payfast-itn-signature` A6 | greps the route for `body: buildPayfastNotifyParamString(fields)` | same move |
| `payfast-m1` A17 | greps the route for `generateSignature\|validateSignature\|signature` | **direct collision with this contract's own A1**, which bans that word from route files including comments |

**A3 asserted its own completeness while being incomplete.** That is this project's dominant defect
class — a check satisfied by a proxy (the list I wrote) rather than by the property (every
assertion for this file is current) — occurring inside the contract written to hunt it. Three
instances, one contract.

Enumeration cannot be the fix for a defect caused by enumeration. A3 and A5b now derive the set
from `discover_route_pins.py`, which reads every contract's assertion commands **through a YAML
parser** — never a grep, so a `command:` quoted inside a `description:` cannot register. Zero
discovered assertions is itself a failure: it would mean the target moved or discovery broke, and a
green there would be meaningless.

`UNKNOWN` is a first-class verdict. A pin-shaped command the grammar cannot classify is reported as
a finding, so a novel idiom surfaces the first time it runs rather than being silently skipped —
the same decay mode that produced the stale pins.

`WORKTREE`/`GITHASH` assertions (`git diff --quiet` guards) are reported **DEFERRED and explicitly
not proven**. They are red for the whole of any feature that touches the file and go green on
commit. Marking them "passed" would be a manufactured green; marking them "failed" would be noise.

### A17 versus A1 — the bill for A1's strictness

`contract-payfast-m1` A17 greps `app/api/tickets/itn/route.ts` for
`generateSignature|validateSignature|signature` and requires a match. F2's A1 bans the word
`signature` from route files **including comments** and requires no match. Both cannot hold. A17
repoints to `lib/payments/payfast.ts`, where signature verification now lives; its intent —
signature verification happens somewhere on this path — is unchanged, only its address.

Recorded here rather than resolved quietly, because A1's scope was a deliberate choice with a
price, and the price should be visible to whoever revisits it rather than discovered by them.

**What A1's comment-inclusive scope buys.** The ban is a plain `grep` over the whole file — no
comment-stripping parser, nothing to get wrong, and nothing that can be defeated by moving a
banned token into a comment. It also constrains the route's *prose*, which is what the next
developer actually reads: a route whose comments explain PayFast signature verification invites the
next author to reach for PayFast, whatever the code does. Rewriting the expected route to say
"authenticates the body against the shared secret" made it read better as gateway-neutral code.

**What it cost, concretely.** One assertion in another contract had to be repointed
(`payfast-m1` A17). The architect-authored expected route had five comment occurrences of the word
that needed rephrasing before it could satisfy its own contract. And any future author documenting
this route must describe authentication without naming the mechanism the current adapter happens to
use.

**What a future author should weigh.** Whether the constraint on prose is still buying anything
once a second adapter exists and the routes have been gateway-neutral long enough that nobody would
think to reach for PayFast; against the fact that narrowing A1 to code-only reintroduces a
comment-stripping step, and A4 — which does exclude comments, for a different and equally
deliberate reason — is the check in this contract that has needed the most fixing.

Note the two checks in this contract take opposite positions on comments on purpose: A1 includes
them because its claim is about what the file *says*; A4 excludes them because its claim is about
the order of what the file *does*. Neither is the general rule.

### An instrument that lied, worth recording

The first runner written to survey these assertions normalised each command's whitespace before
executing it. `shasum -a 256 -c -` requires **exactly two spaces** between digest and path, so four
perfectly healthy pins were reported as failures. The check now extracts commands verbatim. A
measuring instrument that silently transforms its input and then reports a fault that isn't there
is the same defect class as everything else in this document, pointed at the tooling instead of the
code.

**It failed in the safe direction, and that is the only reason it was caught.** Four unexpected
reds contradicted a direct run, so they got investigated. The identical bug in the other direction —
a transformation that makes a genuinely broken assertion pass — produces a green nobody has any
reason to question, and there is no contradiction to notice. Every instrument in this repo that
reads a command, a hash, or a file before comparing it should be assumed capable of both.

## Judgement calls

**Log text may change; log information may not.** The rewired route logs a `reason` code and the
`reference` on every rejection path instead of PayFast-flavoured prose. `fail-closed-guards.golden.md`
pinned the old strings as a record of what F2 inherited, not as a promise never to reword them. What
F2 does promise is that every rejection stays individually diagnosable and every one still carries
the reference an operator reconciles by.

**The word "signature" is banned in the route including comments.** Deliberately stricter than
banning it as an identifier. If the route's own prose talks about PayFast signatures, the next
developer reaches for PayFast. The expected file was rewritten to say "authenticates the body
against the shared secret" and reads better for it. It also keeps the check a plain grep rather than
a comment-stripping parser — the one place in this contract where the simpler check is also the
stronger one.

**A4 excludes comment lines from its ordering claim, and that is the opposite trade.** Here the
claim really is about the order of *code*: several landmarks are also named in the comments that
explain later steps, and an unfiltered search resolves the atomic write to the comment on the order
lookup that describes what the write will later do — reporting a reordering that is not there. Found
by running the check against the architect-authored expected file, which is exactly what that
dry-run is for.

**A1 going red on 2026-08-20 was real, not drift, and the fix is architectural, not a reword.**
Codex's underpayment fix (`parseAmountToCents`, string parsing, never a `Number(x) * 100` float
round-trip — the fix itself was correct) landed inside `app/api/tickets/itn/route.ts`. Its own doc
comment said why it was safe: "PayFast always sends `amount_gross` in that exact shape." That is a
route carrying a documented assumption about one gateway's wire format — exactly the coupling A1
exists to catch, and it caught it correctly. The team lead asked which side of the F1 line this
falls on: F1's `grossAmount` doc comment says "the provider never decides whether an amount is
acceptable," and A4 deliberately keeps the tolerance comparison in the route on that basis. RULING:
*parsing* a gateway's own number format into cents and *judging* whether the result is close enough
to the stored order amount are different acts. The first is a format translation — the same kind of
work `mapStatus` already does for the gateway's status vocabulary — and moves to the adapter as a
new interface field, `grossAmountCents: number | null` (A15, payment-seam-f2; full reasoning in
`contracts/golden/payment-seam-f1/interface.golden.md`, "`grossAmountCents` — the seventh field, and
why"). The second — the tolerance, the accept/reject call — stays in the route exactly where A4
already put it. This is not a new exception to A1; once the parser and its comment move to
`lib/payments/payfast.ts` (the one file A8 already permits to name PayFast), the route contains
neither the vocabulary nor the assumption, and A1 passes for the true reason rather than a reworded
one. **What was rejected:** documenting the 2dp-decimal shape as an interface-wide guarantee instead
of moving the code. That would assert, unconfirmed, that Ozow and Peach share PayFast's exact wire
format before either adapter exists — this project's own recurring defect class (CTICC, 18–21
September) wearing a new outfit.

**The `m_payment_id` comment hit at itn/route.ts:227, found in the same A1 run, is cosmetic and
ruled separately.** E3 permits exactly one occurrence of `m_payment_id` because it is OUR Firestore
field name, not gateway vocabulary — and that reasoning covers a comment that merely explains the
field as much as it covers the field itself. Fix is a comment reword ("the same payment reference"
instead of the literal identifier), not a contract change; E3's count still bounds the CODE
occurrence, the object key, at exactly one.

---

## Findings that could NOT be fixed inside F2

**A fifth stale pin.** `contracts/golden/production-blockers-f4-itn-check-repoint/orders-lib.golden.sha256`
records `47c2e83c…` for `lib/orders.ts`, which actually hashes to `a8c8b416…`. A fifth contract with
a silently red assertion, unrelated to this mission — F2 does not touch `lib/orders.ts`, so
correcting it here would be an unreviewed in-passing edit of exactly the kind the ceremony exists to
prevent. **Reported for triage, not fixed.** It should be checked whether that drift is also a
reviewed change that was never re-pinned, or something nobody has looked at.

**Both naming debts above (E1, E3)** — the `/api/tickets/itn` URL and the `m_payment_id` column —
are PayFast vocabulary the seam cannot reach. Each needs its own change with its own risk profile: a
live-integration change and a data migration respectively.

---

## What this contract does NOT prove

- **That a real sandbox purchase still completes.** A6 is the strongest offline-ish evidence — the
  pre-existing payfast-m1 suite driving the real `POST()` against real Firestore — but it exercises
  the ITN half only. Nothing here drives the checkout route end to end, because doing so needs
  Sanity and Firestore both. **F3 owns the live proof**, and a green F2 gate is not a substitute; it
  never has been on this subsystem.
- **That the interface is right.** F2 proves PayFast fits behind it, which is the weakest possible
  evidence for an abstraction — the adapter was drawn from the code it is replacing. The real test
  is the second gateway, and F4's `docs/payment-seam.md` must make that test short by saying
  exactly what a new adapter has to implement.
- **That `pnpm lint && pnpm type-check` mean anything here.** A7 is labelled a hygiene gate for the
  same reason F1's A12 was: it passes identically before and after the rewire.
