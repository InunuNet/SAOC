---
schema: athanor.directive/v1
id: ATH-20261115-dispatch-names-visible
targets: [all]
issued_at: '2026-11-15'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: Name every Agent dispatch Role_Model_Slug so the agent list shows role and model
verify: python3 execution/dispatch_name.py --role analyst --model sonnet --slug zaus-research | grep -qx Analyst_Son55_ZausResearch
---

Brad, 2026-11-15: "they're not sticking to the naming rules so I can't tell if it's Opus or
Sonnet or Google or OpenAI like I can't tell which models are running".

- **The rule now loads in every session** (3.8.153): `.claude/rules/dispatch-naming.md` has no
  `paths:` scope any more. It used to load only when an agent file was touched, so leads never
  saw it when dispatching. Your AGENTS.md is yours and is not changed.
- **Every Agent dispatch passes `name`.** Render it with `python3 execution/dispatch_name.py
  --role <role> --model <model> --mission <slug> --milestone Mn --feature Fn`, or outside a
  mission `--slug <topic>`, e.g. `Analyst_Son55_ZausResearch`. Names like `zaus-research` or
  `format-architect` are wrong: they hide the model.
- **Model tags:** Claude `Son55`, `Opu55`, `Hai55`, `Fab52`; Codex `Sol6`, `Ast6`, `Lun6`;
  Antigravity `Hyd4`, `Arg4`. Unmapped models render family + version (`Opu46`, `Qwen25`), and a
  non-high Gemini effort adds a letter (`Hyd4L`).
- **Codex/Antigravity shells** (`codex_dev.sh`, `agy_dev.sh`, `qa.sh`, `codex exec`) start the
  Bash `description` with the same tag, e.g. `Dev_Sol6 codex_dev OneRustUi`.
- **Retry ladder:** `--retry N` now also prints the Agent tool alias (`model: opus`).
