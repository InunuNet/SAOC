---
description: Structured agent dispatch names and the retry effort ladder.
---

# Structured Agent Dispatch Names

Before every Agent-tool dispatch render the name with `python3 execution/dispatch_name.py
--role <role> --model <model> --mission <slug> --milestone <id> --feature <id>` and use its
stdout verbatim as the Agent tool's `name:` (e.g. `Dev_Son5_M1-F1_HomeScaffolding`). Never
hand-render one; `--help` lists the arguments. It is a pure function of its inputs and reads no
mission state, so a wrong milestone silently yields a wrong name.

Retry after a QA FAIL on the same feature+role climbs one rung: first dispatch sonnet5, retry 1
opus5, retry 2+ fable5 (ceiling). `--retry N` only prints an advisory on stderr; if you take
it, pass the tier as both `--model` and the Agent tool's `model:`.
