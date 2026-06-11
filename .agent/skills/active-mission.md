---
name: active-mission
description: Resolve current mission slug, mission file path, and checkpoint from active.json — single source of truth.
usage: Invoke this skill (or source the helper) when any script or agent needs the active mission slug, contract path, or checkpoint.
---

# active-mission

Canonical reader for `.agent/memory/project/missions/active.json`. Eliminates 6 different inline parsers each with their own bug (double-`.md` suffix, double-date prefix, slug-with-numeric-prefix).

## When to use

- Any script that needs to find the active mission's contract or scratch artifacts
- Any agent that needs to know the current slug or checkpoint
- Replaces inline `cat active.json | python3 -c ...` parsing in scripts

## Usage (shell)

```bash
eval "$(python3 -c '
import json, re, sys, os
try:
    data = json.load(open(".agent/memory/project/missions/active.json"))
except Exception:
    sys.exit(0)
mf = data.get("mission", "")
slug = os.path.basename(mf)
if slug.endswith(".md"):
    slug = slug[:-3]
# strip date prefix YYYY-MM-DD-
slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", slug)
print(f"SLUG={slug}")
print(f"MISSION_FILE=.agent/memory/project/missions/{mf}")
print(f"CHECKPOINT={data.get(\"checkpoint\",\"\")}")
')"
echo "$SLUG $MISSION_FILE $CHECKPOINT"
```

## Output

Three shell variables in the calling environment:

- `SLUG` — bare mission slug, no date prefix, no `.md` extension
- `MISSION_FILE` — full relative path to the mission markdown file
- `CHECKPOINT` — current checkpoint id (e.g. `F1-dev`), or empty string

## Common bugs this skill prevents

- **Double `.md` suffix** — `foo.md.md` from naïve concat. Fix: strip exactly one `.md` then re-add if needed.
- **Double date prefix** — `2026-05-22-2026-05-22-slug` from re-prefixing. Fix: regex-strip leading `YYYY-MM-DD-` exactly once.
- **Slug with numeric prefix** — never use `while [[ "$slug" =~ ^[0-9] ]]; do slug=${slug#*-}; done` — it eats real slug parts. Use the date-prefix regex instead.
- **Missing active.json** — return empty values, do not crash.

## Related

- `quick-gate` — uses this skill to find the contract file
- `wrap-mission` — uses this skill to clear active.json
