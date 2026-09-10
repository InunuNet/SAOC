<!--
ticketing-complete M4/F8 -- negative-control fixture for
contracts/checks/ticketing-complete-f8/verify-walkthrough-routes.mjs (contract-f8.yaml A9,
negative control A20).

WIDENED 2026-09-08 (architect, per team lead's finding from the F8 dev): A9 originally
extracted routes only from fenced code blocks and inline backtick spans. The dev correctly
implemented that literal wording, but it left a real gap -- a route named only as a markdown
hyperlink was never extracted or checked at all, so A9's coverage depended on which
formatting a future doc author happened to use, not on what the doc actually tells Brad to
visit. A9 now ALSO extracts markdown-link targets, and this fixture was extended (not
replaced) to prove both extraction paths actually work, not just the one that existed
before.

CAUGHT WHILE WRITING THIS FIXTURE, before reporting: the first draft of this comment block
described the new fake route and an example link-syntax pattern by wrapping them in
backticks, same as the routes below it -- which meant the CURRENT (unwidened) script's own
backtick-span extraction picked BOTH up out of this comment text, and the fixture "passed"
its purpose (looked like it exercised the gap) for the wrong reason: comment text, not the
markdown-link extraction the fixture exists to prove works. Verified by literally running the
real script against the draft and reading its output before fixing this -- same
comment-vs-real-content leak this mission has now hit three times tonight (contract-f1.yaml
A4's git history; goldens/fixtures/f8-open-decisions-negative-fixture.md's first draft; this
file's own first draft). Fixed by never putting a route string or link-syntax example in
backticks anywhere in this file's prose, including this comment -- plain quotes only below.

Purpose: a doc that LIES about routes through EVERY extraction path A9 supports, so @dev can
prove the route-extractor actually fails a walkthrough rather than passing anything with the
right shape. Four routes in the body text below (backticks used ONLY on the two routes that
are SUPPOSED to be found via backtick extraction; the two markdown-link routes are named in
plain prose right here, with no backticks, so they cannot leak into the "before" run the way
the first draft did):

1. The real, already-built "tickets" route, referenced ONLY as a markdown hyperlink, never
   in backticks. Must be hit and must 200. If the script fails against this fixture because
   of this route, markdown-link extraction isn't wired up at all -- this is the positive
   proof the widening actually happened, not just a policy statement.
2. The "national-show/about" route, backtick-wrapped in the body text below, listed in
   goldens/fixtures/f6-pending-nos-routes.json. Must be SKIPPED regardless of which
   extraction path found it, never counted as a failure just because it 404s today.
3. A deliberately fake route, backtick-wrapped in the body text below, on no skip-list,
   guaranteed to 404. Proves the backtick/fenced extraction path still fails correctly (this
   was the ONLY negative case before the widening).
4. A second deliberately fake route, referenced ONLY as a markdown hyperlink in the body
   text below (never in backticks anywhere in this file), on no skip-list, guaranteed to
   404. Proves the NEW markdown-link extraction path fails correctly too -- without this
   route, a script that still only reads backtick spans could pass this fixture undetected
   (route 3 alone would still fail it), which is exactly the "negative control doesn't
   actually exercise what changed" gap this mission just caught in its own first draft above.

Expected result running the real script against this fixture, right now (post-widening):
FAIL (exit 1), because of routes 3 AND 4. If it fails citing only route 3, markdown-link
extraction is still missing -- that is a real finding, not a fixture bug. Do not "fix" this
fixture to make it pass -- fix it only if the real "tickets" or "national-show/about" route's
status ever changes underneath it.
-->

# F8 walkthrough routes -- negative-control fixture

Visit the live [Tickets hub](/tickets) to see every category in one place.

The rebuilt National Show landing page lives at `/national-show/about` (NOS session route,
still pending tonight -- expected in the pending-NOS skip list, not expected to 200 yet).

For completeness, also see `/this-route-does-not-exist-f8-fixture-check` -- this route is
intentionally fake and must cause the check to fail.

One more: see also [this markdown-link-only page](/this-markdown-link-route-does-not-exist-f8-fixture-check),
which is also intentionally fake, referenced only as a markdown link, and must independently
cause the check to fail.
