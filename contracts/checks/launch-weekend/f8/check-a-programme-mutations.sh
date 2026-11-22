#!/bin/bash
# F8-A8 - mutation proof for the F8-A1 programme-links assertions (PG-G1 board). Builds a throwaway git tree from the
# files check-a-static.mjs reads, confirms the clean tree is green, then removes the Symposium link and (separately) the
# Workshops link in several ways and requires check-a-static.mjs to go red for each. Every mutation goes through
# mutant_ok: a builder whose target text no longer matches aborts the harness, so a mutation that was never applied
# can never read as "detected". Run from the repo root.
set -u

ROOT="$(pwd)"
CHECK="$ROOT/contracts/checks/launch-weekend/f8/check-a-static.mjs"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
status=0

FILES=(
  "lib/data/show-pages.ts"
  "components/nos/ShowPageProse.tsx"
  "app/(nos)/national-show/programme/page.tsx"
  "components/show/nos/ShowContentState.tsx"
  "proxy.ts"
  "lib/beta-public-launch.ts"
  "scripts/refresh-llms.ts"
  "lib/data/ticket-presentation.ts"
  "components/nos/NosShowIndex.tsx"
)

# Fresh single-commit tree per scenario so a mutation never leaks into the next one.
fresh_tree() {
  local dir="$1" f
  mkdir -p "$dir/app" "$dir/components"
  for f in "${FILES[@]}"; do
    if [ ! -f "$ROOT/$f" ]; then echo "INFRA: $f missing from the tree under test"; exit 2; fi
    mkdir -p "$dir/$(dirname "$f")"
    cp "$ROOT/$f" "$dir/$f"
  done
  git -C "$dir" init -q
  git -C "$dir" add -A
  git -C "$dir" -c user.email=f8@example.invalid -c user.name=f8 commit -q -m base
}

run_check() {
  (cd "$ROOT" && F8_ROOT="$1" BASE_REF=HEAD node "$CHECK" >"$WORK/out.txt" 2>&1)
}

# mutant_ok ID FILE-IN-TREE TREE RC: builder exit non-zero or a byte-identical result is "MUTATION NOT APPLIED".
mutant_ok() {
  local id="$1" file="$2" tree="$3" rc="$4"
  if [ "$rc" -ne 0 ]; then
    echo "FAIL F8-A8: MUTATION NOT APPLIED: $id (builder exited $rc; its target text no longer matches $file)"
    status=1; return 1
  fi
  if cmp -s "$ROOT/$file" "$tree/$file"; then
    echo "FAIL F8-A8: MUTATION NOT APPLIED: $id (mutant is byte-identical to $file, a no-op)"
    status=1; return 1
  fi
  return 0
}

# expect_red ID TREE EXPECTED-FRAGMENT: the check must exit 1 AND name the removed link, not fail for another reason.
expect_red() {
  local id="$1" tree="$2" fragment="$3" rc
  run_check "$tree"; rc=$?
  if [ "$rc" -ne 1 ]; then
    echo "FAIL F8-A8: $id was NOT detected (check exited $rc, expected 1)"
    status=1; return
  fi
  if ! grep -qF -- "$fragment" "$WORK/out.txt"; then
    echo "FAIL F8-A8: $id exited 1 but not for the expected reason (missing \"$fragment\")"
    status=1; return
  fi
  echo "ok   $id detected (exit 1, reports: $fragment)"
}

# mutate ID FILE OLD NEW EXPECTED-FRAGMENT: replace OLD by NEW (exactly once) in FILE of a fresh tree.
mutate() {
  local id="$1" file="$2" old="$3" new="$4" fragment="$5" tree rc
  tree="$WORK/$id"
  fresh_tree "$tree"
  python3 - "$tree/$file" "$old" "$new" <<'PY'
import sys
path, old, new = sys.argv[1:4]
text = open(path).read()
assert text.count(old) == 1, f"target text occurs {text.count(old)} times, expected 1: {old!r}"
open(path, "w").write(text.replace(old, new))
PY
  rc=$?
  mutant_ok "$id" "$file" "$tree" $rc && expect_red "$id" "$tree" "$fragment"
}

PAGE="app/(nos)/national-show/programme/page.tsx"
PRES="lib/data/ticket-presentation.ts"
INDEX="components/nos/NosShowIndex.tsx"

# Control: the unmutated tree must be green, or every "red" below proves nothing.
fresh_tree "$WORK/clean"
run_check "$WORK/clean"; rc=$?
if [ "$rc" -ne 0 ]; then
  echo "FAIL F8-A8: control (unmutated tree) exited $rc"; cat "$WORK/out.txt"; exit 1
fi
echo "ok   control: unmutated tree is green"

# Symposium link removed, four ways.
mutate S1 "$PRES" "  symposium: '/symposium'," "" "TICKET_DETAIL_HREFS has no symposium href"
mutate S2 "$PRES" "['symposium', 'wosa', 'workshops']" "['wosa', 'workshops']" "PROGRAMME_PRODUCTS does not include the symposium"
mutate S3 "$PAGE" '<Link key={session.id} href={session.href} className="nos-pg-session">' \
  '<span key={session.id} className="nos-pg-session">' "does not render the session tile as a link"
mutate S4 "$INDEX" "      '/national-show/symposium'," "" "NosShowIndex.tsx does not list /national-show/symposium"

# Workshops link removed, three ways.
mutate W1 "$PAGE" 'href={WORKSHOPS_HREF} className="nos-pg-later"' 'href="#" className="nos-pg-later"' \
  "lacks the ruled Workshops row"
mutate W2 "$PAGE" "const WORKSHOPS_HREF = '/workshops';" "const WORKSHOPS_UNUSED = '/workshops';" \
  "does not define WORKSHOPS_HREF"
mutate W3 "$INDEX" "      '/national-show/workshops'," "" "NosShowIndex.tsx does not list /national-show/workshops"

# Board and index removed.
mutate B1 "$PAGE" 'data-programme-board=""' "" "does not render the PG-G1 timetable board"
mutate B2 "$PAGE" '<NosShowIndex current="/national-show/programme" />' "" "does not render NosShowIndex"

if [ "$status" -eq 0 ]; then echo "PASS F8-A8: every Symposium/Workshops/board mutation was applied and detected"; fi
exit "$status"
