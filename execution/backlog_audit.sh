#!/usr/bin/env bash
# backlog_audit.sh — exits 1 if any open backlog item has a completed mission file.
#
# Health check that catches the post-compact stale-backlog bug:
#   - scans .agent/memory/project/backlog.md for OPEN `- [ ]` rows
#   - extracts the bold slug token `**slug**` from each row (if present)
#   - looks up `.agent/memory/project/missions/*<slug>*.md`
#   - if any matching mission file has `status: done`, `status: complete`,
#     or `status: completed` → that backlog item is STALE.
#
# Conservative by design: items without a `**slug**` token are skipped (no false positives).
#
# Exit codes:
#   0 — clean (no stale items found)
#   1 — stale items found (printed to stdout)
#   2 — usage / environment error
set -euo pipefail

BACKLOG=".agent/memory/project/backlog.md"
MISSIONS_DIR=".agent/memory/project/missions"

if [ ! -f "$BACKLOG" ]; then
  echo "backlog-audit: no $BACKLOG — nothing to audit." >&2
  exit 0
fi

if [ ! -d "$MISSIONS_DIR" ]; then
  echo "backlog-audit: no $MISSIONS_DIR — nothing to audit against." >&2
  exit 0
fi

stale_count=0
stale_report=""

# Iterate over every OPEN backlog row (starts with `- [ ]`).
# Bash 3.2 compatible — no mapfile, no readarray.
while IFS= read -r line; do
  # Extract first **slug** token from the line, if any.
  slug=$(printf '%s' "$line" | grep -oE '\*\*[a-zA-Z0-9_-]+\*\*' | head -1 | sed 's/\*\*//g' || true)
  [ -z "$slug" ] && continue

  # Find any mission file whose filename contains the slug.
  match=$(find "$MISSIONS_DIR" -maxdepth 1 -type f -name "*${slug}*.md" 2>/dev/null | head -1 || true)
  [ -z "$match" ] && continue

  # Read the mission's status field (frontmatter or body).
  status=$(grep -E '^status:' "$match" | head -1 | awk '{print $2}' | tr -d '"' | tr -d "'" || true)
  case "$status" in
    done|complete|completed)
      stale_count=$((stale_count + 1))
      stale_report="${stale_report}  - slug=${slug}  mission=${match}  status=${status}
    backlog row: ${line}
"
      ;;
  esac
done < <(grep -E '^- \[ \]' "$BACKLOG" || true)

if [ "$stale_count" -gt 0 ]; then
  echo "❌ backlog-audit: $stale_count stale open item(s) found — these missions are DONE but backlog row is still '[ ]':"
  echo ""
  printf '%s' "$stale_report"
  echo ""
  echo "Fix: edit $BACKLOG and change `- [ ]` → `- [x]` for the rows above, then re-run \`make backlog-audit\`."
  exit 1
fi

echo "✅ backlog-audit: clean — no stale [ ] items with completed missions."
exit 0
