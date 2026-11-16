---
description: Agent dispatch names by convention and the retry effort ladder.
paths:
  - ".agent/agents/*.md"
  - ".claude/agents/*.md"
---

# Agent Dispatch Names

Pass `Role_Model_Mn-Fn_Slug` in the Agent tool's `name` field (that is what the agent list shows),
rendered with `python3 execution/dispatch_name.py`. Outside a mission use `--slug` for
`Role_Model_Slug` (no `Mn-Fn` segment), e.g. `Analyst_Son55_ZausResearch`.

Model tags:
- Claude: `Son55` (sonnet), `Opu55` (opus), `Hai55` (haiku), `Fab52` (fable)
- Codex: `Sol6` (gpt-6-sol), `Ast6` (gpt-6-astra), `Lun6` (gpt-6-luna)
- Antigravity: `Hyd4` (gemini-4-hydrogen-high), `Arg4` (gemini-4-argon-high); a bare
  `gemini-4-hydrogen`/`-argon` renders the same tag, so always pass the effort
- Unmapped models get family + version, and a non-high effort letter: `claude-opus-4-6` →
  `Opu46`, `qwen-2.5-coder-32b-free` → `Qwen25`, `gemini-4-hydrogen-low` → `Hyd4L`

For Codex/Antigravity background shells (`codex_dev.sh`, `agy_dev.sh`, `qa.sh`, `codex exec`),
start the Bash `description` with the same tag, e.g. `Dev_Sol6 codex_dev OneRustUi`.

Retry after a QA FAIL on the same feature+role climbs one rung (`--retry N` prints it): first
dispatch `model: sonnet`, retry 1 `model: opus`, retry 2+ `model: fable` (ceiling). The ladder's
tier ids `sonnet5`/`opus5`/`fable5` are labels; the Agent tool's `model:` takes the bare alias.
