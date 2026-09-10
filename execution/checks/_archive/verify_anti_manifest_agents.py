#!/usr/bin/env python3
"""
verify_anti_manifest_agents.py — Assert named agents are present in
.anti/agents.json with a real (non-stub) system_prompt, and optionally that
the manifest has an exact entry count and no `model` key on any entry.

Usage:
  verify_anti_manifest_agents.py <agent-name> [<agent-name> ...]
      [--expect-count N] [--no-model-key] [--manifest <path>]

Body-length threshold mirrors execution/sync_agents.sh's own SHORT_THRESHOLD,
so an agent registered with a stub body fails the same way sync itself would
refuse to write the manifest.
"""
import json
import sys
from pathlib import Path

SHORT_THRESHOLD = 200


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(
            "usage: verify_anti_manifest_agents.py <agent-name> [...] [--expect-count N] [--no-model-key] [--manifest <path>]",
            file=sys.stderr,
        )
        return 1

    names = []
    expect_count = None
    no_model_key = False
    manifest_path = Path(".anti/agents.json")

    i = 0
    while i < len(args):
        tok = args[i]
        if tok == "--expect-count":
            expect_count = int(args[i + 1])
            i += 2
        elif tok == "--no-model-key":
            no_model_key = True
            i += 1
        elif tok == "--manifest":
            manifest_path = Path(args[i + 1])
            i += 2
        else:
            names.append(tok)
            i += 1

    if not manifest_path.exists():
        print(f"FAIL: manifest not found: {manifest_path}", file=sys.stderr)
        return 1

    try:
        manifest = json.loads(manifest_path.read_text())
    except json.JSONDecodeError as e:
        print(f"FAIL: manifest is not valid JSON: {manifest_path}: {e}", file=sys.stderr)
        return 1

    if not isinstance(manifest, list):
        print(f"FAIL: manifest is not a list: {manifest_path}", file=sys.stderr)
        return 1

    failures = []

    if expect_count is not None and len(manifest) != expect_count:
        failures.append(
            f"manifest entry count mismatch: expected {expect_count}, got {len(manifest)}"
        )

    if no_model_key:
        offenders = [e.get("name", "<unnamed>") for e in manifest if isinstance(e, dict) and "model" in e]
        if offenders:
            failures.append(f"manifest entries carry a model key: {offenders}")

    by_name = {e.get("name"): e for e in manifest if isinstance(e, dict)}
    for name in names:
        entry = by_name.get(name)
        if entry is None:
            failures.append(f"agent not present in manifest: {name}")
            continue
        prompt = entry.get("system_prompt", "")
        if len(prompt) < SHORT_THRESHOLD:
            failures.append(
                f"agent {name} has a stub system_prompt: length {len(prompt)} < {SHORT_THRESHOLD}"
            )

    if failures:
        for f in failures:
            print(f"FAIL: {f}", file=sys.stderr)
        return 1

    print(f"PASS: {len(names)} agent(s) verified in {manifest_path} ({len(manifest)} total entries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
