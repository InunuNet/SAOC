<!--
ticketing-complete M4/F8 -- negative-control fixture for
contracts/checks/ticketing-complete-f8/verify-walkthrough-figures.mjs (contract-f8.yaml
A15, negative control A22).

Purpose: prove the figures cross-check actually reads lib/provisional-figures.ts at runtime
and compares against it, rather than passing any doc that merely mentions a product by name
near some number. This fixture deliberately cites a WRONG VIP price -- R999 -- which is not,
and is not intended to become, the real value of VIP's `price` or `regularPrice` field in
lib/provisional-figures.ts's `vip` entry (see
goldens/fixtures/f8-figure-citation-product-map.json for how a script should resolve the
"VIP" mention to that entry). The real correct figures are deliberately NOT typed anywhere
in this file, including this comment -- a naive parser that doesn't strip HTML comments
before scanning could otherwise pick up a correct-looking number here and confuse the
negative control, the same class of comment-vs-real-content mixup this mission hit twice
already tonight (contract-f1.yaml A4's history, and this file's own A10 sibling fixture's
first draft). Do not use this fixture to hardcode R999 as the check's expected value -- it's
a used-to-be-guaranteed-wrong number for the negative path only, not a golden figure.

Expected result running the real script against this fixture, right now: FAIL (exit 1),
naming VIP / R999 as the mismatch, with the real value it should have matched shown for
comparison. If lib/provisional-figures.ts's VIP price is ever legitimately changed such that
999 becomes correct, replace it with a different value that is still wrong at that time --
never adjust the check to make this fixture pass.
-->

# F8 walkthrough figures -- negative-control fixture

## VIP Pass
The VIP Pass costs R999, our top-tier offering with full weekend access and the Sunset
Cocktails reception included.
