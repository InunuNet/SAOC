# Proof on origin/main 48d74378 (run in .tmp/sandbox/wt-gate-hygiene, pristine product tree)

Item 1 (sitemap)
- saoc-seo-polish check: FAIL `SAOC_STATIC_ROUTES paths [... "/memorandum-of-incorporation" ...] != golden [... "/constitution" ...]`
  Cause: stale golden. The route was renamed to /memorandum-of-incorporation (lib/saoc-sitemap-routes.ts). Fix = goldens/sitemap-golden-fix.patch (one line in contracts/golden/saoc-seo-polish/sitemap-expected.json). With it the check prints `PASS: 11 static SAOC routes, route tree and sitemap agree`.
- audit-fixes-2026-10-25 check: PASSES on main today (`ok: NOS sitemap helpers match the golden`). The backlog entry ("missing import") is stale or was
  fixed incidentally; no change needed. Its assertion here is "runs and passes" plus the mutation proof.
- check-sitemap-mutations.mts on main: FAIL (baseline of the saoc check does not pass). After the golden fix: PASS, all 4 mutations caught.

Item 2 (isUpcoming)
- check-isupcoming-no-date-statics.mts on main: FAIL `S1: isUpcoming calls Date statics: Date.parse, Date.parse` and 10 `R1 ... threw Date.parse is not a function`.
- With `new Date(last).getTime() >= new Date(sastStartOfDay(now)).getTime()` it PASSES (21 rows, real and statics-less Date). R2 (real Date) passes on main, proving the table matches current behaviour.
- lib/fixture-clock.ts / parseInstant do not exist on origin/main (grep: none). The "style" reference in the brief could not be followed; the contract states the rule directly.

Item 3 (checkout route)
- This is a regression guard for behaviour main already has, so check-checkout-day-null.mts PASSES on main by design. Its failure proof is the mutation: with the guard `if (!lineItem.chosenDay) {` disabled it FAILs (`chosenDay absent: got 500 ... want 400 "A day selection is required..."`). check-checkout-day-mutation.mts automates that.
- Finding: `chosenDay: null` never reaches the guard; parseLineItems refuses it first (generic 400). Both are 4xx with no write; the check asserts 4xx for null and the exact F5 message for the absent case.

## Codex A10 round 1 rulings (2026-10-28)
- DISMISSED: lib/sast-date.ts:42 numeric `date` (4102444800000) changes Date.parse(number) vs new Date(number). isUpcoming's `date` is typed `string`; a number is outside the contract, so the table stays string-only.
- FIXED: the NOS sitemap check now asserts NOS_EXTRA_STATIC_ROUTES equals ["/contact"] exactly; mutants M5 (SAOC) and M6 (NOS) add /does-not-exist and both checks fail on them. (The SAOC check already compared the exact set.)
- FIXED: checkout fixture now has two day-required types (weekend-pass, workshop-pass) plus day-optional vip; mutants M2 (flag derived from the weekend-pass slug) and M3 (all types day-required) both fail the check, along with M1 (guard disabled).
- FIXED: the check now asserts zero Firestore write attempts.

## Codex A10 round 3 (2026-10-28) and the scope decision
Fixed cheaply: the built-sitemap check feeds one society and one event and asserts their entries (mutants M10, M11 drop each spread); it asserts no /tickets/ entry with no ticket cards; the checkout fixture adds the real `day-visitor` slug as day-required (the fixed-slug-list mutant M2 now includes weekend-pass and workshop-pass, so day-visitor catches it).
A10's prompt is now scoped to the actual product diff (lib/sast-date.ts, the sitemap golden). Further check-strength gaps on UNCHANGED code are accepted limits, not new rounds:
- the built-sitemap check proves no /tickets/ entry only with an empty card set; it does not feed real ticket cards, so a regression in which cards produce /tickets/<slug> entries is not caught here.
- the checkout test mocks Sanity/Firestore at the module boundary and never reaches reservation or payment (a day-required refusal happens before them); it does not prove behaviour after the day guard.
- A11/A12 (non-required triad kinds) have no manifests. browser_deployed_check.sh and gws_inbox_check.sh have no N/A manifest form (gws requires gws_subcommand 'mail read' and a real message_id), so a missing manifest reads ERROR, accepted by team-lead for these non-required items.
