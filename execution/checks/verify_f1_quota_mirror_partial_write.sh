#!/usr/bin/env bash
# verify_f1_quota_mirror_partial_write.sh — assertions A1-A8 for
# .agent/memory/project/specs/quota-mirror-partial-write/contract-f1.yaml
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/execution/hooks/inject_pressure.sh"
QUOTA="$REPO_ROOT/execution/quota.py"

_tmpdir=""
_cleanup() { [ -n "$_tmpdir" ] && rm -rf "$_tmpdir"; }
trap _cleanup EXIT

_mktmp() {
  _tmpdir="$(mktemp -d /tmp/f1-quota-mirror.XXXXXX)"
}

_run_hook() {
  # $1 = cache json content, $2 = mirror output path
  local cache_file="$_tmpdir/usage-cache.json"
  printf '%s' "$1" > "$cache_file"
  echo '{}' | ATHANOR_QUOTA_CACHE_OVERRIDE="$cache_file" ATHANOR_QUOTA_MIRROR_OVERRIDE="$2" bash "$HOOK" >/dev/null
}

case "${1:-}" in

partial_write_on_missing_resets_at)
  _mktmp
  mirror="$_tmpdir/mirror.json"
  cache='{"five_hour":{"utilization":42}}'
  _run_hook "$cache" "$mirror"
  if [ ! -f "$mirror" ]; then
    echo "FAIL: mirror file was not written"; exit 1
  fi
  out=$(python3 -c "
import json
d = json.load(open('$mirror'))
assert d['used_pct'] == 42, d
assert d['resets_at'] is None, d
assert d['seconds_to_reset'] is None, d
assert isinstance(d['captured_at'], str) and d['captured_at'], d
assert set(d.keys()) == {'used_pct','resets_at','seconds_to_reset','captured_at'}, d
print('OK')
")
  [ "$out" = "OK" ] || { echo "FAIL: partial shape mismatch: $out"; exit 1; }
  echo "PASS: partial_write_on_missing_resets_at"
  ;;

full_write_unchanged_when_resets_at_present)
  _mktmp
  mirror="$_tmpdir/mirror.json"
  resets="$(python3 -c "import datetime; print((datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=3)).isoformat())")"
  cache=$(python3 -c "import json; print(json.dumps({'five_hour':{'utilization':42,'resets_at':'$resets'}}))")
  _run_hook "$cache" "$mirror"
  if [ ! -f "$mirror" ]; then
    echo "FAIL: mirror file was not written"; exit 1
  fi
  out=$(python3 -c "
import json
d = json.load(open('$mirror'))
assert d['used_pct'] == 42, d
assert d['resets_at'] is not None, d
assert d['seconds_to_reset'] is not None, d
assert isinstance(d['seconds_to_reset'], float), d
print('OK')
")
  [ "$out" = "OK" ] || { echo "FAIL: full shape mismatch: $out"; exit 1; }
  echo "PASS: full_write_unchanged_when_resets_at_present"
  ;;

no_write_when_q_pct_not_numeric)
  _mktmp
  mirror="$_tmpdir/mirror.json"
  resets="$(python3 -c "import datetime; print((datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=3)).isoformat())")"
  cache=$(python3 -c "import json; print(json.dumps({'five_hour':{'utilization':None,'resets_at':'$resets'}}))")
  _run_hook "$cache" "$mirror"
  if [ -f "$mirror" ]; then
    echo "FAIL: mirror file was written even though Q_PCT was not numeric"; exit 1
  fi
  echo "PASS: no_write_when_q_pct_not_numeric"
  ;;

partial_status_json_shape)
  _mktmp
  mirror="$_tmpdir/mirror.json"
  cache='{"five_hour":{"utilization":42}}'
  _run_hook "$cache" "$mirror"
  out=$(python3 "$QUOTA" status --json --mirror-path "$mirror")
  echo "$out" | python3 -c "
import json, sys
d = json.loads(sys.stdin.read())
assert d['schema'] == 'athanor.quota/v1', d
assert d['state'] == 'partial', d
assert d['used_pct'] == 42, d
assert d['resets_at'] is None, d
assert d['seconds_to_reset'] is None, d
assert d['reason'] is None, d
assert isinstance(d['age_seconds'], float) and d['age_seconds'] >= 0, d
print('OK')
" || { echo "FAIL: json shape mismatch: $out"; exit 1; }
  echo "PASS: partial_status_json_shape"
  ;;

partial_status_text_format)
  _mktmp
  mirror="$_tmpdir/mirror.json"
  cache='{"five_hour":{"utilization":42}}'
  _run_hook "$cache" "$mirror"
  out=$(python3 "$QUOTA" status --mirror-path "$mirror")
  expected="quota: state=partial used=42% resets_in=unknown"
  if [ "$out" != "$expected" ]; then
    echo "FAIL: expected [$expected] got [$out]"; exit 1
  fi
  echo "PASS: partial_status_text_format"
  ;;

stale_partial_degrades_to_unknown)
  _mktmp
  mirror="$_tmpdir/mirror.json"
  old_ts="$(python3 -c "import datetime; print((datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(seconds=901)).isoformat())")"
  python3 -c "
import json
d = {'used_pct': 42, 'resets_at': None, 'seconds_to_reset': None, 'captured_at': '$old_ts'}
json.dump(d, open('$mirror', 'w'))
"
  out=$(python3 "$QUOTA" status --json --mirror-path "$mirror")
  echo "$out" | python3 -c "
import json, sys
d = json.loads(sys.stdin.read())
assert d['state'] == 'unknown', d
assert d['reason'] == 'stale', d
print('OK')
" || { echo "FAIL: stale partial not degraded: $out"; exit 1; }
  echo "PASS: stale_partial_degrades_to_unknown"
  ;;

mismatched_pair_is_malformed_not_partial)
  fixture="$REPO_ROOT/.agent/memory/project/specs/quota-mirror-partial-write/goldens/f1_malformed_mismatch_fixture.json"
  out=$(python3 "$QUOTA" status --json --mirror-path "$fixture")
  echo "$out" | python3 -c "
import json, sys
d = json.loads(sys.stdin.read())
assert d['state'] == 'unknown', d
assert d['reason'] == 'malformed', d
print('OK')
" || { echo "FAIL: mismatched pair not classified as malformed: $out"; exit 1; }
  echo "PASS: mismatched_pair_is_malformed_not_partial"
  ;;

existing_ok_fixture_unaffected)
  _mktmp
  mirror="$_tmpdir/mirror.json"
  fresh_ts="$(python3 -c "import datetime; print(datetime.datetime.now(datetime.timezone.utc).isoformat())")"
  resets_ts="$(python3 -c "import datetime; print((datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=3,minutes=30)).isoformat())")"
  python3 -c "
import json
d = {'used_pct': 42, 'resets_at': '$resets_ts', 'seconds_to_reset': 12600.0, 'captured_at': '$fresh_ts'}
json.dump(d, open('$mirror', 'w'))
"
  out=$(python3 "$QUOTA" status --json --mirror-path "$mirror")
  echo "$out" | python3 -c "
import json, sys
d = json.loads(sys.stdin.read())
assert d['state'] == 'ok', d
assert d['used_pct'] == 42, d
assert d['reason'] is None, d
print('OK')
" || { echo "FAIL: existing ok fixture regressed: $out"; exit 1; }
  echo "PASS: existing_ok_fixture_unaffected"
  ;;

*)
  echo "usage: $0 {partial_write_on_missing_resets_at|full_write_unchanged_when_resets_at_present|no_write_when_q_pct_not_numeric|partial_status_json_shape|partial_status_text_format|stale_partial_degrades_to_unknown|mismatched_pair_is_malformed_not_partial|existing_ok_fixture_unaffected}" >&2
  exit 2
  ;;
esac
