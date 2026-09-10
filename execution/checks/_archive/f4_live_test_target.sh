#!/usr/bin/env bash
# f4_live_test_target.sh — validates every *.json file under .agent/providers/
# parses as valid JSON. Small, self-contained utility used as a neutral
# review subject for a live cross-model QA test.
set -u

PROVIDERS_DIR=".agent/providers"
exit_code=0
found_any=0

if [ ! -d "$PROVIDERS_DIR" ]; then
    echo "FAIL: directory not found: ${PROVIDERS_DIR}"
    exit 1
fi

for f in "$PROVIDERS_DIR"/*.json; do
    [ -e "$f" ] || continue
    found_any=1
    if python3 -m json.tool "$f" >/dev/null 2>&1; then
        echo "OK: $f"
    else
        echo "FAIL: $f"
        exit_code=1
    fi
done

if [ "$found_any" -eq 0 ]; then
    echo "FAIL: no *.json files found under ${PROVIDERS_DIR}"
    exit 1
fi

exit "$exit_code"
