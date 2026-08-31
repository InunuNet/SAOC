#!/usr/bin/env bash
# sync_skills.sh — Copy canonical skills to platform-specific dirs
# Reads .agent/skills/*.md → copies to .claude/skills/ + .gemini/skills/

set -euo pipefail

CANONICAL_DIR=".agent/skills"
CLAUDE_DIR=".claude/skills"
GEMINI_DIR=".gemini/skills"
GROK_DIR=".grok/skills"

# Self-heal: if a platform skill dir is a symlink pointing at the same real
# directory as the canonical dir (old init.sh convention), replace it with a
# real directory BEFORE any delete step. Deleting through such a symlink
# would destroy the canonical files instead of the platform copy.
mkdir -p "$CANONICAL_DIR"
CANONICAL_REAL=$(cd "$CANONICAL_DIR" && pwd -P)
for dir in "$CLAUDE_DIR" "$GEMINI_DIR" "$GROK_DIR"; do
  if [ -L "$dir" ]; then
    DIR_REAL=$(cd "$dir" && pwd -P 2>/dev/null || echo "")
    if [ "$DIR_REAL" = "$CANONICAL_REAL" ]; then
      echo "WARN: $dir is a symlink to the canonical skills dir — self-healing to a real directory"
      rm -f "$dir"
      mkdir -p "$dir"
    fi
  fi
done

mkdir -p "$CLAUDE_DIR" "$GEMINI_DIR" "$GROK_DIR"

# Delete existing skills (except .keep) to ensure a clean sync. Use a
# non-dereferencing glob delete (not `find "$DIR/" ... -delete`, which
# dereferences a symlinked directory argument and walks into its target).
rm -f "$CLAUDE_DIR"/*.md
rm -f "$GEMINI_DIR"/*.md
rm -f "$GROK_DIR"/*.md

synced=0
for skill in "$CANONICAL_DIR"/*.md; do
  [ ! -f "$skill" ] && continue
  filename=$(basename "$skill")

  # Skip .keep files
  [[ "$filename" == .keep* ]] && continue

  # Copy the file. This is safer than hard linking in this context.
  cp "$skill" "$CLAUDE_DIR/$filename"
  cp "$skill" "$GEMINI_DIR/$filename"
  cp "$skill" "$GROK_DIR/$filename"

  synced=$((synced + 1))
done

echo "✅ Synced $synced skills → $CLAUDE_DIR/ + $GEMINI_DIR/ + $GROK_DIR/"
