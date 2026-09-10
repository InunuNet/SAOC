#!/usr/bin/env python3
"""Verify OpenRouter keys merged into a pre-existing settings.local.json.
Pre-existing env.FOO must survive; OpenRouter keys must be present + correct."""
import json, sys
d = json.load(open(sys.argv[1]))
e = d.get("env", {})
checks = {
    "FOO (preserved)":        e.get("FOO") == "bar",
    "ANTHROPIC_BASE_URL":     e.get("ANTHROPIC_BASE_URL") == "https://openrouter.ai/api",
    "ANTHROPIC_AUTH_TOKEN":   e.get("ANTHROPIC_AUTH_TOKEN") == "sk-or-test123",
    "ANTHROPIC_API_KEY=empty": e.get("ANTHROPIC_API_KEY") == "",
}
bad = [k for k, ok in checks.items() if not ok]
if bad:
    print("MERGE FAILED:", ", ".join(bad), file=sys.stderr)
    print("env:", json.dumps(e, sort_keys=True), file=sys.stderr)
    sys.exit(1)
sys.exit(0)
