#!/usr/bin/env bash
# sync_agents.sh — Generate platform-specific agent configs from canonical definitions
# Reads .agent/agents/*.md → generates .claude/agents/*.md + .gemini/agents/*.md

set -euo pipefail

CANONICAL_DIR=".agent/agents"
CLAUDE_DIR=".claude/agents"
GEMINI_DIR=".gemini/agents"

# Mapping functions (avoids associative array issues across shells)
map_claude_model() {
  case "$1" in
    pro) echo "opus" ;;
    flash) echo "sonnet" ;;
    local) echo "haiku" ;;
    *) echo "sonnet" ;;
  esac
}

map_gemini_model() {
  case "$1" in
    pro) echo "gemini-2.5-pro" ;;
    flash) echo "gemini-2.5-flash" ;;
    local) echo "gemini-2.5-flash-lite" ;;
    *) echo "gemini-2.5-flash" ;;
  esac
}

map_claude_tool() {
  case "$1" in
    read) echo "Read" ;;
    write) echo "Write" ;;
    edit) echo "Edit" ;;
    shell) echo "Bash" ;;
    grep) echo "Grep" ;;
    search) echo "WebSearch" ;;
    web) echo "WebFetch" ;;
    *) echo "$1" ;;
  esac
}

map_gemini_tool() {
  case "$1" in
    read) echo "read_file" ;;
    write) echo "write_file" ;;
    edit) echo "replace" ;;
    shell) echo "run_shell_command" ;;
    grep) echo "grep_search" ;;
    search) echo "google_web_search" ;;
    web) echo "web_fetch" ;;
    *) echo "$1" ;;
  esac
}

map_tools() {
  local platform="$1"
  local tools_csv="${2:-}"
  local result=""

  # Remove brackets and split by comma
  clean_csv=$(echo "$tools_csv" | tr -d '[]' | tr ',' '\n')

  while IFS= read -r tool_item; do
    tool_item=$(echo "$tool_item" | xargs)
    [ -z "$tool_item" ] && continue
    if [ "$platform" = "claude" ]; then
      mapped=$(map_claude_tool "$tool_item")
    else
      mapped=$(map_gemini_tool "$tool_item")
    fi
    if [ -n "$result" ]; then
      result="$result, \"$mapped\""
    else
      result="\"$mapped\""
    fi
  done <<< "$clean_csv"
  echo "$result"
}

mkdir -p "$CLAUDE_DIR" "$GEMINI_DIR"

synced=0
for canonical in "$CANONICAL_DIR"/*.md; do
  [ ! -f "$canonical" ] && continue
  filename=$(basename "$canonical")
  
  # Parse YAML frontmatter
  model_tier=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^model_tier:' | awk '{print $2}')
  description=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^description:' | sed 's/^description: //')
  tools_line=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^tools:' | sed 's/^tools: \[//;s/\]//' || true)
  tools_denied_line=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^tools_denied:' | sed 's/^tools_denied: \[//;s/\]//' || true)

  # Map models
  claude_model=$(map_claude_model "$model_tier")
  gemini_model=$(map_gemini_model "$model_tier")

  # Map tools
  claude_tools=$(map_tools "claude" "$tools_line")
  claude_denied=$(map_tools "claude" "$tools_denied_line")
  gemini_tools=$(map_tools "gemini" "$tools_line")

  # Get body (everything after second ---)
  body=$(awk 'BEGIN{n=0} /^---$/{n++; if(n==2) next} n>=2{print}' "$canonical")

  # Generate Claude agent
  {
    echo "---"
    echo "name: ${filename%.md}"
    echo "model: $claude_model"
    echo "description: $description"
    [ -n "$claude_tools" ] && echo "allowedTools: [$claude_tools]"
    [ -n "$claude_denied" ] && echo "disallowedTools: [$claude_denied]"
    echo "---"
    echo "$body"
  } > "$CLAUDE_DIR/$filename"

  # Generate Gemini agent
  {
    echo "---"
    echo "name: ${filename%.md}"
    echo "model: $gemini_model"
    echo "description: $description"
    [ -n "$gemini_tools" ] && echo "tools: [$gemini_tools]"
    echo "---"
    echo "$body"
  } > "$GEMINI_DIR/$filename"

  synced=$((synced + 1))
done

echo "✅ Synced $synced agents → $CLAUDE_DIR/ + $GEMINI_DIR/"
