#!/usr/bin/env bash
# sync_agents.sh — Generate platform-specific agent configs from canonical definitions
# Reads .agent/agents/*.md → writes one file per agent into every provider that
# declares an agents_dir, and one JSON manifest per provider that declares an
# agents_manifest.
#
# Targets are ENUMERATED from .agent/providers/*.json — never a hardcoded
# destination list, exactly as sync_rules.sh already does. A provider with no
# agents_dir reads AGENTS.md natively or is fed by a manifest; writing a
# markdown tree it has no loader for delivers bytes nothing reads, and counting
# that surface halts the boot with a remedy no command can clear.
#
# Only the FRONTMATTER DIALECT is per-provider (models and tool names differ);
# the destination always comes from the declaration.
#
# NON-DESTRUCTIVE: creates missing provider agent files from .agent/agents/ canonical reference.
# Never overwrites an existing provider agent file — those are authoritative.

set -euo pipefail

CANONICAL_DIR=".agent/agents"
PROVIDERS_DIR=".agent/providers"

if [ ! -d "$PROVIDERS_DIR" ]; then
  echo "❌ sync_agents: $PROVIDERS_DIR not found — provider enumeration impossible"
  exit 1
fi

# Enumerate "<provider>\t<value>" for every provider declaring the given key.
enumerate_key() {
  python3 - "$PROVIDERS_DIR" "$1" <<'PYEOF'
import json
import pathlib
import sys

providers_dir = pathlib.Path(sys.argv[1])
key = sys.argv[2]
for path in sorted(providers_dir.glob("*.json")):
    try:
        cfg = json.loads(path.read_text())
    except (OSError, ValueError):
        continue
    if not isinstance(cfg, dict):
        continue
    value = cfg.get(key)
    if value:
        print("%s\t%s" % (cfg.get("provider", path.stem), value))
PYEOF
}

TARGETS=$(enumerate_key agents_dir)
MANIFESTS=$(enumerate_key agents_manifest)

# The frontmatter dialect a provider speaks. Kept as an explicit map — the same
# shape as sync_rules.sh's overlay_dir_for — because a model name and a tool
# name are provider vocabulary, not a path. An unknown provider gets the
# passthrough dialect rather than a guess at someone else's schema.
dialect_for() {
  case "$1" in
    claude-code) echo "claude" ;;
    gemini-cli)  echo "gemini" ;;
    grok-cli)    echo "grok"   ;;
    *)           echo "default" ;;
  esac
}

# Short label used in --check / orphan output. Cosmetic only.
short_name_for() {
  case "$1" in
    claude-code) echo "claude" ;;
    gemini-cli)  echo "gemini" ;;
    grok-cli)    echo "grok"   ;;
    *)           echo "$1"     ;;
  esac
}

# Mapping functions (avoids associative array issues across shells)
map_claude_model() {
  case "$1" in
    apex) echo "opus" ;;
    pro) echo "opus" ;;
    flash) echo "sonnet" ;;
    local) echo "haiku" ;;
    *) echo "sonnet" ;;
  esac
}

map_gemini_model() {
  case "$1" in
    apex) echo "gemini-2.5-pro" ;;
    pro) echo "gemini-2.5-pro" ;;
    flash) echo "gemini-2.5-flash" ;;
    local) echo "gemini-2.5-flash-lite" ;;
    *) echo "gemini-2.5-flash" ;;
  esac
}

# The model a dialect writes into frontmatter. Empty means the dialect has no
# model key at all (grok and the passthrough default), and --check therefore
# has nothing to compare — silence, not a false drift report.
model_for_dialect() {
  case "$1" in
    claude) map_claude_model "$2" ;;
    gemini) map_gemini_model "$2" ;;
    *)      echo "" ;;
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

# GH #1367's Grok tool-name remap table. read/shell/agent+task are the only
# mappings GH #1367 specifies; remaining tokens default-passthrough.
map_grok_tool() {
  case "$1" in
    read) echo "read_file" ;;
    shell) echo "run_terminal_command" ;;
    agent) echo "spawn_subagent" ;;
    task) echo "spawn_subagent" ;;
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
    case "$platform" in
      claude) mapped=$(map_claude_tool "$tool_item") ;;
      gemini) mapped=$(map_gemini_tool "$tool_item") ;;
      grok)   mapped=$(map_grok_tool "$tool_item") ;;
      *)      mapped="$tool_item" ;;
    esac
    if [ -n "$result" ]; then
      result="$result, \"$mapped\""
    else
      result="\"$mapped\""
    fi
  done <<< "$clean_csv"
  echo "$result"
}

if [ "${1:-}" = "--check" ]; then
  drift=0
  checked=0
  for canonical in "$CANONICAL_DIR"/*.md; do
    [ ! -f "$canonical" ] && continue
    filename=$(basename "$canonical")
    name="${filename%.md}"
    checked=$((checked + 1))

    model_tier=$(sed -n '/^---$/,/^---$/p' "$canonical" | grep '^model_tier:' | awk '{print $2}' || true)

    while IFS=$'\t' read -r provider dest; do
      [ -n "$dest" ] || continue
      dialect=$(dialect_for "$provider")
      expected=$(model_for_dialect "$dialect" "$model_tier")
      # A dialect with no model key has nothing to drift.
      [ -n "$expected" ] || continue
      label=$(short_name_for "$provider")
      target="$dest/$filename"
      if [ ! -f "$target" ]; then
        echo "MISSING $label $name: $target does not exist"
        continue
      fi
      actual=$(sed -n '/^---$/,/^---$/p' "$target" | grep '^model:' | awk '{print $2}' || true)
      if [ "$actual" != "$expected" ]; then
        echo "DRIFT $label $name: expected=$expected actual=$actual"
        drift=$((drift + 1))
      fi
    done <<< "$TARGETS"
  done

  if [ "$drift" -eq 0 ]; then
    echo "✅ sync_agents --check: no drift found ($checked agents checked)"
    exit 0
  else
    echo "❌ sync_agents --check: $drift drift(s) found ($checked agents checked)"
    exit 1
  fi
fi

# --- Orphan detection: provider agent files with no canonical source ---
# (GH provider-agent-orphans F2). Reverse of the sync/--check scans above:
# those walk $CANONICAL_DIR outward; this walks the declared provider dirs
# inward looking for *.md files with no .agent/agents/<name>.md counterpart.
ORPHAN_ALLOWLIST=".agent/agents/PROVIDER_ORPHAN_ALLOWLIST.yaml"

# Prints "<provider>|<name>" once per allowlisted entry (empty output if the
# allowlist file doesn't exist — missing file = zero exclusions, not error).
allowlisted_pairs() {
  [ -f "$ORPHAN_ALLOWLIST" ] || return 0
  python3 - "$ORPHAN_ALLOWLIST" <<'PYEOF'
import sys
path = sys.argv[1]
provider = None
name = None
with open(path) as f:
    for line in f:
        stripped = line.strip()
        if stripped.startswith('- provider:'):
            if provider and name:
                print(f"{provider}|{name}")
            provider = stripped.split(':', 1)[1].strip()
            name = None
        elif stripped.startswith('name:'):
            name = stripped.split(':', 1)[1].strip()
    if provider and name:
        print(f"{provider}|{name}")
PYEOF
}

# Populates the global ORPHANS array with "<label>|<name>|<path>" entries
# and sets ORPHAN_CHECKED to the total *.md files scanned across every declared
# agents_dir (before allowlist filtering).
scan_orphans() {
  ORPHANS=()
  ORPHAN_CHECKED=0
  local allowlist_pairs
  allowlist_pairs="$(allowlisted_pairs)"

  local provider dest label f name
  while IFS=$'\t' read -r provider dest; do
    [ -n "$dest" ] || continue
    [ -d "$dest" ] || continue
    label=$(short_name_for "$provider")
    for f in "$dest"/*.md; do
      [ -f "$f" ] || continue
      ORPHAN_CHECKED=$((ORPHAN_CHECKED + 1))
      name=$(basename "$f" .md)
      [ -f "$CANONICAL_DIR/$name.md" ] && continue
      if [ -n "$allowlist_pairs" ] && grep -qxF "$label|$name" <<< "$allowlist_pairs"; then
        continue
      fi
      ORPHANS+=("$label|$name|$f")
    done
  done <<< "$TARGETS"
}

if [ "${1:-}" = "--check-orphans" ]; then
  scan_orphans
  for orphan in "${ORPHANS[@]:-}"; do
    [ -z "$orphan" ] && continue
    IFS='|' read -r o_provider o_name o_path <<< "$orphan"
    echo "ORPHAN $o_provider $o_name: $o_path has no canonical source ($CANONICAL_DIR/$o_name.md missing)"
  done

  orphan_count="${#ORPHANS[@]}"
  if [ "$orphan_count" -eq 0 ]; then
    echo "✅ sync_agents --check-orphans: no orphans found ($ORPHAN_CHECKED provider files checked)"
    exit 0
  else
    echo "❌ sync_agents --check-orphans: $orphan_count orphan(s) found ($ORPHAN_CHECKED provider files checked)"
    exit 2
  fi
fi

if [ "${1:-}" = "--prune-orphans" ]; then
  scan_orphans
  removed=0
  for orphan in "${ORPHANS[@]:-}"; do
    [ -z "$orphan" ] && continue
    IFS='|' read -r o_provider o_name o_path <<< "$orphan"
    # Section-10 guarded delete: never let an empty variable become a path.
    [ -n "$o_path" ] && [ -e "$o_path" ] && rm -f -- "$o_path"
    echo "remove: $o_path"
    removed=$((removed + 1))
  done
  echo "✅ sync_agents --prune-orphans: removed $removed orphan(s)"
  exit 0
fi

if [ -z "$TARGETS" ] && [ -z "$MANIFESTS" ]; then
  echo "⚠️  sync_agents: no provider declares an agents_dir or an agents_manifest — nothing to sync."
  exit 0
fi

while IFS=$'\t' read -r provider dest; do
  [ -n "$dest" ] || continue
  mkdir -p "$dest"
done <<< "$TARGETS"

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

  # Get body (everything after second ---)
  body=$(awk 'BEGIN{n=0} /^---$/{n++; if(n==2) next} n>=2{print}' "$canonical")

  while IFS=$'\t' read -r provider dest; do
    [ -n "$dest" ] || continue
    target="$dest/$filename"
    if [ -f "$target" ]; then
      echo "SKIP (exists): $target"
      skipped=$((skipped + 1))
      continue
    fi

    dialect=$(dialect_for "$provider")
    model=$(model_for_dialect "$dialect" "$model_tier")
    if [ "$dialect" = "claude" ]; then
      denied=$(map_tools "claude" "$tools_denied_line")
      tools=""
    else
      denied=""
      tools=$(map_tools "$dialect" "$tools_line")
    fi

    {
      echo "---"
      echo "name: ${filename%.md}"
      [ -n "$model" ] && echo "model: $model"
      echo "description: $description"
      [ -n "$denied" ] && echo "disallowedTools: [$denied]"
      [ -n "$tools" ] && echo "tools: [$tools]"
      echo "---"
      echo "$body"
    } > "$target"
    echo "create: $target"
    created=$((created + 1))
  done <<< "$TARGETS"

done

echo "✅ sync_agents: created=$created skipped=$skipped (canonical advisory; provider files authoritative)"

# --- Agents manifests (antigravity) ---
# A provider that declares an `agents_manifest` is fed by a JSON file, not by a
# markdown tree: Eve reads .anti/agents.json at boot and calls the
# define_subagent LLM tool for each entry — there is no 'agy define_subagent'
# CLI, and no markdown directory it could load instead.
while IFS=$'\t' read -r provider manifest_path; do
  [ -n "$manifest_path" ] || continue
  python3 - "$manifest_path" <<'PYEOF'
import json, pathlib, re, sys

target = pathlib.Path(sys.argv[1])
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
target.parent.mkdir(parents=True, exist_ok=True)
tmp = target.with_suffix('.json.tmp')
tmp.write_text(json.dumps(result, indent=2))
tmp.rename(target)

print(f'✅ sync-agents: {target} ({len(result)} agents)')
PYEOF

  # Remove the old bash-script approach if it lingers. Guarded delete, and an
  # `if` rather than an `&&` chain: under `set -e` a false final command in a
  # loop body fails the whole script, so a missing legacy file would abort the
  # sync it is supposed to tidy after.
  legacy="$(dirname "$manifest_path")/register_agents.sh"
  if [ -n "$legacy" ] && [ -e "$legacy" ]; then
    rm -f -- "$legacy"
  fi
done <<< "$MANIFESTS"
