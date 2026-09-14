# ticketing-complete M4/F8 — design record

The mission's actual deliverable to Brad. Everything else tonight (taxonomy, pricing engine,
schema, purchase surfaces, nav rebuild, self-test harness) is work Brad benefits from but
didn't personally ask to review line by line — F8 is the document he actually reads, first
thing, before he's had coffee, to decide what to do next.

## 1. Files this feature creates

- `docs/ticketing-complete-f8-morning-review.md` — NEW. The walkthrough itself.
- `contracts/checks/ticketing-complete-f8/screenshots/` — NEW. Real screenshots the
  walkthrough embeds, following the existing convention already used by
  `contracts/checks/vendor-form-client-validation-gate-f1/screenshots/` and its siblings —
  descriptive kebab-case PNG filenames, referenced by relative path from the doc.

## 2. Why this doc exists alongside F2's own open-decisions doc

`docs/ticketing-complete-f2-open-decisions.md` is the SINGLE SOURCE OF TRUTH for the full
detail of F2's 8 surfaced decisions — the exact figures, the exact rationale, the exact
scripts. F8 does NOT duplicate that content. It names each decision's topic (so nothing is
buried in a document Brad might read instead of the deeper one) and links to the real doc
for the detail. Two documents covering overlapping ground exist for a reason: F8 is the
ten-second-scan entry point; F2's doc is the reference he actually decides from. If F8 ever
drifted into re-explaining the figures itself, a future edit to the real numbers would need
to update two places to stay honest — exactly the kind of two-sources-of-truth risk this
mission's own migration script design (idempotent, keyed identity, single source per fact)
argues against everywhere else.

## 3. Screenshots are proof, not decoration

A walkthrough full of broken image links, or five copies of the same irrelevant screenshot,
looks complete and proves nothing — the same failure shape as F7's A16 catching a
`page.route()` mock that's declared but never fires. A6/A7 in the contract require every
referenced image to resolve to a real file AND cover, by keyword in its path, each of the
five minimum categories in `goldens/fixtures/f8-required-screenshots.json`: the rebuilt nav
(desktop and mobile — Brad's headline ask), the fixed footer, a real purchase surface, and
the migration's dry-run terminal output.

## 4. Not deployed, and said so plainly

This mission was built and verified locally overnight. Nothing has shipped to the live
site. The document says this in plain language rather than letting an enthusiastic status
summary read as a deployment announcement — the same discipline `contract-f2.yaml`'s
`--apply`-gating applies to the migration script itself, applied here to the WORDS Brad
reads about what happened.

## 5. The one action that's genuinely his

Running the F2 migration with `--apply` against the live `production` Sanity dataset is not
something any agent does on Brad's behalf, tonight or ever without his explicit go-ahead —
this mission's standing hard constraint. F8's walkthrough shows him the exact command and
what it will do (from the dry-run output already captured), then stops. It never claims the
migration already ran.

## 6. Honest accounting of what isn't finished

Two categories of acknowledged, tracked incompleteness get named explicitly rather than
smoothed over:

- **F6's five NOS-owned routes** (`goldens/fixtures/f6-pending-nos-routes.json`) are wired
  into the nav but don't exist as real pages yet — that's the OTHER session's work, agreed
  and tracked, not a bug in this mission.
- **F7's ratchet-tolerated missing-check debt** (`contracts/checks/_shared/missing-baseline.json`)
  — some assertions across the wider repo reference check scripts that don't exist yet. The
  ratchet (contract-f7.yaml A25-A29) makes this debt visible and non-growing, not zero. F8
  names the baseline file as the number's real source rather than hardcoding a count that
  could silently drift stale the next time someone actually writes one of the missing
  scripts.

## 7. No fabricated confidence in the summary itself

This mission's anti-fabrication discipline (provisional figures marked provisional,
`data-placeholder` on unconfirmed content, open decisions surfaced rather than silently
resolved) applies to F8's own prose too. A16 in the contract bans absolute-completeness
language ("fully tested", "production ready", "guaranteed", "100% coverage") — overselling
the walkthrough's own completeness is the same failure mode as an invented ticket price,
just aimed at Brad's trust in the summary rather than a buyer's wallet.

## 8. Published as an Artifact — and the one gap this contract cannot close

Team lead's explicit instruction: the walkthrough is published as an Artifact Brad can step
through on any device, not left as a repo file only. A2 requires the source doc to record
the real published URL under a labeled "Published walkthrough:" heading. **This cannot be fully verified
by a shell assertion** — `grep` can confirm a `https://claude.ai/...`-shaped
string is present, never that the artifact is actually live, renders correctly, or matches
the repo doc's content. That residual gap is named here explicitly rather than silently
assumed covered: whoever implements F8 must actually publish the artifact and visually
confirm it before reporting done, the same "a browser must actually look at it" discipline
this repo's own rules apply to every other piece of visual work.

## 9. Two decisions added after F2's original 8

Found later and folded into this feature's own brief, each verified independently before
being written into the contract rather than taken on faith:

- **Admission refundability CONFLICT.** Lee-Ann's source document states admission is
  non-refundable. The LIVE `/refunds` page contradicts this today — confirmed by reading
  `lib/provisional-figures.ts`'s `PROVISIONAL_REFUND_POLICY` directly: `appliesTo` literally
  includes `'admission'`, with real tiers (90% at 30+ days notice, 50% at 14–30 days, 0%
  under 14 days). This is not a hypothetical inconsistency — the live page and the source
  document disagree right now, and F8 surfaces it as a question, not a fact resolved either
  way.
- **Branch protection on `main` is off today** — confirmed via `ci.yml`'s own comments,
  cited in `contract-f7.yaml`'s goldens. Named as a decision only Brad can make (a GitHub
  repository setting), never something a feature enables on his behalf.

## 10. What "N/N assertions green" does and doesn't mean

Per team lead's explicit instruction, this is the residual honesty check on tonight's own
work, not just on the ticketing system. Contract assertions were green **when they were
written and run** — nothing in this repo automatically re-runs them again until F7's CI
runner (`contract-f7.yaml` A20–A29) actually lands and executes on a real push/PR. Even once
it does, it is **detection, not enforcement**: `main` carries no branch protection, so a red
CI job blocks nothing until Brad turns that setting on himself (see §9's second decision).
A13 requires the walkthrough state this plainly — a point-in-time measurement, never a
standing guarantee, is the correct way to read every "assertions green" claim in this repo
tonight, this mission's own included.

## 11. "Never say live" — the literal instruction vs. the intended one

Team lead's instruction was "if it says 'live' anywhere, it's wrong." Read completely
literally, this would forbid this mission's own correct, necessary technical language —
"live Sanity dataset," "live Firestore," "live `/refunds` page" all appear constantly and
accurately throughout this mission's docs (including F8's own §9 above) when describing
real infrastructure that must not be written to without care. Banning the word outright
would make that honest language unwritable. A4 implements the narrower, clearly INTENDED
meaning instead: no false DEPLOYMENT claim ("is live", "now live", "went live", "the site is
live," "deployed to production") — this is a deliberate scoping choice, not a literal word ban,
flagged here so it reads as a considered interpretation rather than an oversight.

## 12. Route-resolution and figure-accuracy are runtime checks, not static citations

A9 and A15 both run real code against the walkthrough's own claims rather than trusting its
prose: A9 extracts every `/`-rooted path the doc tells Brad to visit and hits it against a
real local dev server (skipping F6's honestly-disclosed pending NOS routes); A15 extracts
every specific price/date the doc cites for a named product and cross-checks it against that
product's REAL field value in `lib/provisional-figures.ts` at check-time — so a number that
was true when the doc was drafted, and has since drifted from a later F2/F4 edit, is caught
rather than silently trusted.
