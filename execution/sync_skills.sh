#!/usr/bin/env bash
# sync_skills.sh — Propagate the canonical skill set to every provider that
# declares a skills_dir.
#
# Targets are ENUMERATED from .agent/providers/*.json `skills_dir` — never a
# hardcoded destination list, exactly as sync_rules.sh already does. Providers
# with no skills_dir (they read AGENTS.md natively, or are fed by a manifest)
# are not targets: writing to them would deliver bytes nothing loads, and
# counting the surface would halt the boot with a remedy that cannot clear it.

set -euo pipefail

CANONICAL_DIR=".agent/skills"
PROVIDERS_DIR=".agent/providers"

if [ ! -d "$PROVIDERS_DIR" ]; then
    echo "❌ sync_skills: $PROVIDERS_DIR not found — provider enumeration impossible"
    exit 1
fi

# Enumerate "<provider>\t<skills_dir>" for every provider declaring one.
TARGETS=$(python3 - "$PROVIDERS_DIR" <<'PYEOF'
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
    skills_dir = cfg.get("skills_dir")
    if skills_dir:
        print("%s\t%s" % (cfg.get("provider", path.stem), skills_dir))
PYEOF
)

if [ -z "$TARGETS" ]; then
    echo "⚠️  sync_skills: no provider declares a skills_dir — nothing to sync."
    exit 0
fi

mkdir -p "$CANONICAL_DIR"
CANONICAL_REAL=$(cd "$CANONICAL_DIR" && pwd -P)

targets=0
# Here-string, not a pipeline: a pipeline runs the loop in a subshell where the
# counter never escapes, and .agent/rules/_core/sandbox.md forbids the /tmp
# location a scratch file would land in.
while IFS=$'\t' read -r provider dest; do
    [ -n "$dest" ] || continue

    # Self-heal: a platform skill dir that is a symlink onto the canonical dir
    # (old init.sh convention) must become a real directory BEFORE any delete
    # step — deleting through it would destroy the canonical files instead.
    if [ -L "$dest" ]; then
        DEST_REAL=$(cd "$dest" && pwd -P 2>/dev/null || echo "")
        if [ "$DEST_REAL" = "$CANONICAL_REAL" ]; then
            echo "WARN: $dest is a symlink to the canonical skills dir — self-healing to a real directory"
            rm -f "$dest"
        fi
    fi
    mkdir -p "$dest"

    # Non-dereferencing glob delete (not `find "$dest/" -delete`, which walks
    # into a symlinked directory argument's target).
    rm -f "$dest"/*.md

    targets=$((targets + 1))
done <<< "$TARGETS"

synced=0
for skill in "$CANONICAL_DIR"/*.md; do
    [ ! -f "$skill" ] && continue
    filename=$(basename "$skill")
    [[ "$filename" == .keep* ]] && continue

    while IFS=$'\t' read -r provider dest; do
        [ -n "$dest" ] || continue
        cp "$skill" "$dest/$filename"
    done <<< "$TARGETS"

    synced=$((synced + 1))
done

echo "✅ Synced $synced skills → $targets provider skills_dir(s) from $CANONICAL_DIR."
