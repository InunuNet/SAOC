#!/usr/bin/env bash
# sync_agents.sh — Generate platform-specific agent configs from canonical definitions
# Reads .agent/agents/*.md → generates .claude/agents/*.md + .gemini/agents/*.md
#
# NON-DESTRUCTIVE: creates missing provider agent files from .agent/agents/ canonical reference.
# Never overwrites existing .claude/agents/*.md or .gemini/agents/*.md — those are authoritative.

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

created=0
skipped=0
for canonical in "$CANONICAL_DIR"/*.md; do
  [ ! -f "$canonical" ] && continue
  filename=$(basename "$canonical")

  # Parse YAML frontmatter
  model_tier=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^model_tier:' | awk '{print $2}' || true)
  description=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^description:' | sed 's/^description: //')
  tools_line=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^tools:' | sed 's/^tools: \[//;s/\]//' || true)
  tools_denied_line=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^tools_denied:' | sed 's/^tools_denied: \[//;s/\]//' || true)

  # Map models
  claude_model=$(map_claude_model "$model_tier")
  gemini_model=$(map_gemini_model "$model_tier")

  # Map tools
  claude_denied=$(map_tools "claude" "$tools_denied_line")
  gemini_tools=$(map_tools "gemini" "$tools_line")

  # Get body (everything after second ---)
  body=$(awk 'BEGIN{n=0} /^---$/{n++; if(n==2) next} n>=2{print}' "$canonical")

  # --- Claude agent (non-destructive) ---
  CLAUDE_TARGET="$CLAUDE_DIR/$filename"
  if [ -f "$CLAUDE_TARGET" ]; then
    echo "SKIP (exists): $CLAUDE_TARGET"
    skipped=$((skipped + 1))
  else
    {
      echo "---"
      echo "name: ${filename%.md}"
      echo "model: $claude_model"
      echo "description: $description"
      [ -n "$claude_denied" ] && echo "disallowedTools: [$claude_denied]"
      echo "---"
      echo "$body"
    } > "$CLAUDE_TARGET"
    echo "create: $CLAUDE_TARGET"
    created=$((created + 1))
  fi

  # --- Gemini agent (non-destructive) ---
  GEMINI_TARGET="$GEMINI_DIR/$filename"
  if [ -f "$GEMINI_TARGET" ]; then
    echo "SKIP (exists): $GEMINI_TARGET"
    skipped=$((skipped + 1))
  else
    {
      echo "---"
      echo "name: ${filename%.md}"
      echo "model: $gemini_model"
      echo "description: $description"
      [ -n "$gemini_tools" ] && echo "tools: [$gemini_tools]"
      echo "---"
      echo "$body"
    } > "$GEMINI_TARGET"
    echo "create: $GEMINI_TARGET"
    created=$((created + 1))
  fi

done

echo "✅ sync_agents: created=$created skipped=$skipped (canonical advisory; provider files authoritative)"

# --- Antigravity ---
# Generate .anti/agents.json — a JSON manifest read by Eve at boot.
# Eve calls the define_subagent LLM tool for each entry; there is no 'agy define_subagent' CLI.
mkdir -p .anti
python3 - <<'PYEOF'
import json, pathlib, re, sys

agents_dir = pathlib.Path('.agent/agents')
result = []
for md_file in sorted(agents_dir.glob('*.md')):
    name = md_file.stem
    content = md_file.read_text()
    # Strip YAML frontmatter (between first and second --- delimiters)
    if content.startswith('---'):
        parts = content.split('---', 2)
        body = parts[2].lstrip('\n') if len(parts) >= 3 else content
    else:
        body = content
    # Extract description from YAML frontmatter
    m = re.search(r'^description:\s*(.+)$', content, re.MULTILINE)
    description = m.group(1).strip().strip('"\'') if m else name
    result.append({'name': name, 'description': description, 'system_prompt': body})

# Minimum length assertion — check BEFORE writing to disk
SHORT_THRESHOLD = 200
short = [(a['name'], len(a['system_prompt'])) for a in result if len(a['system_prompt']) < SHORT_THRESHOLD]
if short:
    print(f'⚠️  ERROR: system_prompt too short (threshold={SHORT_THRESHOLD}): {short}', file=sys.stderr)
    sys.exit(1)

# Atomic write — tempfile + rename so a failed run never leaves stale JSON
pathlib.Path('.anti').mkdir(exist_ok=True)
target = pathlib.Path('.anti/agents.json')
tmp = target.with_suffix('.json.tmp')
tmp.write_text(json.dumps(result, indent=2))
tmp.rename(target)

print(f'✅ sync-agents: .anti/agents.json ({len(result)} agents)')
PYEOF

# Remove the old bash-script approach if it lingers
rm -f .anti/register_agents.sh
