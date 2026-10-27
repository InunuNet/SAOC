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
