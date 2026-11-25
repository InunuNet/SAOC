#!/usr/bin/env bash
# Live proof (not in the static gate: it needs a running server). Usage: check-redirect-live.sh PORT
# Old URLs -> 308 to the new URL, one hop, on both hosts, sub-path and query kept.
set -euo pipefail
port="${1:?port required}"
fail=0
probe() { # host path expected-location
  local got
  got=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "Host: $1" "http://127.0.0.1:${port}$2")
  if [ "$got" != "308 $3" ]; then echo "FAIL $1$2 -> $got (want 308 $3)"; fail=1; else echo "PASS $1$2 -> $got"; fi
}
for host in nos.saoc.co.za saoc.co.za; do
  probe "$host" /national-show/award-entries "https://nos.saoc.co.za/plant-entry"
  probe "$host" "/award-entries?x=1" "https://nos.saoc.co.za/plant-entry?x=1"
  probe "$host" /national-show/award-entries/sub/page "https://nos.saoc.co.za/plant-entry/sub/page"
done
probe nos.saoc.co.za /exhibitors "https://nos.saoc.co.za/plant-entry"
exit "$fail"
