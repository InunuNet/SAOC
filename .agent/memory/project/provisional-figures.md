# Provisional figures — placeholders until Lee-Ann's numbers land

**Status: PROVISIONAL. Not council-confirmed. Not to be shown to the public as fact.**
Written 2026-08-19 so the build is not blocked waiting on the pricing questionnaire
(https://claude.ai/code/artifact/1b5729ed-46f5-497b-8070-63a025330e5a). Every value here is an
estimate by the web team. When Lee-Ann returns the questionnaire, these are replaced wholesale —
see "Replacement procedure" at the bottom.

## Why this file exists at all

This project has twice been damaged by invented values that spread before anyone checked them: the
CTICC venue (`docs/venue-prose-residue.md`) and the 18–21 September 2027 show dates
(`project_show_dates_placeholder`). Both started as one reasonable working assumption and ended up
in seed scripts, golden files, live Sanity content and a public countdown, presented as confirmed.

The mitigation is not "don't estimate" — Brad's instruction is explicitly to estimate so the build
continues. The mitigation is **containment**: every figure below lives in exactly one place in code,
carries a machine-readable provisional flag, and is never rendered to a public page as a settled
fact without that flag being consulted.

## Ticket prices

Her document already pencils in prices, footnoted "final prices to be confirmed in the website
pricing configuration". Those are used verbatim — they are her figures, not ours, and inventing
different ones would be strictly worse.

| Ticket | Price | Source |
|---|---|---|
| Early-Bird Exhibition Ticket | R130 | her doc (marked to be confirmed) |
| Day Visitor Ticket | R150 | her doc (marked to be confirmed) |
| Early-Bird Weekend Pass | R380 | her doc (marked to be confirmed) |
| Weekend Pass | R400 | her doc (marked to be confirmed) |
| VIP Ticket | R300 | her doc (marked to be confirmed) |

## Capacities — OUR ESTIMATE, no client source

The venue is The Hangar, Stellenbosch Flying Club — an aircraft hangar on an airfield, confirmed
2026-08-12. Estimates assume the floor is shared between orchid display staging, vendor stands and
circulation, so visitor numbers are well below a bare-floor assembly figure.

| Item | Estimate | Reasoning |
|---|---|---|
| Day Visitor tickets, per day | 800 | Whole-day admission, not concurrent occupancy; typical turnover for a hangar-scale show |
| Early-Bird Exhibition tickets | 400 total | ~1 day's allocation released cheap to seed early sales |
| Early-Bird Weekend Pass | 150 total | Weekend passes are a minority of sales at most shows |
| Weekend Pass | 300 total | |
| VIP Ticket | 120 total | Thursday 17:00–18:30 only; a seated/standing reception, not a show day |
| Exhibit vendor stands | 30 | |
| Food vendors | 6 | |
| Early-bird cut-off | 2027-07-31 | ~7 weeks before the show |

**These are the values most likely to be wrong.** Capacity is the one figure with a physical
constraint behind it that we have not measured, and overselling a hangar is a real-world failure,
not a cosmetic one. Treat every capacity as a ceiling to be lowered, never raised, until confirmed.

## Child age bands — OUR ESTIMATE, from Brad's own suggestion

Her document asks for a "Number of Children" but lists no child ticket type, which is a genuine gap
raised with her in the questionnaire.

| Band | Treatment |
|---|---|
| Under 6 | Free, no ticket issued |
| 6–12 inclusive | Child ticket |
| 13 and over | Adult ticket |

Child ticket price: **R60** (our estimate; roughly 40% of the day visitor price). No pensioner or
member rate is modelled — neither appears in her document.

## Show dates

Thursday 16 – Sunday 19 September 2027. Derived from her document's Thu–Sun structure. Not itself
one of the estimates above, but it shares the same replacement path.

## Replacement procedure

When Lee-Ann's answers land:

1. Read her answers back off the artifact with WebFetch.
2. Replace the values in the single source of truth in code (see the payment-seam / admission-
   products missions for where that lands) — do not edit them at multiple call sites.
3. Flip the provisional flag off per value, so anything gated on it starts rendering as confirmed.
4. Re-run the contract gate. Any assertion that only passes because a value is provisional must be
   observed failing against a confirmed value before it is trusted.
5. Update this file to record what she actually said, and what we estimated wrongly. That delta is
   the useful artifact — it tells us how far off our estimates run.
