#!/usr/bin/env bash
# sync_rules.sh — Propagate rules from canonical .agent/rules/ to platform configs.
# Canonical structure:
#   .agent/rules/_core/   → all providers
#   .agent/rules/claude/  → Claude Code only
#   .agent/rules/gemini/  → Gemini CLI only

set -euo pipefail

CORE_RULES_DIR=".agent/rules/_core"
CLAUDE_RULES_DIR=".agent/rules/claude"
GEMINI_RULES_DIR=".agent/rules/gemini"
CLAUDE_DEST_DIR=".claude/rules"
GEMINI_DEST_DIR=".gemini/rules"

# Safety: refuse to run if no canonical source exists.
# Without this guard, the find -delete below would wipe destinations with nothing to restore.
if [ ! -d "$CORE_RULES_DIR" ] && [ ! -d "$CLAUDE_RULES_DIR" ]; then
    echo "❌ sync_rules: canonical source missing (.agent/rules/_core/ not found)"
    echo "   Run: make migrate-rules  (one-time migration)"
    exit 1
fi

mkdir -p "$CLAUDE_DEST_DIR" "$GEMINI_DEST_DIR"

# Sync core rules → all platforms
if [ -d "$CORE_RULES_DIR" ] && ls "$CORE_RULES_DIR"/*.md >/dev/null 2>&1; then
    rsync -a --delete --include="*.md" --exclude="*" "$CORE_RULES_DIR/" "$CLAUDE_DEST_DIR/"
    rsync -a           --include="*.md" --exclude="*" "$CORE_RULES_DIR/" "$GEMINI_DEST_DIR/"
fi

# Sync Claude-specific rules (added on top of core)
if [ -d "$CLAUDE_RULES_DIR" ] && ls "$CLAUDE_RULES_DIR"/*.md >/dev/null 2>&1; then
    rsync -a --include="*.md" --exclude="*" "$CLAUDE_RULES_DIR/" "$CLAUDE_DEST_DIR/"
fi

# Sync Gemini-specific rules
if [ -d "$GEMINI_RULES_DIR" ] && ls "$GEMINI_RULES_DIR"/*.md >/dev/null 2>&1; then
    rsync -a --include="*.md" --exclude="*" "$GEMINI_RULES_DIR/" "$GEMINI_DEST_DIR/"
fi

echo "✅ Rule sync complete."
