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
