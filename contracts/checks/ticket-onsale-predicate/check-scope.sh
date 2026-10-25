#!/bin/sh
# A10 -- scope allow-list. Every file changed against origin/main (committed, staged, unstaged or
# untracked) must match a line in goldens/scope-allowlist.txt. Lines starting # are comments.
ALLOW=.agent/memory/project/specs/ticket-onsale-predicate/goldens/scope-allowlist.txt
BASE=$(git merge-base HEAD origin/main) || exit 2
CHANGED=$( { git diff --name-only "$BASE"; git ls-files --others --exclude-standard; } | sort -u)
BAD=""
for f in $CHANGED; do
  hit=0
  while IFS= read -r pat; do
    case "$pat" in ''|'#'*) continue ;; esac
    if printf '%s\n' "$f" | grep -Eq "$pat"; then hit=1; break; fi
  done < "$ALLOW"
  [ "$hit" -eq 1 ] || BAD="$BAD $f"
done
if [ -n "$BAD" ]; then echo "FAIL A10 out-of-scope files:$BAD"; exit 1; fi
echo "PASS A10 all changed files are in scope"
