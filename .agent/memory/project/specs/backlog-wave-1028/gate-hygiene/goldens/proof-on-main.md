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
