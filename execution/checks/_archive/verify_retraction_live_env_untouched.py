#!/usr/bin/env python3
"""
A1 fixture (contract-f3.yaml): reproduces the reported premise directly --
apply_retractions() removes the key from settings.json but a var already
exported in THIS process's os.environ remains set afterward. Locks in the
confirmed premise as a regression guard, not just documentation.

Usage: verify_retraction_live_env_untouched.py
Exit codes: 0 pass, 1 fail.
"""
import json
import os
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

BAD_LITERAL = "$ANTHROPIC_DEFAULT_HAIKU_MODEL"
ENV_VAR_NAME = "ANTHROPIC_DEFAULT_HAIKU_MODEL"


def main() -> int:
    import update_template

    os.environ[ENV_VAR_NAME] = BAD_LITERAL

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / ".claude").mkdir()
        settings_path = tmp_path / ".claude" / "settings.json"
        settings_path.write_text(json.dumps({"env": {ENV_VAR_NAME: BAD_LITERAL}}))

        manifest = {"retractions": [{
            "path": ".claude/settings.json",
            "key_path": f"env.{ENV_VAR_NAME}",
            "bad_value": BAD_LITERAL,
            "action": "remove",
            "reason": "A1 fixture",
        }]}
        update_template.apply_retractions(manifest, project_root=tmp_path, backup_dir=None, dry_run=False)

        after = json.loads(settings_path.read_text())
        key_retracted = ENV_VAR_NAME not in after.get("env", {})
        live_env_untouched = os.environ.get(ENV_VAR_NAME) == BAD_LITERAL

    if not key_retracted:
        print("FAIL: key not retracted from settings.json")
        return 1
    if not live_env_untouched:
        print("FAIL: live process env unexpectedly changed by apply_retractions")
        return 1

    print("PASS: premise confirmed -- settings.json retracted, live process env untouched")
    return 0


if __name__ == "__main__":
    sys.exit(main())
