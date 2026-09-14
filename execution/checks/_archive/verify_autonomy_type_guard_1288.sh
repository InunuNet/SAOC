#!/usr/bin/env bash
# verify_autonomy_type_guard_1288.sh -- golden-file behavioral check for GitHub issue #1288.
#
# Bug: execution/update_template.py's update_profile_version() (and its identical twin in
# template/execution/update_template.py, the canonical upstream source every downstream
# project's `make update-template` / `make self-update` pulls FROM) seeds autonomy.level via:
#   if not profile.get("autonomy", {}).get("level"):
# This assumes profile["autonomy"], when the key IS present, is always a dict. `.get(key,
# default)` only substitutes `default` when the key is ABSENT -- not when the stored value is
# some other JSON type (a string, a number, JSON null, etc). If profile.json's "autonomy" key
# holds a non-dict value (corrupted by hand-editing or a bad merge), `.get("level")` is called
# on that non-dict, e.g. a str or None, and raises AttributeError, crashing the whole
# `--apply` run instead of degrading gracefully to "no valid autonomy level set" (the same
# outcome as the already-correct missing-key case).
#
# Fix contract (locked detection convention -- the dev implementation MUST match this exact
# logic or these goldens will not pass):
#   autonomy = profile.get("autonomy")
#   if not (isinstance(autonomy, dict) and autonomy.get("level")):
#       ... existing seed logic unchanged ...
# The isinstance guard must come FIRST (short-circuiting) so .get("level") is only ever called
# once autonomy is confirmed to be a dict. A non-dict or None autonomy value must be treated
# exactly like an absent key: seed a fresh level (from autonomy_matrix.json's
# onboarding_default, falling back to "medium" on any read error) into profile["autonomy"],
# replacing the invalid value with a fresh dict -- never crash, never leave the invalid value
# in place uncorrected.
#
# This script drives the REAL execution/update_template.py update_profile_version() path
# (python3 update_template.py --source "$SRC" --apply) against isolated fixture directories,
# same convention as execution/checks/verify_version_sync_1285.sh, so no real repo state is
# touched.
#
# Usage: verify_autonomy_type_guard_1288.sh <case> [--template]
#   valid_dict_level_set   - GOLDEN / regression guard: autonomy is a valid dict and already
#                             has a truthy "level" set (e.g. "high"). Must be left COMPLETELY
#                             unchanged -- no reseed, no log line, no crash. PASSES both before
#                             and after the fix (existing correct behavior, must not regress).
#   valid_dict_no_level    - GOLDEN / regression guard: autonomy is a valid dict but has no
#                             "level" key (or a falsy one). Must be seeded with a fresh level
#                             from autonomy_matrix.json's onboarding_default, exactly as today.
#                             PASSES both before and after the fix.
#   key_absent             - GOLDEN / regression guard: the "autonomy" key is absent from
#                             profile.json entirely. Must be seeded fresh, exactly as today
#                             (profile.setdefault("autonomy", {})["level"] = seed_level).
#                             PASSES both before and after the fix.
#   non_dict_string         - GOLDEN / bug reproduction: autonomy is a non-dict value, a bare
#                             JSON string (e.g. "high", a plausible hand-edit mistake -- typing
#                             the level directly instead of nesting it under a level key).
#                             Must NOT crash; must degrade gracefully, seeding a fresh dict with
#                             a valid level, same as the absent-key case. Currently FAILS
#                             (AttributeError: 'str' object has no attribute 'get', unhandled --
#                             process exits non-zero / prints Traceback) -- must PASS after fix.
#   null_explicit           - GOLDEN / bug reproduction, distinct from non_dict_string: the
#                             "autonomy" key is present with an explicit JSON null value (key
#                             present, value None) -- distinct from key_absent, since
#                             .get(key, default) only substitutes default when the key is
#                             ABSENT, not when the stored value is None. Must NOT crash; must
#                             degrade gracefully identically to the absent-key case. Currently
#                             FAILS (AttributeError: 'NoneType' object has no attribute 'get')
#                             -- must PASS after fix.
#
# Pass --template as a second argument to run the identical case against
# template/execution/update_template.py instead of execution/update_template.py (the canonical
# upstream copy every downstream project's update_template.py is refreshed from -- confirmed
# to carry the identical unguarded `.get("autonomy", {}).get("level")` line and therefore in
# scope for the identical fix + identical golden coverage).
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"
VARIANT="${2:-}"

if [ "$VARIANT" = "--template" ]; then
  TARGET="$REPO_ROOT/template/execution/update_template.py"
else
  TARGET="$REPO_ROOT/execution/update_template.py"
fi

if [ ! -f "$TARGET" ]; then
  echo "FAIL: target script not found: $TARGET" >&2
  exit 1
fi

WS="$(mktemp -d)"
SRC="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" "$SRC" 2>/dev/null || true; }
trap cleanup EXIT

mkdir -p "$WS/.agent"
printf 'paths: []\n' > "$WS/.agent/update-manifest.yaml"
printf 'GoldenFixtureProject-1288\n' > "$WS/WORKSPACE"
printf '1.2.3' > "$WS/.agent/version"

mkdir -p "$SRC/.agent"
printf '1.2.3' > "$SRC/.agent/version"

# autonomy_matrix.json is resolved relative to the WORKSPACE (profile_path.parent.parent),
# independent of --source, per the real code: profile_path.parent.parent / ".agent" /
# "autonomy_matrix.json". Seed a deterministic onboarding_default so the golden level value
# is stable and asserted below.
cat > "$WS/.agent/autonomy_matrix.json" <<'JSON'
{"onboarding_default": "golden-seeded-level"}
JSON

write_profile() {
  # $1 = raw JSON fragment for the "autonomy" field's VALUE (or the special marker
  # ABSENT to omit the key entirely).
  local autonomy_json="$1"
  if [ "$autonomy_json" = "ABSENT" ]; then
    cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1288", "template_version": "1.2.3"}
JSON
  else
    python3 -c "
import json, sys
autonomy_value = json.loads(sys.argv[1])
data = {'project_name': 'GoldenFixtureProject-1288', 'template_version': '1.2.3', 'autonomy': autonomy_value}
json.dump(data, open('$WS/.agent/profile.json', 'w'), indent=2)
" "$autonomy_json"
  fi
}

case "$CASE" in
  valid_dict_level_set)
    write_profile '{"level": "high", "custom_marker": "keep-me"}'
    ;;
  valid_dict_no_level)
    write_profile '{"custom_marker": "keep-me"}'
    ;;
  key_absent)
    write_profile 'ABSENT'
    ;;
  non_dict_string)
    write_profile '"high"'
    ;;
  null_explicit)
    write_profile 'null'
    ;;
  *)
    echo "FAIL: unknown case '$CASE' (expected valid_dict_level_set|valid_dict_no_level|key_absent|non_dict_string|null_explicit)" >&2
    exit 1
    ;;
esac

BEFORE_JSON="$(cat "$WS/.agent/profile.json")"

OUT="$(cd "$WS" && python3 "$TARGET" --source "$SRC" --apply 2>&1)"
RC=$?

AFTER_JSON=""
[ -f "$WS/.agent/profile.json" ] && AFTER_JSON="$(cat "$WS/.agent/profile.json")"

case "$CASE" in
  valid_dict_level_set)
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: update_template.py exited $RC for case '$CASE'" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if [ "$AFTER_JSON" != "$BEFORE_JSON" ]; then
      echo "FAIL: valid_dict_level_set case -- profile.json changed even though autonomy already had a valid dict with a truthy level set (must be a byte-for-byte no-op for the autonomy field)" >&2
      echo "--- before ---" >&2; echo "$BEFORE_JSON" >&2
      echo "--- after ---" >&2; echo "$AFTER_JSON" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qi "autonomy.level: seeded"; then
      echo "FAIL: valid_dict_level_set case -- spurious 'autonomy.level: seeded' log line emitted even though a valid level was already set" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: valid_dict_level_set case -- valid dict with existing level left untouched, no reseed, no crash"
    ;;
  valid_dict_no_level)
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: update_template.py exited $RC for case '$CASE'" >&2
      echo "$OUT" >&2
      exit 1
    fi
    LEVEL="$(python3 -c "import json; print(json.load(open('$WS/.agent/profile.json')).get('autonomy', {}).get('level',''))")"
    if [ "$LEVEL" != "golden-seeded-level" ]; then
      echo "FAIL: valid_dict_no_level case -- expected autonomy.level seeded as 'golden-seeded-level', got '$LEVEL'" >&2
      exit 1
    fi
    MARKER="$(python3 -c "import json; print(json.load(open('$WS/.agent/profile.json')).get('autonomy', {}).get('custom_marker',''))")"
    if [ "$MARKER" != "keep-me" ]; then
      echo "FAIL: valid_dict_no_level case -- pre-existing sibling key 'custom_marker' in the autonomy dict was lost (must be preserved, only 'level' is added)" >&2
      exit 1
    fi
    echo "PASS: valid_dict_no_level case -- level seeded, sibling dict keys preserved, no crash"
    ;;
  key_absent)
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: update_template.py exited $RC for case '$CASE'" >&2
      echo "$OUT" >&2
      exit 1
    fi
    LEVEL="$(python3 -c "import json; print(json.load(open('$WS/.agent/profile.json')).get('autonomy', {}).get('level',''))")"
    if [ "$LEVEL" != "golden-seeded-level" ]; then
      echo "FAIL: key_absent case -- expected autonomy.level seeded as 'golden-seeded-level', got '$LEVEL'" >&2
      exit 1
    fi
    echo "PASS: key_absent case -- missing autonomy key seeded fresh, no crash (existing correct behavior, unaffected by fix)"
    ;;
  non_dict_string)
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: non_dict_string case -- update_template.py CRASHED (exit $RC) instead of degrading gracefully when autonomy is a bare non-dict string. This is the headline bug from issue #1288 (.get('autonomy', {}).get('level') assumes a present autonomy key is always a dict; 'str' object has no attribute 'get')." >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qi "Traceback"; then
      echo "FAIL: non_dict_string case -- unhandled Traceback printed even though rc=0" >&2
      echo "$OUT" >&2
      exit 1
    fi
    LEVEL="$(python3 -c "import json; print(json.load(open('$WS/.agent/profile.json')).get('autonomy', {}).get('level',''))" 2>/dev/null)"
    if [ "$LEVEL" != "golden-seeded-level" ]; then
      echo "FAIL: non_dict_string case -- expected autonomy to be replaced with a fresh dict seeded as 'golden-seeded-level' (graceful degradation, same as key_absent), got autonomy.level='$LEVEL'" >&2
      exit 1
    fi
    echo "PASS: non_dict_string case -- non-dict autonomy value ('high' as a bare string) did not crash, degraded gracefully to a freshly-seeded dict"
    ;;
  null_explicit)
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: null_explicit case -- update_template.py CRASHED (exit $RC) instead of degrading gracefully when autonomy is explicit JSON null. This is distinct from non_dict_string: .get(key, default) only substitutes default when the KEY IS ABSENT, not when the stored value is None ('NoneType' object has no attribute 'get')." >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qi "Traceback"; then
      echo "FAIL: null_explicit case -- unhandled Traceback printed even though rc=0" >&2
      echo "$OUT" >&2
      exit 1
    fi
    LEVEL="$(python3 -c "import json; print(json.load(open('$WS/.agent/profile.json')).get('autonomy', {}).get('level',''))" 2>/dev/null)"
    if [ "$LEVEL" != "golden-seeded-level" ]; then
      echo "FAIL: null_explicit case -- expected autonomy to be replaced with a fresh dict seeded as 'golden-seeded-level' (graceful degradation, same as key_absent), got autonomy.level='$LEVEL'" >&2
      exit 1
    fi
    echo "PASS: null_explicit case -- explicit JSON null autonomy value did not crash, degraded gracefully to a freshly-seeded dict"
    ;;
esac
