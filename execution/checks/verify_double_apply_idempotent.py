#!/usr/bin/env python3
"""A8: running update_template.py --apply twice on an already-current workspace is a no-op
on the second run — target tree content is byte-identical before and after the second run."""
import hashlib
import pathlib
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
SANDBOX_BUILDER = REPO_ROOT / ".agent/memory/project/specs/template-update-safety/goldens/build_sandbox.sh"
DEST = pathlib.Path("/tmp/tus-a8")


def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def tree_hash(root: pathlib.Path) -> str:
    h = hashlib.sha256()
    for f in sorted(root.rglob("*")):
        if f.is_file():
            h.update(str(f.relative_to(root)).encode())
            h.update(f.read_bytes())
    return h.hexdigest()


def main():
    subprocess.run(["bash", str(SANDBOX_BUILDER), str(DEST)], check=True, capture_output=True)
    target = DEST / "target"

    r1 = subprocess.run(
        ["python3", "execution/update_template.py", "--apply", "--source", str(DEST / "template")],
        cwd=str(target), capture_output=True, text=True,
    )
    if r1.returncode != 0:
        fail(f"first apply failed: {r1.stderr!r}")

    hash_after_first = tree_hash(target)

    r2 = subprocess.run(
        ["python3", "execution/update_template.py", "--apply", "--source", str(DEST / "template")],
        cwd=str(target), capture_output=True, text=True,
    )
    if r2.returncode != 0:
        fail(f"second apply failed: {r2.stderr!r}")

    hash_after_second = tree_hash(target)

    if hash_after_first != hash_after_second:
        fail("second apply on an already-current workspace changed the tree (not idempotent)")

    print("OK: double apply is idempotent")


if __name__ == "__main__":
    main()
