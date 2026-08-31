#!/usr/bin/env bash
# GH #1298 — mission.py resume must read on-disk spec truth. When F1's
# contract already exists at specs/<slug>/contract-f1.yaml AND validates,
# resume must dispatch @dev against it instead of telling the agent to
# re-run /spec (which would redo finished @architect work after a
# compaction/cold-restart).
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1298_resume_prefers_existing_contract.sh <repo_root>}"
GOLDENS_DIR="$REPO_ROOT/.agent/memory/project/specs/hotfix-1298-1299-mission-resume-checkpoint/goldens"
GOLDEN_MISSION="$GOLDENS_DIR/mission-with-contract.md"
GOLDEN_CONTRACT="$GOLDENS_DIR/contract-f1.yaml"

SANDBOX=$(mktemp -d)
# mission.py resolves specs_base from its own on-disk location (__file__),
# independent of CWD — so the golden contract fixture must live under the
# real repo tree, not under the CWD sandbox, or _existing_contract_for_feature()
# will never find it.
trap 'rm -rf "$SANDBOX" "$REPO_ROOT/.agent/memory/project/specs/golden-1298-with-contract"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
mkdir -p "$REPO_ROOT/.agent/memory/project/specs/golden-1298-with-contract"
MISSION="$SANDBOX/.agent/memory/project/missions/mission-with-contract.md"
cp "$GOLDEN_MISSION" "$MISSION"
cp "$GOLDEN_CONTRACT" "$REPO_ROOT/.agent/memory/project/specs/golden-1298-with-contract/contract-f1.yaml"

cd "$SANDBOX"
OUTPUT=$(python3 "$REPO_ROOT/execution/mission.py" resume "$MISSION")

if echo "$OUTPUT" | grep -qi "run /spec"; then
  echo "FAIL: resume still told the agent to run /spec even though a validating contract exists on disk"
  echo "$OUTPUT"
  exit 1
fi

if ! echo "$OUTPUT" | grep -qi "dispatch @dev against existing contract"; then
  echo "FAIL: resume did not emit the expected 'dispatch @dev against existing contract' hint"
  echo "$OUTPUT"
  exit 1
fi

if ! echo "$OUTPUT" | grep -q "specs/golden-1298-with-contract/contract-f1.yaml"; then
  echo "FAIL: resume did not point at the actual on-disk contract path"
  echo "$OUTPUT"
  exit 1
fi

echo "PASS: resume dispatches @dev against the existing validating contract instead of re-running /spec"
