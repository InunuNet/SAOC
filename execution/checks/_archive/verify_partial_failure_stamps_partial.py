#!/usr/bin/env python3
"""A6: a partial-failure update_template.py --apply must not LIE about what it applied.

Renamed 2026-08-29 from verify_partial_failure_no_state_write.py: the old name
asserted the opposite of what this check now verifies (see SUPERSEDED MECHANISM
below). A check whose name contradicts its body is the same defect class this
mission exists to remove.

SUPERSEDED MECHANISM (delivery-integrity F4, 2026-08-29). This check originally
asserted that a partial-failure run does not write .agent/.template_state at all.
The assertion's INTENT — the version stamp must never claim a delivery the
filesystem did not receive — is unchanged and still correct. The mechanism that
satisfies it was deliberately reversed: gating the write on a clean run freezes
the stamp at the old version on exactly the runs that delivered most of their
content, which understates delivery and reproduces the frozen-stamp ambiguity
that destroys the version-monotonicity guard's discriminator (that is the shape
of the live consumer's stuck-at-3.7.123 stamp). So the stamp is now written on
every --apply and carries its own `delivery` field instead.

Restated for the new mechanism, asserting the same thing:
  (a) the process still exits non-zero,
  (b) .agent/.template_state IS written, and honestly records delivery="partial"
      together with WHAT was withheld or failed — so a later reader can tell
      which content is missing, not merely that the number moved.
A stamp that recorded delivery="complete" after this run would be the lie the
original assertion existed to prevent.

Builds a sandbox via build_sandbox.sh and injects a MERGE entry with a malformed
JSON source, which forces a caught mid-run entry failure after earlier entries
have already been processed.
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
    if not state_file.exists():
        fail(
            "no .agent/.template_state written. Gating the stamp on a clean run "
            "freezes it at the old version while the filesystem has in fact "
            "received most of the new content — a different lie, and the one "
            "that destroys the version guard's discriminator"
        )

    try:
        state = json.loads(state_file.read_text())
    except Exception as e:
        fail(f".agent/.template_state is not parseable JSON: {e}")

    delivery = state.get("delivery")
    if delivery != "partial":
        fail(
            f"a run that failed an entry stamped delivery={delivery!r} — the "
            "version stamp asserts a state the filesystem does not have, and "
            f"every downstream drift check trusts it. State: {state!r}"
        )

    named = list(state.get("failed") or []) + list(state.get("withheld") or [])
    if not named:
        fail(
            "the stamp records delivery='partial' but names nothing that was "
            f"withheld or failed — a later reader cannot tell WHICH content is "
            f"missing, only that some is. State: {state!r}"
        )

    print("OK: partial-failure apply exits non-zero and stamps an honest delivery='partial'")


if __name__ == "__main__":
    main()
