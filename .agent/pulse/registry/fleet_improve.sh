#!/usr/bin/env bash
# fleet_improve.sh — Fleet-wide GitHub issue monitor and auto-fix loop.
# Checks GitHub issues across all harness repos, fixes them via claude -p,
# and propagates harness-level fixes to the entire fleet via update-template.
# Runs every 10 minutes via Pulse.

set -euo pipefail
LOG="[fleet-improve]"
ATHANOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LOCK_DIR="$ATHANOR_ROOT/.agent/pulse/registry/processing"
mkdir -p "$LOCK_DIR"

# All repos to monitor — harness-level fixes propagate to fleet
HARNESS_REPOS=("InunuNet/Athanor")

# Project-level repos — fixes stay in their own repo
PROJECT_REPOS=("InunuNet/Alembic" "InunuNet/MumblAI" "InunuNet/wh3" "InunuNet/AcruxAccounting" "InunuNet/mlilo-admin" "BDauth/SAOC")

# Fleet paths to update after any harness fix
FLEET_PATHS=(
  "/Users/vetus/ai/Gemini Harness"
  "/Users/vetus/ai/Codex Harness"
  "/Users/vetus/ai/Mumbl AI"
  "/Users/vetus/ai/Alembic"
  "/Users/vetus/ai/SAOC"
  "/Users/vetus/ai/wh3"
  "/Users/vetus/ai/Acrux Accounting"
  "/Users/vetus/ai/Mlilo Admin"
)

HARNESS_FIXED=false

fix_issue() {
  local REPO="$1"
  local NUM="$2"
  local TITLE="$3"
  local BODY="$4"
  local SCOPE="$5"  # "harness" or "project"

  local SIG="$REPO-$NUM"
  local LOCK="$LOCK_DIR/gh-$SIG.lock"
  [[ -f "$LOCK" ]] && return 0
  touch "$LOCK"

  echo "$LOG Fixing $REPO #$NUM: $TITLE"

  cd "$ATHANOR_ROOT"
  claude -p "You are Codi on Athanor harness. Fix this GitHub issue:

REPO: $REPO
ISSUE #$NUM: $TITLE
DETAIL: $BODY

Instructions:
- Investigate the root cause
- Apply a surgical fix using the full harness chain (contract → @dev → gate)
- If this is a harness-level fix (in InunuNet/Athanor): push to main
- Close the issue when fixed: gh issue close $NUM --repo $REPO --comment 'Fixed in <version>'
- Be specific: quote what you changed and why
- Do NOT fix issues that are already closed or invalid" \
    2>&1 | tail -5 || echo "$LOG WARN: fix attempt failed for #$NUM" >&2

  if [[ "$SCOPE" == "harness" ]]; then
    HARNESS_FIXED=true
  fi
}

# --- Check harness repos ---
for REPO in "${HARNESS_REPOS[@]}"; do
  echo "$LOG Checking $REPO for open issues..."
  ISSUES=$(gh issue list --repo "$REPO" --state open --limit 20 --json number,title,body 2>/dev/null || echo "[]")
  COUNT=$(echo "$ISSUES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
  echo "$LOG Found $COUNT open issues in $REPO"

  while IFS=$'\t' read -r NUM TITLE BODY; do
    [[ -z "$NUM" ]] && continue
    fix_issue "$REPO" "$NUM" "$TITLE" "${BODY:0:500}" "harness"
    sleep 30  # cooldown between fixes
  done < <(echo "$ISSUES" | python3 -c "
import sys, json
issues = json.load(sys.stdin)
for i in issues:
    body = (i.get('body') or '').replace('\n',' ').replace('\t',' ')[:500]
    print(f\"{i['number']}\t{i['title']}\t{body}\")
" 2>/dev/null)
done

# --- Check project repos ---
for REPO in "${PROJECT_REPOS[@]}"; do
  echo "$LOG Checking $REPO for open issues..."
  ISSUES=$(gh issue list --repo "$REPO" --state open --limit 10 --json number,title,body 2>/dev/null || echo "[]")
  COUNT=$(echo "$ISSUES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
  echo "$LOG Found $COUNT open issues in $REPO"

  while IFS=$'\t' read -r NUM TITLE BODY; do
    [[ -z "$NUM" ]] && continue
    fix_issue "$REPO" "$NUM" "$TITLE" "${BODY:0:500}" "project"
    sleep 30
  done < <(echo "$ISSUES" | python3 -c "
import sys, json
issues = json.load(sys.stdin)
for i in issues:
    body = (i.get('body') or '').replace('\n',' ').replace('\t',' ')[:500]
    print(f\"{i['number']}\t{i['title']}\t{body}\")
" 2>/dev/null)
done

# --- Propagate harness fixes to fleet ---
if [[ "$HARNESS_FIXED" == "true" ]]; then
  echo "$LOG Harness fixes landed — propagating to fleet..."
  for FLEET_PATH in "${FLEET_PATHS[@]}"; do
    [[ -d "$FLEET_PATH" ]] || continue
    echo "$LOG Updating: $FLEET_PATH"
    python3 execution/update_template.py --apply 2>/dev/null \
      && echo "$LOG Updated $FLEET_PATH" \
      || echo "$LOG WARN: update failed for $FLEET_PATH" >&2
    # Give each project a moment
    sleep 5
  done
  echo "$LOG Fleet propagation complete."
fi

echo "$LOG Fleet improvement pass complete."
