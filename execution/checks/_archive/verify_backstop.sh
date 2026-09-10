#!/usr/bin/env bash
# verify_backstop.sh — assertion A20 helper.
#
# Proves that apply_missing_file_backstop() in update_template.py correctly
# copies the four REQUIRED_FILES into a target workspace that lacks them.
#
# Exit codes:
#   0 — all four required files were copied into the target workspace
#   1 — at least one required file was not copied (backstop failed)

set -uo pipefail

TMP=""
cleanup() {
  if [ -n "$TMP" ]; then
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT INT TERM

# Current directory is the Athanor repo (source of harness files).
SRC="$(pwd)"

TMP="$(mktemp -d)"

# Bootstrap the minimal workspace structure that update_template.py requires.
mkdir -p "${TMP}/.agent"
cp "${SRC}/.agent/update-manifest.yaml" "${TMP}/.agent/update-manifest.yaml"

# Minimal WORKSPACE file (not "Athanor" — must not trigger self-update guard).
echo "TestWorkspace" > "${TMP}/WORKSPACE"

# Minimal profile.json.
cat > "${TMP}/.agent/profile.json" <<'JSON'
{"project_name": "TestWorkspace", "onboarding_complete": true, "template_version": "0.0.0"}
JSON

# Run update_template.py from inside the temp workspace, sourcing from SRC.
# FORCE_UPDATE is not needed since WORKSPACE != "Athanor".
cd "${TMP}"
if ! python3 "${SRC}/execution/update_template.py" --apply --source "${SRC}" > /dev/null 2>&1; then
  echo "FAIL: update_template.py --apply exited non-zero" >&2
  exit 1
fi

# Verify all four REQUIRED_FILES were installed.
REQUIRED_FILES=(
  "execution/handoff_check.py"
  "execution/mission.py"
  "execution/contract.py"
  ".agent/handoffs.yaml"
)

FAILED=0
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -e "${TMP}/${f}" ]; then
    echo "FAIL: backstop did not copy ${f} into target workspace" >&2
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  exit 1
fi

echo "OK: backstop copied all ${#REQUIRED_FILES[@]} required files into target workspace"
exit 0
