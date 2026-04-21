#!/usr/bin/env bash
# sync_skills.sh — Copy canonical skills to platform-specific dirs
# Reads .agent/skills/*.md → copies to .claude/skills/ + .gemini/skills/

set -euo pipefail

CANONICAL_DIR=".agent/skills"
CLAUDE_DIR=".claude/skills"
GEMINI_DIR=".gemini/skills"

mkdir -p "$CLAUDE_DIR" "$GEMINI_DIR"

synced=0
for skill in "$CANONICAL_DIR"/*.md; do
  [ ! -f "$skill" ] && continue
  filename=$(basename "$skill")

  # Skip .keep files
  [[ "$filename" == .keep* ]] && continue

  # Skip if target is a symlink to source (Issue #23)
  if [ -L "$CLAUDE_DIR" ] && [ "$(readlink -f "$CLAUDE_DIR")" = "$(readlink -f "$CANONICAL_DIR")" ]; then
    : # Skip Claude sync if symlinked
  else
    rsync -aL "$skill" "$CLAUDE_DIR/$filename"
  fi

  if [ -L "$GEMINI_DIR" ] && [ "$(readlink -f "$GEMINI_DIR")" = "$(readlink -f "$CANONICAL_DIR")" ]; then
    : # Skip Gemini sync if symlinked
  else
    rsync -aL "$skill" "$GEMINI_DIR/$filename"
  fi

  synced=$((synced + 1))
done

echo "✅ Synced $synced skills → $CLAUDE_DIR/ + $GEMINI_DIR/"
