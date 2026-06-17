#!/usr/bin/env python3
"""Smoke test: directive hash changes on header add, stable on other changes."""
import subprocess, tempfile, pathlib, sys


def compute_hash(comms_content: str) -> str:
    with tempfile.TemporaryDirectory() as d:
        p = pathlib.Path(d)
        comms = p / "comms.md"
        comms.write_text(comms_content)
        # Simulate the bash hash computation
        directives = "\n".join(
            line.replace(" ", "")
            for line in comms_content.splitlines()
            if line.startswith("## [")
        )
        if not directives:
            directives = "no-directives"
        active_json = ""
        combined = f"{directives}\n{active_json}"
        result = subprocess.run(
            ["shasum", "-a", "256"],
            input=combined.encode(),
            capture_output=True,
        )
        return result.stdout.decode().split()[0]


base = "# Athanor Comms\n\nSome content here.\nMore content.\n"
hash1 = compute_hash(base)

# Stability: adding non-header content should NOT change hash
hash2 = compute_hash(base + "\nExtra line added.\n")
assert hash1 == hash2, f"Hash changed on non-header content: {hash1} vs {hash2}"

# Sensitivity: adding a directive header SHOULD change hash
hash3 = compute_hash(base + "\n## [CODI -> DEX] 2026-06-16 — new directive\n")
assert hash1 != hash3, f"Hash did not change on new directive: {hash1} vs {hash3}"

print("smoke_hash_norm PASS")
