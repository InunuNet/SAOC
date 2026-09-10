#!/usr/bin/env python3
"""GOLDEN -- place at execution/checks/verify_yaml_safe.py.

Mechanical proof for contract-f1.yaml (yaml-authoring-guardrails, F1).

Imports the real execution/yaml_safe.py and proves three things about
safe_scalar(text):

  1. Detection -- both known failure classes (unquoted colon+whitespace,
     unquoted whitespace+hash) are recognized and wrapped in a block
     literal; safe/simple strings are returned byte-for-byte unchanged
     (no unnecessary block-literal noise).
  2. Round-trip -- the block-literal output, when actually spliced into a
     real YAML document (`key: <output>` at column 0) and parsed with
     yaml.safe_load(), reproduces the EXACT original string. This is the
     load-bearing assertion: a "safe" helper that produces YAML which
     still fails to parse, or parses to a mangled string, is worse than
     no helper at all.
  3. CLI entry point -- `python3 execution/yaml_safe.py` reads stdin and
     writes the safe form to stdout, exercised for one fixture from each
     failure class.

Exits 0 and prints OK on success. Exits 1 with a diagnostic on any
assertion failure -- never silently passes.
"""
import subprocess
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

# Real strings hit during this session (2026-08-25), see mission Context.
COLON_SPACE_FIXTURE = (
    'INJECT="[context: ${CTX_STR} (used, not remaining) | '
    'quota used: ${Q_STR} (not remaining) | refresh: ${R_HRS}]"'
)
HASH_SPACE_FIXTURE = "explicit regression-guard assertion citing the GH #1343 rationale"
SAFE_FIXTURE = "union-merge JSON lists in deep_merge() so local-only hooks survive"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def assert_roundtrip(original: str, safe: str, label: str) -> None:
    doc_text = f"key: {safe}\n"
    try:
        loaded = yaml.safe_load(doc_text)
    except yaml.YAMLError as exc:
        fail(f"{label}: spliced YAML failed to parse -- {exc}\n---\n{doc_text}\n---")
        return
    if not isinstance(loaded, dict) or "key" not in loaded:
        fail(f"{label}: spliced YAML did not parse to a dict with 'key' -- got {loaded!r}")
    if loaded["key"] != original:
        fail(
            f"{label}: round-trip mismatch.\n"
            f"  original: {original!r}\n"
            f"  parsed:   {loaded['key']!r}"
        )


def main() -> int:
    import yaml_safe  # noqa: E402 (path inserted above)

    # --- 1. Detection ---
    colon_safe = yaml_safe.safe_scalar(COLON_SPACE_FIXTURE)
    if colon_safe == COLON_SPACE_FIXTURE:
        fail("colon+whitespace fixture was NOT wrapped -- detection missed a real failure case")
    if not colon_safe.lstrip().startswith("|"):
        fail(f"colon+whitespace fixture wrapped but not as a block literal: {colon_safe!r}")

    hash_safe = yaml_safe.safe_scalar(HASH_SPACE_FIXTURE)
    if hash_safe == HASH_SPACE_FIXTURE:
        fail("whitespace+hash fixture was NOT wrapped -- detection missed a real failure case")
    if not hash_safe.lstrip().startswith("|"):
        fail(f"whitespace+hash fixture wrapped but not as a block literal: {hash_safe!r}")

    safe_unchanged = yaml_safe.safe_scalar(SAFE_FIXTURE)
    if safe_unchanged != SAFE_FIXTURE:
        fail(
            "a simple/safe string was needlessly wrapped -- helper must return plain text "
            f"unchanged when no ambiguous construct is present. got: {safe_unchanged!r}"
        )

    # Sanity: prove the fixtures actually break plain-scalar YAML unwrapped,
    # so the detection above is proven against a REAL failure, not a guess.
    try:
        parsed_raw = yaml.safe_load(f"key: {COLON_SPACE_FIXTURE}\n")
        if parsed_raw is not None and parsed_raw.get("key") == COLON_SPACE_FIXTURE:
            fail(
                "sanity check failed: colon+space fixture parsed correctly UNWRAPPED -- "
                "fixture no longer reproduces the real failure this helper guards against"
            )
    except yaml.YAMLError:
        pass  # expected -- confirms the fixture is a genuine plain-scalar break

    try:
        parsed_raw = yaml.safe_load(f"key: {HASH_SPACE_FIXTURE}\n")
        if parsed_raw is not None and parsed_raw.get("key") == HASH_SPACE_FIXTURE:
            fail(
                "sanity check failed: whitespace+hash fixture parsed correctly UNWRAPPED -- "
                "fixture no longer reproduces the real failure this helper guards against"
            )
    except yaml.YAMLError:
        pass

    # --- 2. Round-trip proof (the load-bearing assertion) ---
    assert_roundtrip(COLON_SPACE_FIXTURE, colon_safe, "colon+whitespace")
    assert_roundtrip(HASH_SPACE_FIXTURE, hash_safe, "whitespace+hash")
    assert_roundtrip(SAFE_FIXTURE, safe_unchanged, "safe/unchanged")

    # --- 3. CLI entry point, one case per failure class ---
    for fixture, label in ((COLON_SPACE_FIXTURE, "colon+whitespace"), (HASH_SPACE_FIXTURE, "whitespace+hash")):
        proc = subprocess.run(
            [sys.executable, str(REPO_ROOT / "execution" / "yaml_safe.py")],
            input=fixture,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            fail(f"CLI ({label}) exited {proc.returncode}: {proc.stderr}")
        cli_out = proc.stdout.rstrip("\n")
        lib_out = yaml_safe.safe_scalar(fixture)
        if cli_out != lib_out:
            fail(
                f"CLI ({label}) output does not match safe_scalar() output.\n"
                f"  CLI: {cli_out!r}\n"
                f"  lib: {lib_out!r}"
            )
        assert_roundtrip(fixture, cli_out, f"CLI {label}")

    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
