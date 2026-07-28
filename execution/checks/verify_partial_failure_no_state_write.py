#!/usr/bin/env python3
"""A6: a partial-failure update_template.py --apply must not write .agent/.template_state.

Builds a sandbox via build_sandbox.sh, injects a MERGE entry with an unreadable/malformed
JSON source (forces an uncaught exception mid-run after earlier entries may have already
been processed), runs --apply, and asserts: (a) the process exits non-zero, (b)
.agent/.template_state does not exist afterward.
"""
import json
import pathlib
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
SANDBOX_BUILDER = REPO_ROOT / ".agent/memory/project/specs/template-update-safety/goldens/build_sandbox.sh"
DEST = pathlib.Path("/tmp/tus-a6")


def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    subprocess.run(["bash", str(SANDBOX_BUILDER), str(DEST)], check=True, capture_output=True)

    manifest_path = DEST / "target/.agent/update-manifest.yaml"
    manifest = manifest_path.read_text()
    manifest += "\n  - category: MERGE\n    strategy: json_deep_merge\n    path: broken.json\n"
    manifest_path.write_text(manifest)

    template_broken = DEST / "template/broken.json"
    template_broken.write_text("{ this is not valid json ")

    target_broken = DEST / "target/broken.json"
    target_broken.write_text("{}")

    result = subprocess.run(
        ["python3", "execution/update_template.py", "--apply", "--source", str(DEST / "template")],
        cwd=str(DEST / "target"),
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        fail(f"expected non-zero exit on partial failure, got 0. stdout={result.stdout!r} stderr={result.stderr!r}")

    state_file = DEST / "target/.agent/.template_state"
    if state_file.exists():
        fail(f".template_state was written despite a mid-run failure: {state_file.read_text()!r}")

    print("OK: partial-failure apply did not write .template_state")


if __name__ == "__main__":
    main()
