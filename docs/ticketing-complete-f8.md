# F8 checker: `data-figure-status` — writing a walkthrough figure that is deliberately not current

**Mission:** ticketing-complete (M4, feature F8 — morning review walkthrough). This doc covers
one piece of authoring surface inside the F8 checker,
`contracts/checks/ticketing-complete-f8/verify-walkthrough-figures.mjs` (contract-f8.yaml A15,
negative control A22) — not the walkthrough deliverable itself. For the walkthrough document,
see `docs/ticketing-complete-f8-morning-review.md`; for its design record, see
`.agent/memory/project/specs/ticketing-complete/goldens/f8-README.md`.

## What the checker normally requires

Any document this checker guards — currently just the morning-review walkthrough — is scanned
for every `R<number>` money citation and every `YYYY-MM-DD` date citation that appears in a
section naming a real ticket product (matched by alias against
`.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f8-figure-citation-product-map.json`).
Every such citation must match that product's real, current `price` / `regularPrice` /
`earlyBirdCutoff` value, read live from `lib/provisional-figures.ts` at check-run time — never a
value that was true when the doc was drafted and has since drifted, and never an invented
number. A citation that doesn't match is FAIL.

## The problem this marker solves

That rule made one legitimate kind of writing impossible: a section whose entire purpose is to
show Brad a mismatch — "the live figure is X, the current rule computes to Y, you decide" —
necessarily puts a non-current number next to a product name. The checker had no way to tell
that apart from a drifted or fabricated citation, so the only way to pass was splitting product
names and non-current numbers into separate sections, which is the checker dictating how the
document reads. `data-figure-status` lets a citation declare itself deliberately non-current
instead.

## The three rules

1. **Only two exact attribute values are markers: `legacy` and `proposed`.** Case-sensitive,
   exact match, no fuzzy acceptance. `Legacy`, `LEGACY`, an empty string, or any invented
   keyword is **not** recognised — the span is left in place and its contents are checked as an
   ordinary bare citation, same as if no `<span>` were there at all. This is a fail-closed
   design: a typo in the marker must make the checker suspicious of the figure, not exempt it.

2. **The marker redirects the check onto a different figure; it never turns the check off for
   that product.** A marked citation is pulled out of the section text before ordinary citation
   extraction runs, so it's checked once (as marked) and never double-counted as a bare
   citation.

3. **The disclosure invariant.** Whenever a product has at least one marked citation of a given
   kind (money or date), that product's real current value of that kind must *also* appear,
   unmarked, somewhere in a section that names the product. A marker lets you show Brad a
   legacy or proposed number — it does not let you show him *only* that number. The unmarked
   disclosure doesn't need to be in the same section as the marked citation, but it does need to
   be attributable to the product through the same alias-matching mechanism as every other
   citation (a bare number floating in an unrelated section doesn't count).

## Example

Weekend Pass's real current `earlyBirdCutoff` genuinely is `2027-07-31` — the legacy
fleet-wide constant, still live, unchanged by F2. It has **not** moved to the mission's
derived 90-day-rule date; that move is an open decision Brad hasn't made (see
[F2 Open Decisions §3](ticketing-complete-f2-open-decisions.md#3-weekend-pass-early-bird-cutoff-mismatch)).
So `2027-06-18` is a genuinely non-adopted, proposed figure for Weekend Pass — not something
already true that a marker would be misused to relabel. A walkthrough section that wants to
show Brad both figures side by side, while still disclosing the real current one, can write:

```html
### Weekend Pass

Weekend Pass's early-bird cutoff is currently 2027-07-31 — the value the legacy fleet-wide
constant still carries (<span data-figure-status="legacy">2027-07-31</span>). If the mission's
confirmed 90-day-before-show rule were applied to it instead, the same way it already has been
for VIP, the cutoff would move to <span data-figure-status="proposed">2027-06-18</span>. That
move hasn't happened — Weekend Pass's real current cutoff is still 2027-07-31 — and whether it
should is still your call.
```

The plain-prose "currently 2027-07-31" is the unmarked disclosure the invariant requires — drop
it (leaving only the marked `<span>` copy) and the checker fails even though both marked
citations are individually valid markers.

**Do not do what an earlier draft of this doc did:** mark a product's already-adopted current
value as `proposed`. VIP's `earlyBirdCutoff` was moved to the derived `2027-06-18` by Brad's
F2 ruling — that is VIP's real, settled, current figure today, not a live-vs-proposed
contrast, so it belongs in a walkthrough as an ordinary unmarked citation, never inside a
`proposed` span. (VIP also never carried `2027-07-31` at any point — its `earlyBirdCutoff` was
`null` before F2 — so it isn't a source of an honest `legacy` marker either; verify a
product's actual git history before assuming what "used to be true" for it.)

## Precedent

This mirrors an existing convention already in the codebase,
`<mark data-provisional-figure="true">` on `/refunds`
(`contracts/checks/policy-pages/check-refunds-provisional-figures.mjs`) — not a new pattern
invented for F8.
