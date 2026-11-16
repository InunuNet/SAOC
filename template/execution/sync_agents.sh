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
# Rendering, skills inlining and --check live in sync_agents_core.py. Provider markdown files
# carry an athanor-render body-hash marker: an untouched render is refreshed (old copy saved under
# .agent/memory/scratch/agent-backups/), a customised file is KEPT and the fresh render is written
# beside it as <name>.md.athanor-new. A missing or oversized skill exits 1 before anything is
# written.

set -euo pipefail
# Windows: every child python reads, writes and prints UTF-8 (a cp1252 console cannot
# print the check marks; scaffold failed 0/6 without this, Athanor Win 2026-11-07).
export PYTHONUTF8=1

# Interpreter: python3, else python or py (Windows); the first that actually runs.
PY="" ; CANDS="python3 python py"
for cand in $CANDS; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys' >/dev/null 2>&1; then
    PY="$cand"
    break
  fi
done
if [ -z "$PY" ]; then
  echo "❌ sync_agents: no python interpreter found on PATH"
  exit 1
fi

CANONICAL_DIR=".agent/agents"
PROVIDERS_DIR=".agent/providers"

if [ ! -d "$PROVIDERS_DIR" ]; then
  echo "❌ sync_agents: $PROVIDERS_DIR not found — provider enumeration impossible"
  exit 1
fi

# Enumerate "<provider>\t<value>" for every provider declaring the given key.
enumerate_key() {
  "$PY" - "$PROVIDERS_DIR" "$1" <<'PYEOF'
import json
import pathlib
import sys

providers_dir = pathlib.Path(sys.argv[1])
key = sys.argv[2]
for path in sorted(providers_dir.glob("*.json")):
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError) as exc:
        print(f"ERROR: invalid provider configuration {path}: {exc}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(cfg, dict):
        print(f"ERROR: invalid provider configuration {path}: expected object", file=sys.stderr)
        sys.exit(1)
    value = cfg.get(key)
    if value:
        print("%s\t%s" % (cfg.get("provider", path.stem), value))
PYEOF
}

TARGETS=$(enumerate_key agents_dir)
MANIFESTS=$(enumerate_key agents_manifest)
TOML_DIRS=$(enumerate_key agents_toml_dir)
SKILLS_DIRS=$(enumerate_key skills_dir)
CORE="$(dirname "$0")/sync_agents_core.py"

# Short label used in --check / orphan output. Cosmetic only.
short_name_for() {
  case "$1" in
    claude-code) echo "claude" ;;
    grok-cli)    echo "grok"   ;;
    *)           echo "$1"     ;;
  esac
}

if [ "${1:-}" = "--check" ]; then
  exec "$PY" "$CORE" check --targets "$TARGETS" --manifests "$MANIFESTS" \
    --toml-dirs "$TOML_DIRS" --skills-dirs "$SKILLS_DIRS"
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
  "$PY" - "$ORPHAN_ALLOWLIST" <<'PYEOF'
import sys
path = sys.argv[1]
provider = None
name = None
with open(path, encoding="utf-8") as f:
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

if [ -z "$TARGETS" ] && [ -z "$MANIFESTS" ] && [ -z "$TOML_DIRS" ]; then
  echo "⚠️  sync_agents: no provider declares an agents_dir, agents_manifest or agents_toml_dir — nothing to sync."
  exit 0
fi

exec "$PY" "$CORE" sync --targets "$TARGETS" --manifests "$MANIFESTS" --toml-dirs "$TOML_DIRS"
