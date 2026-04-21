#!/usr/bin/env bash
# Athanor Overlay — overlay_template.sh
# Copies new Athanor infrastructure files into a target project.
# NEVER touches: source code, brain data, project memory content, .git
set -e

TEMPLATE="${ATHANOR_TEMPLATE:-$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/.." && pwd)}"
TARGET="$1"
[[ -z "$TARGET" ]] && echo "Usage: overlay_template.sh /path/to/project" && exit 1

VERSION=$(cat "$TEMPLATE/.agent/version" 2>/dev/null || echo "unknown")
proj=$(basename "$TARGET")
echo "🔄 Overlaying Athanor v$VERSION into: $proj"

# Step 1: Backup .agent (full snapshot)
rm -rf "$TARGET/.agent.bak"
cp -r "$TARGET/.agent" "$TARGET/.agent.bak"
echo "  ✅ Backup: .agent.bak"

# Step 2: Overlay infrastructure dirs — rsync --delete mirrors source exactly,
#          removing any orphan files from previous template versions.
#          Guarded by -d to avoid failure if template dirs are missing (Issue #50).
mkdir -p "$TARGET/.agent/workflows" "$TARGET/.agent/agents" "$TARGET/.agent/rules" "$TARGET/.agent/skills" "$TARGET/.agent/reference" "$TARGET/execution/hooks" "$TARGET/.claude/skills" "$TARGET/.gemini/skills" "$TARGET/.gemini/policies"
if [ -d "$TEMPLATE/.agent/workflows/" ]; then rsync -a --delete "$TEMPLATE/.agent/workflows/" "$TARGET/.agent/workflows/"; fi
if [ -d "$TEMPLATE/.agent/skills/" ];    then rsync -a --delete "$TEMPLATE/.agent/skills/"    "$TARGET/.agent/skills/"; fi
if [ -d "$TEMPLATE/.claude/skills/" ];   then rsync -a --delete "$TEMPLATE/.claude/skills/"   "$TARGET/.claude/skills/"  2>/dev/null || true; fi
if [ -d "$TEMPLATE/.gemini/skills/" ];   then rsync -a --delete "$TEMPLATE/.gemini/skills/"   "$TARGET/.gemini/skills/"  2>/dev/null || true; fi
if [ -d "$TEMPLATE/.agent/agents/" ];    then rsync -a --delete "$TEMPLATE/.agent/agents/"    "$TARGET/.agent/agents/"; fi
if [ -d "$TEMPLATE/.agent/rules/" ];     then rsync -a --delete "$TEMPLATE/.agent/rules/"     "$TARGET/.agent/rules/"; fi
if [ -d "$TEMPLATE/.agent/reference/" ]; then rsync -a --delete "$TEMPLATE/.agent/reference/" "$TARGET/.agent/reference/" 2>/dev/null || true; fi
if [ -d "$TEMPLATE/execution/hooks/" ];  then rsync -a --delete "$TEMPLATE/execution/hooks/"  "$TARGET/execution/hooks/" 2>/dev/null || true; fi

# Single files
cp "$TEMPLATE/.agent/version"      "$TARGET/.agent/version"
cp "$TEMPLATE/.agent/CHANGELOG.md" "$TARGET/.agent/CHANGELOG.md" 2>/dev/null || true
cp "$TEMPLATE/Makefile"            "$TARGET/Makefile"            2>/dev/null || true

# Execution scripts
cp "$TEMPLATE/execution/brain.py"         "$TARGET/execution/brain.py"         2>/dev/null || true
cp "$TEMPLATE/execution/sync_agents.sh"   "$TARGET/execution/sync_agents.sh"   2>/dev/null || true
cp "$TEMPLATE/execution/sync_skills.sh"   "$TARGET/execution/sync_skills.sh"   2>/dev/null || true
cp "$TEMPLATE/execution/sync_rules.sh"    "$TARGET/execution/sync_rules.sh"    2>/dev/null || true
cp "$TEMPLATE/execution/overlay_template.sh" "$TARGET/execution/overlay_template.sh" 2>/dev/null || true
cp "$TEMPLATE/execution/merge_profile.py" "$TARGET/execution/merge_profile.py" 2>/dev/null || true

# Claude Code adapter — hooks, permissions, env
cp "$TEMPLATE/.claude/settings.json" "$TARGET/.claude/settings.json" 2>/dev/null || true

# Gemini CLI adapter
cp "$TEMPLATE/.gemini/settings.json" "$TARGET/.gemini/settings.json" 2>/dev/null || true
mkdir -p "$TARGET/.gemini/policies"
cp "$TEMPLATE/.gemini/policies/autonomy.toml" "$TARGET/.gemini/policies/autonomy.toml" 2>/dev/null || true

# AGENTS.md + symlinks (Preserve identity if it exists — Issue #53)
if [ -f "$TARGET/AGENTS.md" ]; then
  ID_LINE=$(grep "^\*\*You are " "$TARGET/AGENTS.md" | head -n 1)
  cp "$TEMPLATE/AGENTS.md" "$TARGET/AGENTS.md"
  if [ -n "$ID_LINE" ]; then
    # Cross-platform sed for identity restoration
    sed -i "s|^\*\*You are .*$|$ID_LINE|" "$TARGET/AGENTS.md" 2>/dev/null || \
    sed -i "" "s|^\*\*You are .*$|$ID_LINE|" "$TARGET/AGENTS.md" 2>/dev/null || true
  fi
else
  cp "$TEMPLATE/AGENTS.md" "$TARGET/AGENTS.md"
fi
ln -sf AGENTS.md "$TARGET/CLAUDE.md"  2>/dev/null || true
ln -sf AGENTS.md "$TARGET/GEMINI.md"  2>/dev/null || true
echo "  ✅ Infrastructure files overlaid"

# Step 3: Restore brain (overlay may have reset it)
if [ -d "$TARGET/.agent.bak/memory/brain" ]; then
  rm -rf "$TARGET/.agent/memory/brain"
  cp -r "$TARGET/.agent.bak/memory/brain" "$TARGET/.agent/memory/brain"
  echo "  ✅ Brain preserved"
fi

echo "  ✅ Overlay complete: $proj (v$VERSION)"
