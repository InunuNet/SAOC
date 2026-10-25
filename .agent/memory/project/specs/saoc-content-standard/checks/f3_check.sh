#!/bin/bash
# saoc-content-standard F3 (PG-1) static checks. Usage: f3_check.sh <case>. Exit 0 = pass.
# Every case first requires its target file to exist, so a missing or moved file FAILS
# instead of passing a negative grep vacuously.
need() { [ -f "$1" ] || { echo "missing: $1"; exit 1; }; }
has()  { need "$1"; grep -qF -- "$2" "$1" || { echo "absent in $1: $2"; exit 1; }; }
SPEC=.agent/memory/project/specs/saoc-content-standard
HERO=components/ui/PageHero.tsx
CSS=app/globals.css
case "$1" in
  route-list)
    # pg1.json routes must be a subset of standard.json, never include an out-of-scope id, and cover every ungated standard route.
    need $SPEC/goldens/pg1.json
    need $SPEC/goldens/standard.json
    node $SPEC/checks/route_list_check.mjs ;;
  hero-clamp)
    # The clamp lives in PageHero.tsx or globals.css; one of them must carry exactly clamp(320px, 22vw, 380px).
    need $HERO
    need $CSS
    grep -qE 'clamp\(320px, ?22vw, ?380px\)' $HERO $CSS || { echo "no clamp(320px, 22vw, 380px) in $HERO or $CSS"; exit 1; } ;;
  hero-480-gone)
    # The old 480px floor must not survive as the PageHero default or as a utility class.
    need $HERO
    ! grep -qE "minHeight = '480px'|min-h-\[480px\]" $HERO || { echo "480px hero floor still in $HERO"; exit 1; } ;;
  shared-api)
    # NOS Site pins to these names and attributes. Every pinned token from pg1.json must still be present.
    need $SPEC/goldens/pg1.json
    node $SPEC/checks/shared_api_check.mjs ;;
  *) echo "unknown case $1"; exit 2 ;;
esac
