#!/usr/bin/env python3
"""Mechanical proof for contract A-checks: imports the real, patched
deep_merge() from execution/update_template.py and runs it on the fixture
pair (local_settings.json = has local-only hook additions not yet
upstreamed; upstream_settings.json = what upstream currently ships,
lacking those additions -- mirrors the exact incident: a brand-new
local-only PreToolUse hook entry that update_template.py --apply dropped).

Exits 0 and prints OK on success. Exits 1 with a diagnostic on any
assertion failure -- never silently passes.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

FIXTURE_DIR = REPO_ROOT / ".agent/memory/project/specs/self-update-preserve-local-hooks/goldens/fixture"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def main() -> int:
    import update_template  # noqa: E402  (path inserted above)

    local = json.loads((FIXTURE_DIR / "local_settings.json").read_text())
    upstream = json.loads((FIXTURE_DIR / "upstream_settings.json").read_text())

    # Mirrors merge_json_deep()'s call shape: deep_merge(dst_data, src_data)
    # where dst=local (base, wins ties structurally) and src=upstream
    # (override, wins on scalar conflicts).
    merged = update_template.deep_merge(local, upstream)

    allow = merged["permissions"]["allow"]
    if "LocalOnlyPermission" not in allow:
        fail("local-only permission entry was dropped by the merge")
    if "Write" not in allow:
        fail("upstream-only permission entry was not unioned in")
    if len(allow) != len(set(allow)):
        fail(f"permissions.allow union produced duplicates: {allow}")

    pre_tool_use = merged["hooks"]["PreToolUse"]
    matchers = {g["matcher"]: g for g in pre_tool_use}

    if "LocalOnlyMatcher" not in matchers:
        fail("local-only matcher group (hooks.PreToolUse) was dropped by the merge")

    bash_commands = [h["command"] for h in matchers["Bash"]["hooks"]]
    if not any("local_only_new_hook.sh" in c for c in bash_commands):
        fail("local-only hook command inside the shared 'Bash' matcher group was dropped")
    if not any("check_autonomy.sh" in c for c in bash_commands):
        fail("shared upstream hook command was lost during union")
    if len(bash_commands) != len(set(bash_commands)):
        fail(f"Bash matcher hooks union produced duplicates: {bash_commands}")

    print("OK: local-only hook entries and permissions survive deep_merge()")
    return 0


if __name__ == "__main__":
    sys.exit(main())
