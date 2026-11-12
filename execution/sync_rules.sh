#!/usr/bin/env bash
# sync_rules.sh — Propagate the canonical rule set to every provider that
# declares a rules_dir.
#
# Canonical structure:
#   .agent/rules/manifest.json  → the declared expected set (never synced out)
#   .agent/rules/_core/         → all providers
#   .agent/rules/<short>/       → that provider only, layered on top of _core
#
# Targets are ENUMERATED from .agent/providers/*.json `rules_dir` — never a
# hardcoded destination list, so a provider added to .agent/providers/ is served
# without editing this script. `--delete` is applied UNIFORMLY: a rule retired
# from canonical must disappear from every provider tree, not just Claude's.
# The overlay pass runs afterwards, so provider-specific rules survive it.

set -euo pipefail

CORE_RULES_DIR=".agent/rules/_core"
PROVIDERS_DIR=".agent/providers"

# Safety: refuse to run with no canonical source. Without this guard the
# --delete below would wipe every destination with nothing to restore.
if [ ! -d "$CORE_RULES_DIR" ]; then
    echo "❌ sync_rules: canonical source missing ($CORE_RULES_DIR not found)"
    echo "   Run: make migrate-rules  (one-time migration)"
    exit 1
fi

if [ ! -d "$PROVIDERS_DIR" ]; then
    echo "❌ sync_rules: $PROVIDERS_DIR not found — provider enumeration impossible"
    exit 1
fi

# Enumerate "<provider>\t<rules_dir>" for every provider declaring one.
# Providers with no rules_dir (they read AGENTS.md natively) are not targets.
TARGETS=$(python3 - "$PROVIDERS_DIR" <<'PYEOF' | tr -d '\r'
import json
import pathlib
import sys

providers_dir = pathlib.Path(sys.argv[1])
for path in sorted(providers_dir.glob("*.json")):
    try:
        cfg = json.loads(path.read_text())
    except (OSError, ValueError):
        continue
    if not isinstance(cfg, dict):
        continue
    rules_dir = cfg.get("rules_dir")
    if rules_dir:
        print("%s\t%s" % (cfg.get("provider", path.stem), rules_dir))
PYEOF
)

if [ -z "$TARGETS" ]; then
    echo "⚠️  sync_rules: no provider declares a rules_dir — nothing to sync."
    exit 0
fi

# Overlay directory name for a provider. Kept as an explicit map so the
# canonical .agent/rules/<short>/ layout stays stable as provider ids change.
overlay_dir_for() {
    case "$1" in
        claude-code) echo ".agent/rules/claude" ;;
        grok-cli)    echo ".agent/rules/grok"   ;;
        *)           echo ".agent/rules/$1"     ;;
    esac
}

# Mirror the top-level *.md files of $1 into $2 ("delete": also drop files in $2
# that $1 no longer has). rsync is absent from Git Bash on Windows, so fall back
# to cp; the result is the same either way.
sync_md() {
    local src="$1" dest="$2" mode="$3" f
    if command -v rsync >/dev/null 2>&1; then
        if [ "$mode" = delete ]; then
            rsync -a --delete --include="*.md" --exclude="*" "$src/" "$dest/"
        else
            rsync -a --include="*.md" --exclude="*" "$src/" "$dest/"
        fi
        return
    fi
    if [ "$mode" = delete ]; then
        for f in "$dest"/*.md; do
            [ -e "$f" ] || continue
            [ -e "$src/$(basename "$f")" ] || rm -f "$f"
        done
    fi
    cp -f "$src"/*.md "$dest"/
}

synced=0
# Here-string, not a scratch file: .agent/rules/_core/sandbox.md forbids the
# /tmp location a mktemp target would land in, and a pipeline into `while`
# would run the loop in a subshell where `synced` never escapes.
while IFS=$'\t' read -r provider dest; do
    [ -n "$dest" ] || continue
    mkdir -p "$dest"

    # --delete on EVERY target. Filter order matters: rsync applies filters
    # first-match-wins, so --include="*.md" must precede --exclude="*".
    sync_md "$CORE_RULES_DIR" "$dest" delete

    overlay=$(overlay_dir_for "$provider")
    if [ -d "$overlay" ] && ls "$overlay"/*.md >/dev/null 2>&1; then
        sync_md "$overlay" "$dest" keep
    fi

    synced=$((synced + 1))
done <<< "$TARGETS"

echo "✅ Rule sync complete — $synced provider rules_dir(s) from $CORE_RULES_DIR."
