<!--
ticketing-complete M4/F8 -- negative-control fixture for the DISCLOSURE INVARIANT in
contracts/checks/ticketing-complete-f8/verify-walkthrough-figures.mjs (rule (c) in that
script's header; contract-f8.yaml A15).

Purpose: prove the data-figure-status marker REDIRECTS the figures check rather than
switching it off. It is not enough that the script recognises the marker and stops
complaining about the marked number -- the interesting failure is the one where every
individual citation is correctly marked and the doc STILL must fail, because the reader is
never shown the product's real current value at all.

This fixture names Weekend Pass and cites a marked, deliberately non-current early-bird
cutoff for it. Weekend Pass's REAL current cutoff never appears anywhere in this file, in
any form, marked or unmarked -- and deliberately not in this comment either, since the
script strips HTML comments before scanning and a correct-looking value here would make the
control prove nothing (the same comment-vs-content mixup this mission's sibling fixtures
record hitting twice).

The marked date below is chosen to be a date that is NOT Weekend Pass's current value at the
time of writing. If lib/provisional-figures.ts ever changes such that it becomes correct,
replace it with a different wrong-at-that-time date -- never relax the check to make this
fixture pass.

Expected result: FAIL (exit 1), naming weekend-pass and DISCLOSURE INVARIANT. A pass here
means the marker has become a blanket exemption, which is exactly the failure this fixture
exists to catch.
-->

# F8 walkthrough figures -- disclosure-invariant negative-control fixture

## Weekend Pass early-bird cutoff

The Weekend Pass early-bird window is under review. The date we are proposing to move it to
is <span data-figure-status="proposed">2027-06-18</span>, which follows from the 90-day rule.

That is the only cutoff date this document shows for the product, and it is marked as
deliberately non-current -- so nothing here ever tells the reader what the cutoff actually is
today.
