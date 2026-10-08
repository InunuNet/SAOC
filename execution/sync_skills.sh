#!/usr/bin/env bash
# sync_skills.sh — Propagate the canonical skill set to every provider that
# declares a skills_dir.
#
# Targets are ENUMERATED from .agent/providers/*.json `skills_dir` — never a
# hardcoded destination list, exactly as sync_rules.sh already does. Providers
# with no skills_dir (they read AGENTS.md natively, or are fed by a manifest)
# are not targets: writing to them would deliver bytes nothing loads, and
# counting the surface would halt the boot with a remedy that cannot clear it.
#
# Each canonical .agent/skills/<name>.md is delivered as
# <skills_dir>/<name>/SKILL.md, the only layout Claude Code (and the Agent
# Skills format) registers. Until v3.8.17 this copied flat <name>.md files,
# which no provider loaded: no project agent was ever offered alembic, gws-* or
# onboard. Flat files from that layout are removed. A delivered directory
# carries a .athanor-skill marker, so a skill dropped from the canonical set is
# removed and a project's own skill directories are never touched.

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

# Here-string, not a pipeline: a pipeline runs the loop in a subshell, and
# .agent/rules/_core/sandbox.md forbids the /tmp location a scratch file would
# land in.
while IFS=$'\t' read -r provider dest; do
    [ -n "$dest" ] || continue

    # Self-heal: a platform skill dir that is a symlink onto the canonical dir
    # (the old bootstrap convention) must become a real directory BEFORE any
    # delete step — deleting through it would destroy the canonical files.
    if [ -L "$dest" ]; then
        DEST_REAL=$(cd "$dest" && pwd -P 2>/dev/null || echo "")
        if [ "$DEST_REAL" = "$CANONICAL_REAL" ]; then
            echo "WARN: $dest is a symlink to the canonical skills dir — self-healing to a real directory"
            rm -f "$dest"
        fi
    fi
done <<< "$TARGETS"

python3 - "$CANONICAL_DIR" "$TARGETS" <<'PYEOF'
import pathlib
import re
import shutil
import sys

MARKER = ".athanor-skill"
canonical = pathlib.Path(sys.argv[1])
targets = [line.split("\t", 1)[1] for line in sys.argv[2].splitlines() if "\t" in line]


def has_description(fields):
    for i, line in enumerate(fields):
        if not line.startswith("description:"):
            continue
        value = line[len("description:"):].strip()
        if value in (">", "|", ">-", "|-"):
            return i + 1 < len(fields) and fields[i + 1][:1].isspace()
        return value not in ("", '""', "''", "null", "~")
    return False


def to_skill(src):
    """Return (name, SKILL.md text): name forced to the file stem, description required."""
    name = src.stem
    text = src.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    fields, body = [], text
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end == -1:
            sys.exit("❌ sync_skills: %s: unterminated frontmatter" % src)
        fields = [line for line in text[4:end].splitlines() if line.strip()]
        body = text[end + 5:]
    if not has_description(fields):
        sys.exit("❌ sync_skills: %s has no non-empty description: frontmatter — an "
                 "agent is offered a skill by its description, so it would never be used" % src)
    fields = ["name: %s" % name] + [line for line in fields if not line.startswith("name:")]
    return name, "---\n%s\n---\n%s" % ("\n".join(fields), body)


skills = {}
for src in sorted(canonical.glob("*.md")):
    if src.name.startswith(".keep"):
        continue
    name, text = to_skill(src)
    skills[name] = text

# A sibling reference -- [label](other.md) or a bare `other.md` -- must still
# resolve in the new layout. A path such as .agent/skills/other.md is left
# alone: it already names a real file.
if skills:
    ref = re.compile(r"(?<![\w/.-])(%s)\.md(?![\w-])" % "|".join(map(re.escape, skills)))
    for name, text in skills.items():
        head, sep, body = text.partition("\n---\n")
        skills[name] = head + sep + ref.sub(r"../\1/SKILL.md", body)

for dest in targets:
    root = pathlib.Path(dest)
    root.mkdir(parents=True, exist_ok=True)
    for flat in root.glob("*.md"):
        flat.unlink()
    for d in root.iterdir():
        if d.is_dir() and not d.is_symlink() and (d / MARKER).exists() and d.name not in skills:
            shutil.rmtree(d)
    for name, text in skills.items():
        d = root / name
        if d.is_symlink() or (d.exists() and not (d / MARKER).exists() and any(d.iterdir())):
            # The project's own skill of the same name wins; never adopt it.
            print("WARN: %s exists and is not Athanor-managed — not overwritten" % d)
            continue
        d.mkdir(exist_ok=True)
        (d / "SKILL.md").write_text(text, encoding="utf-8")
        (d / MARKER).write_text("generated by execution/sync_skills.sh from "
                                ".agent/skills/%s.md — edit that file\n" % name)

print("✅ Synced %d skills → %d provider skills_dir(s) from %s (<name>/SKILL.md)."
      % (len(skills), len(targets), canonical))
PYEOF
