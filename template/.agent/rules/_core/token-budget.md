# Token Budget

Athanor exists to preserve tokens. A mission that burns quota proving it was thorough has
failed, whatever colour its gate printed.

The dispatch budget is a cap, not a guideline. Per feature: @dev (or a direct fix) 1, @qa 1,
@architect 1 and only when a design decision is declared, everything else (@analyst, @docs,
extra reviewers) 0. Exceeding the cap requires the operator to say so, in the mission, not your
judgment; if a feature needs more, ask in one line.

- Script-level fixes take no chain: one script, reproducible symptom, verifiable fix. Fix it
  and prove it; gate green plus one verification is the ceiling.
- Cheapest tool first: a deterministic script, then a targeted read, then one agent. Never fan
  out agents when you know the file; never re-derive an established fact.
- Verification is proportional to blast radius: one measurement that would have caught the
  defect; record it and stop.
- When quota is short, say so and narrow: finish and commit what you started, report what you
  did not reach.
- Compaction is yours to schedule: after a committed feature with large context run
  `python3 execution/compact.py now`; mid-task, `compact.py delay`, then `restore`.
