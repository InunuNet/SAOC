#!/usr/bin/env bash
# Athanor Pulse job: watch downstream comms.md files for UPSTREAM ISSUEs
# and auto-fix them via claude -p. Runs every 60s.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LOCK_DIR="$PROJECT_ROOT/.agent/pulse/registry/processing"
mkdir -p "$LOCK_DIR"

# HEARTBEAT: auto-resume after compact when autonomy=loop
RESUME_FLAG="$PROJECT_ROOT/.agent/pulse/registry/needs_resume.flag"
if [ -f "$RESUME_FLAG" ]; then
  _LEVEL=$(python3 -c "import json; p=json.load(open('$PROJECT_ROOT/.agent/profile.json')); print(p.get('autonomy',{}).get('level','off'))" 2>/dev/null || echo 'off')
  rm -f "$RESUME_FLAG"
  if [ "$_LEVEL" = "loop" ]; then
    echo "[heartbeat] Post-compact auto-resume (autonomy=loop)"
    cd "$PROJECT_ROOT"
    if ! claude --continue -p "k" 2>&1; then
      claude -p "AUTONOMOUS MODE: pick next backlog item and start immediately." 2>&1
    fi
    echo "[heartbeat] Resume complete"
  fi
fi

# FLEET HEARTBEAT: resume downstream project sessions after compact
# Each project writes .agent/pulse/registry/needs_resume.flag on compact (via post_compact_restore.sh)
FLEET_PROJECTS=(
  "/Users/vetus/ai/SAOC"
  "/Users/vetus/ai/Mumbl AI"
  "/Users/vetus/ai/Mlilo Savant"
  "/Users/vetus/ai/Codex Harness"
)
_ATH_LEVEL=$(python3 -c "import json; p=json.load(open('$PROJECT_ROOT/.agent/profile.json')); print(p.get('autonomy',{}).get('level','off'))" 2>/dev/null || echo 'off')
if [ "$_ATH_LEVEL" = "loop" ]; then
  for _PROJ in "${FLEET_PROJECTS[@]}"; do
    _FLEET_FLAG="$_PROJ/.agent/pulse/registry/needs_resume.flag"
    if [ -f "$_FLEET_FLAG" ]; then
      rm -f "$_FLEET_FLAG"
      echo "[fleet-heartbeat] Resuming ${_PROJ##*/} after compact"
      (cd "$_PROJ" && if ! claude --continue -p "k" 2>&1 | tail -3; then
        claude -p "AUTONOMOUS MODE: pick next backlog item and start immediately." 2>&1 | tail -3
      fi) &
      wait $!
    fi
  done
fi

COMMS_FILES=(
  "/Users/vetus/ai/Codex Harness/comms.md"
  "/Users/vetus/ai/Gemini Harness/comms.md"
  "/Users/vetus/ai/Anti Harness/comms.md"
  "/Users/vetus/ai/Alembic/comms.md"
  "/Users/vetus/ai/SAOC/.agent/memory/project/comms.md"
  "/Users/vetus/ai/Mlilo Savant/.agent/memory/project/comms.md"
)

is_sentinel_title() {
  local title="$1"
  # Empty / whitespace-only
  [ -z "$title" ] && return 0
  # Case-insensitive "none" or "none — ..." (template placeholder with trailing text)
  local lc
  lc=$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]')
  [ "$lc" = "none" ] && return 0
  case "$lc" in "none — "*) return 0 ;; esac
  # Placeholder brackets / angle brackets at start
  case "$title" in
    \[*) return 0 ;;
    \<*) return 0 ;;
    "clear "*) return 0 ;;
  esac
  return 1
}

for COMMS in "${COMMS_FILES[@]}"; do
  [ -f "$COMMS" ] || continue

  # Extract UPSTREAM ISSUEs not yet processed
  while IFS= read -r line; do
    ISSUE_SIG=$(echo "$line" | md5 2>/dev/null || echo "$line" | md5sum | cut -d' ' -f1)
    LOCK="$LOCK_DIR/comms-issue-$ISSUE_SIG.lock"
    [ -f "$LOCK" ] && continue

    # Extract title and body hint from the line
    TITLE=$(echo "$line" | sed 's/UPSTREAM ISSUE: //' | cut -d'|' -f1 | xargs)
    BODY=$(echo "$line" | cut -d'|' -f2- | xargs)

    # Skip template/placeholder sentinels — never dispatch boilerplate to claude -p
    if is_sentinel_title "$TITLE"; then
      continue
    fi

    FRICTION_ID=$(printf '%s|%s' "$TITLE" "$BODY" | tr '[:upper:]' '[:lower:]' | tr -s ' ' | md5 2>/dev/null \
      || printf '%s|%s' "$TITLE" "$BODY" | tr '[:upper:]' '[:lower:]' | tr -s ' ' | md5sum | cut -d' ' -f1)
    [ -f "$PROJECT_ROOT/.agent/pulse/registry/completed/friction/$FRICTION_ID.done" ] && continue

    touch "$LOCK"
    echo "[watch-comms] New upstream issue found: $TITLE"

    # Try --continue first (resume existing session); fall back to fresh -p if none exists
    cd "$PROJECT_ROOT"
    if ! claude --continue -p "You are Codi on the Athanor harness. A downstream agent reported this upstream issue:

TITLE: $TITLE
DETAIL: $BODY

Investigate whether this is a real bug in Athanor. If yes, fix it using the full harness chain (contract -> @dev -> gate -> push). If already fixed, close it. Be surgical — one precise fix only." 2>&1 | tail -5; then
      claude -p "You are Codi on the Athanor harness. A downstream agent reported this upstream issue:

TITLE: $TITLE
DETAIL: $BODY

Investigate whether this is a real bug in Athanor. If yes, fix it using the full harness chain (contract -> @dev -> gate -> push). If already fixed, close it. Be surgical — one precise fix only." 2>&1 | tail -5
    fi

    echo "[watch-comms] Fix attempt complete for: $TITLE"
    mkdir -p "$PROJECT_ROOT/.agent/pulse/registry/completed/friction" \
      && touch "$PROJECT_ROOT/.agent/pulse/registry/completed/friction/$FRICTION_ID.done"
  done < <(grep "^UPSTREAM ISSUE:" "$COMMS" 2>/dev/null)
done

echo "[watch-comms] Scan complete."
