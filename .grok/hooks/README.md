# Grok Hooks — none, deliberately

**grok 1.0.40 discovers no hooks here, and Athanor no longer pretends it does.**

Measured 2026-09-21 with `grok --trust --debug`, in this repo and in a clean
sandbox built from it:

    hooks: discovery complete total_hooks=0 session_start=0 pre_tool=0 post_tool=0

Neither spelling was discovered — `.grok/hooks/pre-tool-use.json`,
`.grok/hooks/hooks.json`, or the `.claude/settings.json` Claude-compat path that
the previous version of this file claimed Grok reads natively. That claim came
from a docs fetch in August 2026 and was never driven against the binary. A
control run in the same sandbox appended to a floor-protected file with the
autonomy floor correctly registered, so the measurement is not vacuous: nothing
fired.

The cause was not pinned. The JSON shape matches xAI's own schema, `--trust`
does not change the count, and the folder-trust store is not the gate.

## Why this directory is empty instead of fixed

The operator's call, 2026-09-21: **hooks that get an agent working are worth
having; hooks that hang one are slop.** A blocking `pre_tool_use` gate that
fires unreliably across Grok releases is a stall waiting to happen, and Grok's
value here is cheap analysis and QA, not enforcement work.

So Grok is covered the way Codex, OpenCode and Antigravity are: `AGENTS.md`
carries a mandatory first-turn instruction to run `full_boot.sh` by hand, and
`execution/checks/verify_boot_ran.py` checks the marker afterwards.

## Why `session-start.json` is still here

It is retained, not resurrected. It was deleted in this change and the fleet
acceptance gate refused the commit -- a deletion no assertion grades needs the
operator to approve it by path, which is the guard working exactly as intended.
Restoring costs nothing: grok never discovers the file, so it is inert either
way, and `supports_hooks: false` is what actually tells the harness the truth.

## What that costs, stated plainly

The autonomy floor does not bind a Grok session. It cannot write a
floor-protected path and be stopped, because no `pre_tool_use` hook runs. That
is true of every provider except Claude Code, and it is documented rather than
patched — see `.agent/rules/_core/athanor.md`.

## If you are tempted to re-enable this

Do not flip `supports_hooks` back to `true` in
`.agent/providers/grok-cli.json` on the strength of a changelog. Flip it on the
strength of a debug log showing `pre_tool>0` and a hook that actually denied
something.
