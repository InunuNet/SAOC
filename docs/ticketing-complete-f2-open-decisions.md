# ticketing-complete M1/F2 — open decisions (surfaced, not resolved)

F2 (Sanity `ticketType` schema + seed for every taxonomy category, dry-run-only migration)
deliberately does not pick a winner on any of the items below. A migration that silently
resolves a live inconsistency destroys the evidence that a decision was ever needed — worse
than leaving it visibly inconsistent. Every item here needs Brad's (and, where marked,
Lee-Ann's/the Council's) call before `scripts/migrate-f2-ticket-taxonomy.ts --apply` is ever
run. This document feeds F8's morning review.

## 1. VIP price ladder — RESOLVED by Brad's direct ruling (2026-09-08)

The live dataset has VIP priced at **R300**. `fix-vip-and-weekend-pass-pricing.ts`'s intended
correction to **R480** was written but never actually run against the live dataset. VIP is
described as including the full weekend plus a reception, yet was priced below both
Weekend Pass SKUs — incoherent as a product ladder.

**Brad has ruled directly: VIP is R625, with the standard 20% early-bird discount applying
(R500 early-bird).** This is not a council confirmation, but it is settled — recorded as
`provisional: false` on the VIP entry in `lib/provisional-figures.ts`, with `sourceCitation`
citing Brad's ruling rather than "pending council" (mislabelling a decided figure as awaiting
confirmation would be the same provenance-loss shape the `sourceCitation` field exists to
prevent). The R625/R500 → engine math is exercised by
`contracts/checks/ticketing-complete-f2/check-vip-computed-early-bird-price.mjs` against the
real, contract-locked `lib/admission-early-bird-pricing.ts` computed engine, not assumed.
`scripts/migrate-f2-ticket-taxonomy.ts`'s dry-run plan now includes patching VIP to these
values (still `--apply`-gated, never run by this mission). Ladder is now coherent: VIP R625
sits above Weekend Pass's R400 regular price; VIP's discounted R500 still sits above both
Weekend Pass SKUs (R380 early-bird / R400 regular). This item needed no further Brad/Lee-Ann
call before `--apply` — the decision itself is what changed, listed here as a resolved
history item rather than removed, since the R300/R480 figures remain live in the dataset
until `--apply` actually runs.

## 2. Weekend Pass — two live SKUs for one product

Two active SKUs exist simultaneously today: `weekend-pass` (**R400** on the merged model,
R380 early-bird per the corrected pricing) and the legacy `early-bird-weekend-pass`
(**R380**). The merge described in `fix-vip-and-weekend-pass-pricing.ts`'s own comments was
never applied to the live dataset. `early-bird-weekend-pass` carries 1 real Firestore
position, so F2 retires it (`active: false`) rather than deleting it — but the underlying
question of whether R380/R400 is the right final early-bird/regular pair is still open.

### Real customer confirmation (2026-09-08, read-only, `scripts/f2-diagnose-firestore-positions.ts`)

QA raised whether the "1 real position" figure quoted throughout this feature's design
record had ever been independently re-checked, since it originated from an earlier research
pass and was only ever repeated, not re-verified. It has now been re-checked directly against
live Firestore (`tickets` collection, read-only — `.where().get()` only, no writes):

- **`early-bird-weekend-pass`: CONFIRMED — exactly 1 real position, status `paid`, R380.**
  This is a genuine sale, not a stranded/expired `reserved` hold. One real customer holds a
  paid booking at R380 for a SKU this migration retires (never deletes) in favour of the
  merged `weekend-pass` product. **Brad must decide before `--apply` runs**: honour this
  customer at their original R380 price on the merged product, leave their existing position
  untouched and simply exclude the retired SKU from future sales, or another resolution —
  this document does not pick one.
- **`field-trip-single`: 0 positions.** No customers affected by retiring this SKU.
- **`field-trip-all-outings`: 0 positions.** No customers affected by retiring this SKU.

No customer holds a position against either retired Field Trip SKU — the flat-rate
replacement product introduces no refund/communication question. `early-bird-weekend-pass`
does, and is the only one of the three that does.

## 3. Weekend Pass early-bird cutoff mismatch

**Still OPEN. Broader than the heading suggests — read the scope below before deciding.**

`early-bird-weekend-pass`'s live `earlyBirdCutoff` is **2027-07-31**. The mission's
90-day-before-show rule, computed from the confirmed 2027-09-16 show start, gives
**2027-06-18**. These two dates do not agree, and F2 does not silently pick one — the
mismatch is left visible for your review rather than migrated away.

### What HAS changed: VIP only

The VIP ticket has been corrected off the legacy `EARLY_BIRD_CUTOFF` constant and now carries
the derived **2027-06-18** cutoff. That was not a resolution of this decision — it is a
different case. VIP's cutoff is being **freshly written** for the first time under your
2026-09-08 pricing ruling, so there was no existing date to preserve and no customer who
bought against one. It is computed by the real pricing engine
(`lib/admission-early-bird-pricing.ts`), never hand-typed, so it cannot drift from the rule.

Nothing else moved. In particular, `early-bird-weekend-pass` — the one SKU with a **real,
paid** Firestore position against it — is untouched, and a contract check
(`check-vip-fix-scope-containment.mjs`) exists specifically to keep it that way.

### The real blast radius: five products, one decision

The legacy `2027-07-31` constant is not a weekend-pass problem. Grep-verified against
`lib/provisional-figures.ts`, **five** products still read it:

| Product | Slug | Category |
|---|---|---|
| Early-Bird Exhibition Ticket | `early-bird` | Admission |
| Weekend Pass | `weekend-pass` | Admission |
| SAOC Symposium (Early-Bird) | `saoc-symposium-early-bird` | Conference |
| WOSA Conference (Early-Bird) | `wosa-conference-early-bird` | Conference |
| SAOC/WOSA Joint (Early-Bird) | `saoc-wosa-joint-early-bird` | Conference |

The three conference slugs are a **pre-F1 pattern** — separately-priced early-bird SKUs that
predate the computed-discount model, deliberately not retrofitted by this feature (recorded in
`contract-f2.yaml` A15). They are listed here anyway, because they carry the same date and
would move with the same decision.

**This is ONE decision, not five.** Either 2027-07-31 is the real early-bird cutoff for the
whole fleet and the 90-day rule needs restating, or 2027-06-18 is, and all five products move
together. Deciding it product-by-product is how the fleet ends up with the incoherent ladder
§1 just resolved. Answering it once also settles the cutoff half of what happens to the one
real paid `early-bird-weekend-pass` position documented in §2.

## 4. Sunset Cocktails / Field Trip figures changed

Real client figures from Lee-Ann's "13.1 Ticketing system details.docx" replace the prior
web-team estimates, which had no client source:

- **Sunset Cocktails**: Single **R800** / Couple **R1500** (was R250/R450 estimate).
- **Field Trip**: flat **R200** per trip (was an invented R300 single / R750 all-outings
  bundle split).

These are listed here as CHANGED figures precisely because they replace fabricated numbers
with real ones — `scripts/migrate-f2-ticket-taxonomy.ts` plans the patch but does not apply
it in this mission.

## 5. SAOC Symposium date and venue — genuinely unknown

Lee-Ann's own FAQ document contains a literal unset placeholder for the Symposium
("the Symposium will be held on xx, xx September 2027 at the xx") — nobody on the client side
has decided the Symposium's date or venue yet. `ticketType` has no date/venue field today,
and F2 does not add one populated with a guess, nor does it default to the show's own
2027-09-16 dates as a stand-in for the Symposium's own undecided date/venue.

## 6. council@ vs info@

Two general-enquiry addresses (`council@saoc.co.za` and `info@saoc.co.za`) exist
simultaneously across the site's content with no documented resolution of which is
authoritative. Carried over unresolved from the mission's own known-open-questions list.

## 7. Dry-run polarity hazard — six scripts, not one

A full sweep of `scripts/` (2026-09-08) found **six** existing scripts sharing the identical
unsafe pattern (`DRY_RUN = process.argv.includes('--dry-run')` — default is MUTATE, and
`--dry-run` is the flag you have to remember to pass):

- `fix-venue-never-changed-copy.ts:77`
- `migrate-ticket-type-category.ts:102`
- `migrate-show-sales-fields.ts:86`
- `fix-vip-and-weekend-pass-pricing.ts:79`
- `fix-show-dates-2027.ts:80`
- `fix-visitor-info-dates-confirmed.ts:76`

All six write against the single shared `production` dataset. Three other scripts already in
the repo (`seed-fictional-test-show.ts`, `seed-demo-ticket-type.ts`, `swap-active-show.ts`)
already use the correct `--apply`-gated polarity that `migrate-f2-ticket-taxonomy.ts`
follows — the safe pattern existed in-repo the whole time and was simply not applied
consistently to every script.

**Not fixed by this mission.** This is one open decision for Brad, not an overnight patch —
several of the six may already have been run against live data, so flipping their default
behaviour unreviewed carries its own risk independent of the polarity question itself.

## 8. Membership — direct vs. via an affiliated society

Unanswerable from any source currently held: the SAOC **constitution** has never been
supplied to this project, and Lee-Ann's Members Portal Drive folder is empty. Is **SAOC
membership** direct, via an **affiliated society**, or both? No F2 seed data or schema change
implies an answer either way. Requesting the constitution text from the Council would settle
this permanently and unblock `/constitution` at the same time.
