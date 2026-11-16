---
description: Every Agent dispatch is named Role_Model so the operator's agent list shows role and model. Always loaded.
---

# Agent Dispatch Names

Every Agent tool call passes `name` (the agent list shows it), rendered by
`python3 execution/dispatch_name.py --role <role> --model <model>` plus `--mission <slug>
--milestone Mn --feature Fn` (`Dev_Son55_M1-F2_OneRustUi`) or, outside a mission, `--slug
<topic>` (`Analyst_Son55_ZausResearch`). Never a bare topic like `zaus-research`: it hides the model.

Tags: Claude `Son55` `Opu55` `Hai55` `Fab52`; Codex `Sol6` `Ast6` `Lun6`; Antigravity `Hyd4`
(gemini-4-hydrogen-high) `Arg4` (gemini-4-argon-high). Unmapped models get family + version, a
non-high effort adds a letter (`Opu46`, `Qwen25`, `Hyd4L`); always pass the Gemini effort.
A Codex/Antigravity shell (`codex_dev.sh`, `agy_dev.sh`, `qa.sh`, `codex exec`) starts its Bash
description with the same tag: `Dev_Sol6 codex_dev OneRustUi`.

Retry after a QA FAIL climbs one rung (`--retry N` prints it): `model: sonnet`, then `opus`,
then `fable` (ceiling); the tier ids `sonnet5`/`opus5`/`fable5` are labels, `model:` takes the alias.
