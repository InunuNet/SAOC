<!--
ticketing-complete M4/F8 -- negative-control fixture for MARKER VALIDATION in
contracts/checks/ticketing-complete-f8/verify-walkthrough-figures.mjs (rule (b) in that
script's header; contract-f8.yaml A15).

Purpose: prove the data-figure-status attribute's VALUE is validated against a closed set,
not accepted on the strength of the attribute merely being present. A check that exempts any
span carrying a data-figure-status attribute of any value would let a typo -- or an invented
keyword -- silently launder a fabricated figure past the whole assertion.

This fixture wraps a fabricated VIP price in a span whose status value is `bogus`: not
`legacy`, not `proposed`, not a valid marker. The correct behaviour is to ignore the marker
entirely and check the number inside it like any other bare citation, which fails because the
number is wrong.

The real correct VIP figures are deliberately NOT typed anywhere in this file, including this
comment -- the script strips HTML comments before scanning, and a correct-looking number here
would confuse the control. Do not treat the fabricated number below as a golden value; it is
a wrong-on-purpose number for the negative path only. If it ever becomes correct in
lib/provisional-figures.ts, replace it with a different wrong-at-that-time number rather than
adjusting the check.

Expected result: FAIL (exit 1), naming vip and the fabricated price as an ordinary
does-not-match-any-real-current-value mismatch -- proving the invalid marker was disregarded
rather than honoured.
-->

# F8 walkthrough figures -- invalid marker-value negative-control fixture

## VIP Pass

The VIP Pass is listed at <span data-figure-status="bogus">R4242</span> in this fixture. The
status value on that span is not one this check recognises, so the figure inside it must be
treated as an ordinary citation and compared against the real value like any other.
