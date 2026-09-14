# p1-two-unparseable-contracts-their-asser

**[P1] TWO unparseable contracts — their assertions have never run**
  (found 2026-09-08 via F7's new contract-suite runner, mission ticketing-complete).
  (a) `.agent/memory/project/specs/gate-timeout-fix/contract-f1.yaml` — ambiguous compact mapping.
  (b) `.agent/memory/project/specs/mission-slug-collision-fix/contract-f1.yaml` — a heredoc `---`
  misread as a YAML document separator; found only when the baseline was regenerated, i.e. the
  first sweep missed it. Both fail YAML parsing, so every assertion they declare has silently
  never executed and never will. It is not counted as `missing` (no absent check script) and not
  as `fail` (nothing runs), so no signal exists anywhere today. Fix the YAML, then confirm the
  assertions actually pass — they have never been evaluated, so treat all of them as unverified
  rather than assuming they were green before the parse broke. F7 has added parse-error to the CI
  ratchet (baseline `{count: 3, parseErrorCount: 2}`) so a third cannot appear silently, but that
  does NOT fix these two files. Worth a sweep
  for the same defect class: any other contract that parses but whose assertions have never been
  executed is equally invisible.
