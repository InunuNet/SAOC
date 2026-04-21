# Claude Code Hooks — Rules

## Valid hook types
Claude Code supports exactly four hook types: `command`, `prompt`, `http`, `agent`.
Using any other type silently breaks ALL hooks in the file — not just the bad entry.
Always validate against https://docs.anthropic.com/en/docs/claude-code/hooks before shipping.

## Never use `|| true` on blocking hooks
PreToolUse hooks use `exit 2` to block a tool call. Appending `|| true` converts the exit
code to 0 (allow), making every guard silently non-functional. Handle missing-dependency
fallbacks inside the script itself, never at the shell call site.

## Use bash for PreToolUse path checks
Python3 startup is 50–80 ms per invocation. PreToolUse fires on every tool call.
Use bash `case "$VAR" in *pattern*) exit 2 ;; esac` for path/string checks.
Only use python3 when you need JSON parsing or logic bash cannot handle.

## Never symlink platform skill/agent directories
Claude Code does not traverse directory symlinks when scanning `.claude/skills/` or
`.claude/agents/`. Use real directories with copied files. Run `make sync` to populate them.
Same applies to `.gemini/skills/` and `.gemini/agents/`.

## Always use `rsync -a --delete` for directory overlays
`cp -r` merges but never removes orphan files from old template versions. Use
`rsync -a --delete` for all directory overlays. Always include `.claude/settings.json`
in template overlays — missing it leaves downstream projects on stale hook configs.
