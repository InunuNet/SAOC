#!/usr/bin/env python3
"""WS3 smoke test — manifest loader returns correct provider commands.
Single-file helper (no multiline python -c in contract; see soul mandate)."""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO))
import execution.pulse_dispatcher as d  # noqa: E402

root = REPO

# Unknown provider -> empty manifest, graceful fallback to [provider, prompt].
m = d.load_manifest("nonexistent-provider", root)
assert m == {}, f"expected empty dict, got {m!r}"
cmd = d.build_provider_cmd("nonexistent-provider", "hello", 1, root)
assert cmd == ["nonexistent-provider", "hello"], f"unexpected fallback: {cmd!r}"

# claude-code -> manifest headless_command + --max-turns appended.
cmd2 = d.build_provider_cmd("claude-code", "test prompt", 3, root)
assert cmd2[:3] == ["claude", "-p", "test prompt"], f"unexpected claude cmd: {cmd2!r}"
assert "--max-turns" in cmd2, f"expected --max-turns in claude cmd: {cmd2!r}"

# opencode -> supports_max_turns false, no flag.
cmd3 = d.build_provider_cmd("opencode", "test prompt", 3, root)
assert "--max-turns" not in cmd3, f"unexpected --max-turns in opencode cmd: {cmd3!r}"

# codex -> new manifest, exec subcommand, no max-turns.
cmd4 = d.build_provider_cmd("codex", "test prompt", 3, root)
assert cmd4 == ["codex", "exec", "test prompt"], f"unexpected codex cmd: {cmd4!r}"

print("WS3 smoke PASS")
