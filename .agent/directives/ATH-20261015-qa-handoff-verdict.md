---
schema: athanor.directive/v1
id: ATH-20261015-qa-handoff-verdict
targets: [all]
issued_at: '2026-10-15'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.30 — the qa->docs handoff gate now requires a PASS verdict for the current mission
verify: python3 execution/directives.py list
---

Athanor v3.8.30 fixes the handoff gate defect Dex Test found in the Log Lens
ghost chain: `handoff_check.py --from qa --to docs` passed a QA report whose
verdict was FAIL, because it checked only that the report existed and was
recent.

What changed:

- The qa->docs gate now reads `## Verdict`. It passes only on PASS. FAIL,
  BLOCKED, an empty or missing verdict, or a later FAIL/BLOCKED line in the
  same section exit 2.
- While a mission is active, only `qa-report-<mission slug>.md` counts. A
  report for another mission neither blocks nor satisfies the gate.
- The QA report template and the qa agent now use one verdict format:
  `PASS | FAIL | BLOCKED — <reason>`.

If your own QA reports use another file name or verdict line, the gate will
now block them. Write them with the `write-handoff` skill.

Do this in your own checkout:

1. Run `make update-template` twice.
2. Read the "Verdict gate (v3.8.30)" section of `docs/workflow-gates.md`.
3. Record the outcome:
   `python3 execution/directives.py ack ATH-20261015-qa-handoff-verdict --result applied`
