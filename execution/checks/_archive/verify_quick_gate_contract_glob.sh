#!/usr/bin/env bash
# Verifies quick_gate.sh's contract lookup glob resolves feature-scoped contract
# filenames (contract-f<N>.yaml) and still falls back to legacy contract-f1.yaml.
# Usage: verify_quick_gate_contract_glob.sh <feature-scoped|legacy>
set -euo pipefail

MODE="${1:?usage: verify_quick_gate_contract_glob.sh <feature-scoped|legacy>}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

SLUG="quick-gate-glob-fixture"
mkdir -p "$SANDBOX/.agent/memory/project/missions"
mkdir -p "$SANDBOX/.agent/memory/project/specs/$SLUG"

MISSION_FILE=".agent/memory/project/missions/2026-01-01-${SLUG}.md"
touch "$SANDBOX/$MISSION_FILE"
printf '{"mission": "%s"}\n' "$MISSION_FILE" > "$SANDBOX/.agent/memory/project/missions/active.json"

if [[ "$MODE" == "feature-scoped" ]]; then
  EXPECTED="contract-f2.yaml"
elif [[ "$MODE" == "legacy" ]]; then
  EXPECTED="contract-f1.yaml"
else
  echo "FAIL: unknown mode $MODE" >&2
  exit 1
fi

echo "schema: athanor.contract/v1" > "$SANDBOX/.agent/memory/project/specs/$SLUG/$EXPECTED"

OUTPUT="$(cd "$SANDBOX" && bash "$REPO_ROOT/execution/skills/quick_gate.sh" 2>&1 || true)"

if echo "$OUTPUT" | grep -q "$EXPECTED"; then
  echo "PASS: quick_gate.sh resolved $EXPECTED"
  exit 0
fi

echo "FAIL: quick_gate.sh did not resolve $EXPECTED. Output:" >&2
echo "$OUTPUT" >&2
exit 1
