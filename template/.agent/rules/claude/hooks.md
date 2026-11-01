---
description: Claude Code hook configuration and usage rules.
paths:
  - ".claude/settings.json"
  - ".claude/hooks/**"
---

# Claude Code Hooks

- Claude Code supports exactly four hook types: `command`, `prompt`, `http`, `agent`. Any other
  type silently breaks ALL hooks in the file. Validate against
  https://docs.anthropic.com/en/docs/claude-code/hooks before shipping.
- Never use `|| true` on blocking hooks: PreToolUse blocks with `exit 2`, and `|| true` turns it
  into 0 (allow). Handle missing dependencies inside the script.
- PreToolUse fires on every tool call; use bash `case "$VAR" in *pattern*) exit 2 ;; esac` for
  path checks (python3 costs 50-80 ms), python3 only for JSON parsing.
- Never symlink platform skill/agent directories: Claude Code does not traverse them in
  `.claude/skills/` or `.claude/agents/`. Use real copies (`make sync`).
- Always use `rsync -a --delete` for directory overlays (`cp -r` never removes orphans), and
  include `.claude/settings.json` in template overlays.
