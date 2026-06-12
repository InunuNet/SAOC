#!/usr/bin/env bash
# sync_skills.sh — Copy canonical skills to platform-specific dirs
# Reads .agent/skills/*.md → copies to .claude/skills/ + .gemini/skills/

set -euo pipefail

CANONICAL_DIR=".agent/skills"
CLAUDE_DIR=".claude/skills"
GEMINI_DIR=".gemini/skills"

mkdir -p "$CLAUDE_DIR" "$GEMINI_DIR"

# Delete existing skills to ensure a clean sync (avoids orphan/hidden files being parsed as tools)
find "$CLAUDE_DIR/" -type f -delete
find "$GEMINI_DIR/" -type f -delete

synced=0
for skill in "$CANONICAL_DIR"/*.md; do
  [ ! -f "$skill" ] && continue
  filename=$(basename "$skill")

  # Skip .keep files
  [[ "$filename" == .keep* ]] && continue

  # Copy the file. This is safer than hard linking in this context.
  cp "$skill" "$CLAUDE_DIR/$filename"
  cp "$skill" "$GEMINI_DIR/$filename"

  synced=$((synced + 1))
done

echo "✅ Synced $synced skills → $CLAUDE_DIR/ + $GEMINI_DIR/"
