# p2-f6-nav-rebuild-gate-is-red-at-exit-6

**[P2] F6 nav rebuild gate is red at exit 6, feature otherwise complete** (found
  2026-09-08, mission `ticketing-complete`). The nav rebuild itself is implemented, and both
  `codex_qa` (A20) and `browser_deployed_check` (A21) triad assertions were added honestly.
  `gws_inbox_check` was deliberately NOT added — a nav rebuild sends no email, so there is no
  truthful `message_id` to assert against — which the triad-gate preflight (see the Athanor
  #1420 entry above) currently has no way to express as a legitimate exemption rather than a
  gap. Not resolvable via `execution/triad-baseline-exempt.txt`, since that is a one-time
  2026-09-06 rollout snapshot of pre-existing contracts, not an open-enrollment exemption list
  for new ones. Blocked on Athanor#1420 landing an applicability escape (an explicit way for a
  contract to declare "this triad kind does not apply here" instead of the classifier guessing
  from assertion text) — do not work around it locally by force-adding a fabricated
  `gws_inbox_check`.
