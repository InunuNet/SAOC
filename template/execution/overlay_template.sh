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

# Reads $TARGET/.agent/no-update, returns --exclude= flags for patterns under the
# given subtree prefix (e.g. ".agent/skills/") so rsync --delete overlays never
# clobber or delete project-authored files opted out via .agent/no-update.
no_update_excludes() {
  local prefix="$1" no_update_file="$TARGET/.agent/no-update"
  [ -f "$no_update_file" ] || return 0
  while IFS= read -r pattern; do
    pattern="${pattern%%#*}"
    pattern="$(echo "$pattern" | xargs)"
    [ -z "$pattern" ] && continue
    case "$pattern" in
      "$prefix"*) echo "--exclude=${pattern#$prefix}" ;;
    esac
  done < "$no_update_file"
}

# Populates the global EXC array with exclude flags for the given subtree
# prefix. A plain while-read loop rather than `mapfile` — the macOS system
# bash is 3.2, which lacks mapfile/readarray (bash 4+ only), and this script
# must run under whatever `bash` resolves to in PATH.
build_excludes() {
  EXC=()
  local flag
  while IFS= read -r flag; do
    EXC+=("$flag")
  done < <(no_update_excludes "$1")
}

# scaffold-identity-integrity F3 (D-F3-1): the overlay's source for each path
# must equal init.sh's source for that path. PROJECT-SEED files (Makefile,
# .agent/paired-copies.yaml) come from template/ — the harness's own working
# copies are harness-scoped and must never reach a downstream workspace. LIVE
# HARNESS CODE (everything under execution/, the hooks, the rsync'd asset dirs,
# provider settings, .agent/version) keeps coming from the repo root, exactly as
# init.sh takes it. Downstream copies of this script resolve TEMPLATE to a
# project root with no template/ dir, so the resolver degrades to the root path
# rather than erroring there.
seed_source() { # $1 = harness-relative path; echoes the path to read it from
  if [ -f "$TEMPLATE/template/$1" ]; then
    echo "$TEMPLATE/template/$1"
  else
    echo "$TEMPLATE/$1"
  fi
}

# Step 1: Backup .agent (full snapshot)
rm -rf "$TARGET/.agent.bak"
cp -r "$TARGET/.agent" "$TARGET/.agent.bak"
echo "  ✅ Backup: .agent.bak"

# Step 2: Overlay infrastructure dirs — rsync --delete mirrors source exactly,
#          removing any orphan files from previous template versions.
#          Guarded by -d to avoid failure if template dirs are missing (Issue #50).
mkdir -p "$TARGET/.agent/workflows" "$TARGET/.agent/agents" "$TARGET/.agent/rules" "$TARGET/.agent/skills" "$TARGET/.agent/reference" "$TARGET/execution/hooks" "$TARGET/.claude/skills" "$TARGET/.gemini/skills" "$TARGET/.gemini/policies"
if [ -d "$TEMPLATE/.agent/workflows/" ]; then
  build_excludes ".agent/workflows/"
  rsync -a --delete "${EXC[@]}" "$TEMPLATE/.agent/workflows/" "$TARGET/.agent/workflows/"
fi
if [ -d "$TEMPLATE/.agent/skills/" ]; then
  build_excludes ".agent/skills/"
  rsync -a --delete "${EXC[@]}" "$TEMPLATE/.agent/skills/" "$TARGET/.agent/skills/"
fi
if [ -d "$TEMPLATE/.claude/skills/" ]; then
  build_excludes ".claude/skills/"
  rsync -a --delete "${EXC[@]}" "$TEMPLATE/.claude/skills/" "$TARGET/.claude/skills/" 2>/dev/null || true
fi
if [ -d "$TEMPLATE/.gemini/skills/" ]; then
  build_excludes ".gemini/skills/"
  rsync -a --delete "${EXC[@]}" "$TEMPLATE/.gemini/skills/" "$TARGET/.gemini/skills/" 2>/dev/null || true
fi
if [ -d "$TEMPLATE/.agent/agents/" ]; then
  build_excludes ".agent/agents/"
  rsync -a --delete "${EXC[@]}" "$TEMPLATE/.agent/agents/" "$TARGET/.agent/agents/"
fi
if [ -d "$TEMPLATE/.agent/rules/" ]; then
  build_excludes ".agent/rules/"
  rsync -a --delete "${EXC[@]}" "$TEMPLATE/.agent/rules/" "$TARGET/.agent/rules/"
fi
if [ -d "$TEMPLATE/.agent/reference/" ]; then
  build_excludes ".agent/reference/"
  rsync -a --delete "${EXC[@]}" "$TEMPLATE/.agent/reference/" "$TARGET/.agent/reference/" 2>/dev/null || true
fi
if [ -d "$TEMPLATE/execution/hooks/" ]; then
  build_excludes "execution/hooks/"
  rsync -a --delete "${EXC[@]}" "$TEMPLATE/execution/hooks/" "$TARGET/execution/hooks/" 2>/dev/null || true
fi

# Single files
cp "$TEMPLATE/.agent/version"      "$TARGET/.agent/version"
cp "$TEMPLATE/.agent/CHANGELOG.md" "$TARGET/.agent/CHANGELOG.md" 2>/dev/null || true
cp "$(seed_source Makefile)"       "$TARGET/Makefile"            2>/dev/null || true

# Execution scripts
cp "$TEMPLATE/execution/brain.py"         "$TARGET/execution/brain.py"         2>/dev/null || true
cp "$TEMPLATE/execution/sync_agents.sh"   "$TARGET/execution/sync_agents.sh"   2>/dev/null || true
cp "$TEMPLATE/execution/sync_skills.sh"   "$TARGET/execution/sync_skills.sh"   2>/dev/null || true
cp "$TEMPLATE/execution/sync_rules.sh"    "$TARGET/execution/sync_rules.sh"    2>/dev/null || true
cp "$TEMPLATE/execution/overlay_template.sh" "$TARGET/execution/overlay_template.sh" 2>/dev/null || true
cp "$TEMPLATE/execution/merge_profile.py" "$TARGET/execution/merge_profile.py" 2>/dev/null || true
cp "$TEMPLATE/execution/browser_qa.py" "$TARGET/execution/browser_qa.py" 2>/dev/null || true

# platform-scoped-delivery F2: the boot siren, the clone generator, and the
# stub check. These exist FOR downstream workspaces -- `make audit` and
# `make sync` both invoke paired_copies.py, and full_boot.sh guards the siren
# with `[ -f ]`, so an overlay that does not carry them breaks audit/sync and
# turns the siren into a permanent silent no-op exactly where it is needed.
# NOT `2>/dev/null || true`: a swallowed failure here is invisible, which is
# the class of defect these three files exist to make loud.
mkdir -p "$TARGET/execution/checks"
for f in execution/paired_copies.py execution/boot_integrity.py execution/checks/verify_no_symlink_stubs.py; do
  if ! cp "$TEMPLATE/$f" "$TARGET/$f"; then
    echo "  ❌ overlay could not deliver $f -- make audit and make sync will fail in $TARGET" >&2
    exit 1
  fi
done
# The siren's registry. paired_copies.py without .agent/paired-copies.yaml is
# a tool with no pairs to enforce.
if ! cp "$(seed_source .agent/paired-copies.yaml)" "$TARGET/.agent/paired-copies.yaml"; then
  echo "  ❌ overlay could not deliver .agent/paired-copies.yaml" >&2
  exit 1
fi

# Claude Code adapter — hooks, permissions, env
cp "$TEMPLATE/.claude/settings.json" "$TARGET/.claude/settings.json" 2>/dev/null || true

# Gemini CLI adapter
cp "$TEMPLATE/.gemini/settings.json" "$TARGET/.gemini/settings.json" 2>/dev/null || true
mkdir -p "$TARGET/.gemini/policies"
cp "$TEMPLATE/.gemini/policies/autonomy.toml" "$TARGET/.gemini/policies/autonomy.toml" 2>/dev/null || true

# AGENTS.md — WORKSPACE-IDENTITY (scaffold-identity-integrity F3, D-F3-1/D-F3-2).
# A workspace's AGENTS.md is project-owned: init.sh seeds it from template/ and
# then FILLS it, and /onboard rewrites it again. The overlay must NOT rewrite it
# at all. The previous copy-then-sed-the-`**You are` line-back scheme preserved
# exactly ONE line while replacing the whole document, so a downstream project
# lost its "This project is NOT <harness>" line, its onboarding gate, and gained
# the harness's own branding on every fleet push. Per-line restoration is
# rejected outright rather than repaired: only a document left untouched is
# correct. Seeding from template/ when the target has NONE is still allowed —
# a workspace with no AGENTS.md was never scaffolded, and the overlay is the
# only thing that can give it a starting point.
if [ -f "$TARGET/AGENTS.md" ]; then
  echo "  ↩️  AGENTS.md left untouched (workspace-owned identity document)"
else
  cp "$(seed_source AGENTS.md)" "$TARGET/AGENTS.md" 2>/dev/null || true
fi
# CLONES of AGENTS.md, as real files — never symlinks. A symlink minted here
# becomes a text stub on every default Windows clone of the updated workspace
# (platform-scoped-delivery F2).
cp "$TARGET/AGENTS.md" "$TARGET/CLAUDE.md" 2>/dev/null || true
cp "$TARGET/AGENTS.md" "$TARGET/GEMINI.md" 2>/dev/null || true
echo "  ✅ Infrastructure files overlaid"

# Step 3: Restore brain (overlay may have reset it)
if [ -d "$TARGET/.agent.bak/memory/brain" ]; then
  rm -rf "$TARGET/.agent/memory/brain"
  cp -r "$TARGET/.agent.bak/memory/brain" "$TARGET/.agent/memory/brain"
  echo "  ✅ Brain preserved"
fi

echo "  ✅ Overlay complete: $proj (v$VERSION)"
