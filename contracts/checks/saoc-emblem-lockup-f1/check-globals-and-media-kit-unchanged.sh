#!/usr/bin/env bash
# A6 — out-of-scope files stay byte-unchanged against the pinned base:
#   - app/globals.css          (palette/font @theme tokens — "Lockup only")
#   - media-kit page.tsx       (lists OLD logo files as press downloads;
#                                a separate concern, not one of the three
#                                explorer panels)
set -euo pipefail

BASE_COMMIT="67d35581"

if ! git merge-base --is-ancestor "$BASE_COMMIT" HEAD 2>/dev/null; then
  echo "pinned base $BASE_COMMIT is not an ancestor of HEAD — diff base is stale, fix the pin"
  exit 1
fi

FAIL=0
for f in "app/globals.css" "app/(marketing)/media-kit/page.tsx"; do
  if ! git diff --quiet "$BASE_COMMIT" -- "$f"; then
    echo "out-of-scope file changed: $f"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "OK: app/globals.css and media-kit/page.tsx unchanged since $BASE_COMMIT"
