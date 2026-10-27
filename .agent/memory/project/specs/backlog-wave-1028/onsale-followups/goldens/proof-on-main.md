# Proof against origin/main (48d74378)

Finding: both follow-ups were largely fixed already. `buildHubCards` filters with
`ticketTypeMatchesActiveShow` and `activeTicketTypesByCategoryQuery` selects `show` (since #98).
The backlog's "`$p` expands" claim is stale: the YAML value is single-quoted, so the shell sees
`'/VIOLATIONS/,$p'`. The real A7 defect is fail-open: the leading `!` makes it pass whenever the
sweep is missing, crashes, or changes its output format. Assertions A1-A6 therefore PASS on main
by design; they are regression guards. Fail evidence is mutation-based.

## A7 original vs helper (A1)
- Sandbox repo whose national-show page imports firebase-admin: original A7 rc=1 (catches it),
  helper rc=1 `FAIL prerendered hub page reaches firebase-admin`.
- Sweep script missing: original A7 rc=0 (VACUOUS PASS), helper rc=1 `FAIL sweep script missing`.

## A2 mutation (filter removed from a copy of lib/data/ticket-hub-source.ts)
    FAIL A2 hub show filter: 5 failure(s)
      - hub cards for show-fictional-test list another show's types: weekend-pass-early-bird,early-bird
      - JSON-LD offers for show-fictional-test list another show's types: weekend-pass-early-bird,early-bird
      - hub VIP card for show-fictional-test is 300, not its own 999
      - hub cards with no active show list CMS types: vip,weekend-pass-early-bird,early-bird
      - JSON-LD offers with no active show list CMS types: vip,weekend-pass-early-bird,early-bird
Unmutated main: `PASS A2 hub show filter`.

Hub cards are keyed by fixed admission slugs, so a bare other-show type with a novel slug cannot
surface even unfiltered; the same-slug impostor (VIP at 999 under show-fictional-test) is the
real leak and is what A2 injects.

## Gap (c), out of scope
A refused /tickets/[slug] renders a hero with no notice; needs sourced copy, none exists.

## Round 2 (Codex FAIL fixes), all A1-A6 PASS on main, each fix re-proved by mutation
- A1 helper: sweep that prints the header then raises -> `FAIL sweep ended abnormally (rc=1, expected 0)`.
  Violation line with trailing annotation -> `FAIL prerendered hub page reaches firebase-admin`
  (match is substring, as broad as the original grep).
- A3 now scoped to the activeTicketTypesByCategoryQuery block; renaming `show,` on line 174 -> A3 FAIL
  (the detail query's `show,` no longer satisfies it).
- A4 scoped to the buildHubCards({...}) call in the loader; deleting the arg -> A4 FAIL.
- A6 asserts the page's call site `buildShowOffers(hubTicketTypes, new Date(), resolveActiveShow(shows ?? []))`;
  replacing the third arg with `null` -> A6 FAIL.
- A2 also asserts prices: the VIP JSON-LD offer must equal the active show's price, the impostor's 999
  must not appear in any card or offer price under the active show, and under the other show the VIP
  offer must be 999. Mutant letting the same-slug vip through: `JSON-LD VIP offer for show-fictional-test is 300, not its own 999`.

## Round 3 (Codex round 2 FAIL), A1-A6 PASS on main, each fix mutation-proved
- A1: sweep printing only the header, rc 0 -> `FAIL sweep reported neither violations nor the (none) marker`.
- A6 (now check-show-offers-forwarding.sh, function-scoped; buildShowOffers is not exported so a behavioural replay needs a product change, noted as accepted limit): wrapper passing `activeShowId: null` to buildHubCards -> FAIL; page call site with `null` -> FAIL.
- A5 (now check-a7-rewired.sh, scoped to the A7 block): origin/main's old A7 -> FAIL "does not call the helper"; helper plus a `| grep` pipe -> FAIL "still carries the negated pipeline".
- A2 active-show price lines: mutant with no filter and `.reverse()` (impostor wins under the active show) -> 7 failures incl. `JSON-LD VIP offer for show-19-2027 is 999, not the active show's 300`, `a show-fictional-test price 999 reaches hub cards or JSON-LD offers`, `hub VIP card ... carries the impostor price`.

## Round 4 (Codex round 3), A5 is exact equality
check-a7-rewired.sh now requires A7's command to equal `python3 <helper> .` exactly, exactly one A7 id,
exactly one `command:` in the block, the helper file present, and the next line to be timeout_seconds
(no YAML continuation). Each of these mutants of the old contract FAILs: `|| true`, `; true`, `&& true`,
`| cat`, extra arg, trailing space, trailing `# x` comment, leading `!`, a `|| true` continuation line,
a duplicated A7 block, a second `command:` line. The unmutated branch contract PASSes.

## Round 5 (Codex round 4): buildShowOffers replayed behaviourally
Product change required of the dev (A2 is RED on main until it lands): move `buildShowOffers`,
`SanityHubTicketType`, `TICKET_PRODUCT_BASE_URL` and `OFFER_CURRENCY` out of
`app/(nos)/national-show/page.tsx` into new `lib/data/national-show-offers.ts`, export
`buildShowOffers(ticketTypes, now, activeShowId)` (body unchanged), and import it in the page. A page
file cannot export it directly (Next rejects non-route exports from page.tsx), hence the new module.
- On main: `FAIL A2 ... lib/data/national-show-offers.ts cannot be imported (buildShowOffers must be exported there)`.
- Reference module (body copied verbatim, not committed): `PASS A2`.
- Mutants of that module, each FAIL: `activeShowId: null` into buildHubCards (lost early-bird, wrong VIP);
  activeShowId taken from the last type's show (impostor price 999 leaks under the active show);
  see unfiltered-types mutant below.
  Unfiltered-types mutant (every type's `show` rewritten to the active id, i.e. offers built from
  unfiltered ticketTypes): FAIL `buildShowOffers for show-fictional-test offers another show's types: vip,weekend-pass-early-bird,early-bird`.
- A6 is now only the page call-site grep (`buildShowOffers(hubTicketTypes, new Date(), resolveActiveShow(shows ?? []))`).

## Triad (A7-A10)
A7 codex_qa required; A8 browser_deployed_check and A9 gws_inbox_check declared non-required (same reasons as gate-hygiene A11/A12);
A10 is the RUN AFTER DEPLOY plain check (check-deployed-nos-jsonld.mjs). Verified against a local mock host:
good offers -> rc 0; VIP 999 -> rc 1 (`VIP offer price is 999, want 300`, `wrong-show price 999`); unreachable -> rc 77; no credentials -> rc 77.

## Round 6 (Codex on ccd48c1a)
- Real product bug: `cutoffBySlug` in lib/data/national-show-offers.ts was built from the UNFILTERED types, so a same-slug
  foreign early-bird overwrote the active offer's validThrough. A2 now carries an early-bird impostor (other show, cutoff
  2027-06-30; active early-bird cutoff 2027-03-01). On feat head ccd48c1a (module copied verbatim) A2 is RED:
  `early-bird validThrough for show-19-2027 is 2027-06-30, want the active show's 2027-03-01` and `carries the show-fictional-test cutoff`.
  With the fix applied (reference copy, not committed) A2 PASSes.
- A6 is a comment-stripping node check (check-page-call-site.mjs). Mutants that FAIL: live `null` call plus the real call in a `//`
  comment, in a `/* */` block, in a multi-line block comment, and the plain `null` call. Accepted limit: a call-shaped string literal
  is not stripped.
- A10 compares the deployed offer set to the expected active-show set (fixture-derived subset mode, or EXPECT_OFFERS exact mode). Mock-host
  results: good rc 0; unknown extra offer rc 1; wrong price on a known slug rc 1; exact mode with a missing offer rc 1; exact good rc 0.
  Accepted limit: default subset mode cannot flag a MISSING expected offer (hub sibling collapse, conference/workshop products not in the fixture).
- A7 rescoped to the product diff (as gate-hygiene A10). Check-strength gaps on unchanged code are accepted limits, not reviewed:
  ticket-hub-source.ts / ticket-offers.ts / sanity/queries.ts filter strength beyond what A2-A4 replay.

## Round 7 (A6 establishes WHICH buildShowOffers)
check-page-call-site.mjs additionally requires (comments stripped) a by-name import of buildShowOffers from
'@/lib/data/national-show-offers', no local `function|const|let|var buildShowOffers`, and no import of the name from any other
module. Real page on feat 165dd047: PASS. Main (local function, no import): FAIL. Mutants, each FAIL: local function restored
alongside the import; local const alongside the import; local function with the import's name removed; import removed;
import re-pointed to another module; second import of the name from elsewhere; import commented out with the local function restored.
Accepted limits: a call-shaped string literal is not stripped; a barrel re-export of the shared module is not recognised as the shared source.
