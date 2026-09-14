<!--
ticketing-complete M4/F8 -- negative-control fixture for
contracts/checks/ticketing-complete-f8/verify_open_decisions_coverage.py (contract-f8.yaml
A10, negative control A21).

Purpose: prove the coverage check actually requires EVERY mustContain substring of EVERY
item in goldens/f2-open-decisions.json, not "most of them" or "one substring per item is
enough". This fixture deliberately covers every item COMPLETELY except one: the
"weekend-pass-two-skus" item requires four substrings, and this doc omits exactly one of
them on purpose -- the regular (non-early-bird) Weekend Pass rand figure. That figure is
NOT typed anywhere below, including in this comment block, on purpose -- the substring
check would count a mention here as coverage, defeating the negative control (this was
caught and fixed while writing this fixture: an earlier draft named the omitted figure
literally in this very comment and the fixture accidentally passed).

Expected result running the real script against this fixture + the real
goldens/f2-open-decisions.json, right now: FAIL (exit 1), naming weekend-pass-two-skus as
the item with incomplete coverage. If this fixture ever passes, the check has stopped
requiring full coverage per item and is back to being satisfiable by partial prose -- the
exact defect this assertion exists to catch.

If goldens/f2-open-decisions.json's requiredItems ever change, update this fixture in the
same commit so it still covers everything except the one deliberate gap described above --
don't let it silently start passing (too little coverage required) or failing for the wrong
reason (a different item now also missing). Cross-check with:
`python3 -c "import json; d=json.load(open('.../f2-open-decisions.json')); doc=open('this file').read().lower(); [print(i['id'], [s for s in i['mustContain'] if s.lower() not in doc]) for i in d['requiredItems']]"`
-- exactly one item should print a non-empty list, with exactly one missing substring in it.
-->

# F8 open-decisions negative-control fixture

## VIP price ladder
VIP is R625, with the standard 20% early-bird discount applying (R500 early-bird), per
Brad's direct ruling on 2026-09-08.

## Weekend Pass SKUs
Two live active SKUs exist today: `weekend-pass` and `early-bird-weekend-pass`.

## Weekend Pass cutoff mismatch
`early-bird-weekend-pass`'s live cutoff is 2027-07-31, which does not match the mission's
90-day cutoff of 2027-06-18.

## Sunset Cocktails / Field Trip figures changed
Sunset Cocktails is now R800 (single) / R1500 (couple); Field Trip is now a flat R200 per
outing -- both changed from the prior web-team estimate, both cited to Lee-Ann's document.

## Symposium date and venue
The Symposium has no confirmed date or venue yet -- Lee-Ann's own document has a literal
placeholder.

## council@ vs info@
Two general-enquiry addresses (council@ and info@) are both live today; unresolved.

## Six dry-run-polarity scripts
fix-venue-never-changed-copy.ts, migrate-ticket-type-category.ts,
migrate-show-sales-fields.ts, fix-vip-and-weekend-pass-pricing.ts, fix-show-dates-2027.ts,
and fix-visitor-info-dates-confirmed.ts all default to mutate unless --dry-run is passed --
a polarity hazard against the live dataset.

## Membership: direct or via affiliated society?
Whether SAOC membership is direct, via an affiliated society, or both is unanswerable
without the constitution text from Council.

## early-bird-weekend-pass live paid position
The retiring `early-bird-weekend-pass` SKU has exactly one real position, status paid, at
R380 -- a real customer's money. Brad must decide what happens to that position.
