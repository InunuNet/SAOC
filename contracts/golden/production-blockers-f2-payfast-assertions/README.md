# F2 — payfast-m1 stale assertion decision record (A1, A6)

Part of the `production-blockers` mission, following the same pattern established in
the P1 weak-assertion audit (commits `808ca7b`, `0b5f0ea`, `f4a37bd`;
`.agent/memory/project/learned.md` "P1 weak-assertion audit"). No production code was
changed to produce this record — both assertions were red because the code got
better, not worse, and the assertions could not tell the difference.

## A1 — REWRITE (scope narrowed, property kept)

**Original:** `if grep -rq "stripePaymentIntentId" types app docs lib; then exit 1; fi`
— forbade the string anywhere under `types/`, `app/`, `docs/`, `lib/`.

**Why it was red:** `docs/` legitimately contains the string in migration-history
prose, not as a live field reference:

- `docs/payfast-integration.md:16` — "…`stripePaymentIntentId` field and gained
  `amount`, `m_payment_id`, and `pf_payment_id`. See…" — explains the field was
  *removed*.
- `docs/sprint-2026-08-16.md:87` — "A1 forbids `stripePaymentIntentId` anywhere in
  `docs/` and trips on the sentence in…" — a sprint note *about this very defect*,
  which necessarily contains the forbidden string to describe it.

Both are verified false positives, not the property being violated.

**Verified the property still holds and still matters:** `grep -rn
"stripePaymentIntentId" types app lib` returns zero hits (checked live against the
current tree). The underlying claim — no Stripe-shaped field survives in the data
model or application code — is true today and worth protecting against regression
(e.g. someone copy-pasting old Stripe-era code back into `app/` or `lib/`).

**Decision:** rewrite, not retire. Scope narrowed from `types app docs lib` to
`types app lib` — the three surfaces where the string is actually load-bearing.
`docs/` dropped because prose that documents a migration is not a live field
reference and grep cannot tell the two apart; scoping it out is more honest than
either silencing the sentence or leaving the check permanently red for a documentation
sentence. A live reintroduction of a Stripe-shaped field in `types/`, `app/`, or
`lib/` still fails this check exactly as before.

**Coverage note:** `contract-d3-ticket-model.yaml` D3-16 already independently
confirms the `Ticket` type declares `m_payment_id`/`pf_payment_id` (corrected in
`808ca7b` for the same underlying migration). A1's job is the broader "no Stripe
field anywhere in code," not just the type declaration; the two are complementary,
not duplicates.

## A6 — REWRITE (retargeted to where the code now lives)

**Original:** `grep -q "m_payment_id" app/api/admin/tickets/route.ts && grep -q
"m_payment_id" app/api/admin/checkin/route.ts` — required the literal
`m_payment_id` inside both admin read routes.

**Why it was red:** `app/api/admin/checkin/route.ts` no longer contains the literal.
Verified: `grep -n "m_payment_id" app/api/admin/checkin/route.ts` returns no match.
This is not a regression — `ticketing-hardening` F1 (2026-08-11, predates this audit)
extracted all check-in admission and read logic out of that route into
`lib/checkin.ts`, fixing a real defect (unpaid/wrong-show tickets could be admitted).
The route now only authenticates and delegates:

- `app/api/admin/checkin/route.ts:4` — `import { checkInByBookingRef, type
  CheckinRefusalCode } from '@/lib/checkin';` (delegation, verified present).
- `lib/checkin.ts:68` — `m_payment_id: (data['m_payment_id'] as string) ?? null,`
  (the field is read here now, verified present).
- `app/api/admin/tickets/route.ts:31` — `m_payment_id: data['m_payment_id'] ?? null,`
  unchanged, direct read, still true.

**Decision:** rewrite, not retire. The underlying property — "admin ticket read
paths still read the current field set, not stale Stripe-era or half-migrated
fields" — still matters and is still checkable by grep-on-source, the same method
the P1 audit endorsed for D3-16 ("grep-on-source is the right method when the
artifact under test IS source text," `808ca7b`). Retargeted to the three facts that
now jointly prove the claim:

1. `app/api/admin/tickets/route.ts` reads `m_payment_id` directly (unchanged).
2. `lib/checkin.ts` reads `m_payment_id` (where the delegated logic now lives).
3. `app/api/admin/checkin/route.ts` actually imports from `'@/lib/checkin'` — this
   guards against the retargeted check becoming vacuous if the route ever stopped
   delegating without anyone updating the assertion; it ties the field-presence
   check in `lib/checkin.ts` back to the route the assertion is nominally about.

No edits were made to `app/api/tickets/itn/route.ts` (sha256-pinned, untouched) or
to any other production file — both fixes are contract-only.

## TIGHTENED 2026-08-18 — QA mutation-8 finding on A6

@qa ran 8 mutations against the real source files. 7 died correctly, including both
delegation-import mutations against `app/api/admin/checkin/route.ts` (removing the
`from '@/lib/checkin'` import kills the check even when a decoy `m_payment_id`
string is left behind in a comment). **Mutation 8 survived**: deleting the real
`m_payment_id` read in `lib/checkin.ts` and replacing it with a comment that merely
contains the literal `m_payment_id` left the check green, because that leg was a
bare `grep -q "m_payment_id" lib/checkin.ts` — a substring match, exactly the
weak-assertion defect class this project's P1 audit exists to catch. A green,
vacuous assertion is worse than the red one it replaced, because red gets looked at
and green does not.

**Fix:** the `lib/checkin.ts` leg now requires the actual read-access shape present
in the file, `data['m_payment_id'] as string` (matched via `grep -Eq
"data\[.m_payment_id.\] as string" lib/checkin.ts`), following the same
field-declaration-pattern precedent A2/A3 already use elsewhere in this contract
(`grep -Eq "m_payment_id: string \| null" types/index.ts`) rather than a bare
substring.

**Re-verified by mutation, against real files with sha256-verified byte-identical
restore after each run** (backups at
`/private/tmp/claude-501/-Users-vetus-ai-SAOC/2c295099-ca67-4f9d-92bd-0939c89c932a/scratchpad/architect-f2-backups/`):

| Mutation | What it does | Expected | Observed exit code |
|---|---|---|---|
| Baseline (unmutated) | — | PASS | 0 |
| 5 | Remove the `m_payment_id` read from `app/api/admin/tickets/route.ts` | dies | 1 |
| 6 | Remove the `from '@/lib/checkin'` import from `app/api/admin/checkin/route.ts` | dies | 1 |
| 7 | Same as 6, but leave a decoy `// decoy: m_payment_id` comment in its place | dies | 1 |
| 8 | Delete the real read in `lib/checkin.ts`, replace with `// m_payment_id no longer read here` | now dies (previously survived) | 1 |

All three legs of the tightened A6 command now discriminate correctly. Mutations
5–7 (already sound before this tightening) were re-run to confirm the fix did not
regress them.

## Gate result

Ran `contracts/contract-payfast-m1.yaml`'s phase-4 assertions before and after this
edit (A1 and A6 only, isolated; full-gate run below).

| | A1 | A6 |
|---|---|---|
| Before | FAIL (docs/ false positives) | FAIL (checkin/route.ts no longer contains the literal) |
| After | PASS | PASS |

No other assertion in the contract was touched. No network calls to PayFast, no
Firestore writes, no credential values logged — both replacement checks are static
`grep`/import-presence checks against files already in the working tree.
