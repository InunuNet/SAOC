#!/usr/bin/env bash
# Athanor — overlay_all.sh
# Overlays the latest Athanor template onto all downstream projects,
# then runs sync_agents to wire the agent team into each project.
#
# Usage: bash execution/overlay_all.sh [--dry-run]
set -e

TEMPLATE="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/.." && pwd)"
PROJECTS_ROOT="${ATHANOR_PROJECTS_ROOT:-$HOME/ai}"
DRY_RUN=false
[[ "$1" == "--dry-run" ]] && DRY_RUN=true

# ── Ignore list ──────────────────────────────────────────────────────────────
# Projects excluded from batch overlay (originals, archives, non-DF systems)
IGNORE=(
  "Athanor"           # the template itself
  "Workspace Template" # original pre-Athanor workspace (legacy)
  "Search Token Less"  # already at current version
  "PAI"                # PAI system — separate versioning
)

# ── Helpers ──────────────────────────────────────────────────────────────────
VERSION=$(cat "$TEMPLATE/.agent/version" 2>/dev/null || echo "?")
PASS=0; FAIL=0; SKIP=0

is_ignored() {
  local name="$1"
  for ig in "${IGNORE[@]}"; do [[ "$name" == "$ig" ]] && return 0; done
  return 1
}

# ── Main loop ────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════"
echo "  Athanor v$VERSION — Batch Overlay"
echo "  Root: $PROJECTS_ROOT"
$DRY_RUN && echo "  MODE: DRY RUN"
echo "═══════════════════════════════════════════════════"
echo ""

# Discover all DF projects (have .agent/version) sorted: closest-to-current first
PROJECTS=$(
  find "$PROJECTS_ROOT" -maxdepth 3 -name "version" -path "*/.agent/version" \
    ! -path "*/worktrees/*" ! -path "*/.git/*" \
    -exec dirname {} \; | sed 's|/.agent$||' | \
  while IFS= read -r p; do
    ver=$(cat "$p/.agent/version" 2>/dev/null || echo "0.0.0")
    echo "$ver|$p"
  done | sort -t'|' -k1 -r | cut -d'|' -f2
)

while IFS= read -r project_path; do
  [[ -z "$project_path" ]] && continue
  name=$(basename "$project_path")

  if is_ignored "$name"; then
    echo "  ⏭  SKIP  $name (ignored)"
    ((SKIP++))
    continue
  fi

  current_ver=$(cat "$project_path/.agent/version" 2>/dev/null || echo "?")
  if [[ "$current_ver" == "$VERSION" ]]; then
    echo "  ✅ UP-TO-DATE  $name ($current_ver)"
    ((SKIP++))
    continue
  fi

  echo "  🔄 $name  $current_ver → v$VERSION"
  if $DRY_RUN; then
    ((PASS++))
    continue
  fi

  if bash "$TEMPLATE/execution/overlay_template.sh" "$project_path" > /tmp/df_overlay_log 2>&1; then
    # Post-install: wire agents into platform dirs
    if [ -f "$project_path/execution/sync_agents.sh" ]; then
      bash "$project_path/execution/sync_agents.sh" > /tmp/df_sync_log 2>&1 || true
    fi
    new_ver=$(cat "$project_path/.agent/version" 2>/dev/null || echo "?")
    echo "       ✅ Done → v$new_ver"
    ((PASS++))
  else
    echo "       ❌ FAILED — see /tmp/df_overlay_log"
    cat /tmp/df_overlay_log | sed 's/^/       /'
    ((FAIL++))
  fi
done <<< "$PROJECTS"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Updated: $PASS  |  Skipped: $SKIP  |  Failed: $FAIL"
echo "═══════════════════════════════════════════════════"
[[ $FAIL -gt 0 ]] && exit 1 || exit 0
