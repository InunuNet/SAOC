#!/usr/bin/env bash
# verify_browser_qa_fixture.sh -- proves execution/browser_qa.py can actually
# launch a headless browser, load a real running page, and capture evidence.
# Not a mock: serves a real static file over a real local HTTP server.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/execution/checks/fixtures"
SCREENSHOT="$(mktemp -t browser_qa_fixture_XXXXXX).png"
PORT=8971

cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$SCREENSHOT"
}
trap cleanup EXIT

(cd "$FIXTURE_DIR" && python3 -m http.server "$PORT" >/dev/null 2>&1) &
SERVER_PID=$!
sleep 1

python3 "$REPO_ROOT/execution/browser_qa.py" \
  --url "http://localhost:$PORT/browser_qa_sample.html" \
  --screenshot "$SCREENSHOT" \
  --assert-text "browser-qa-fixture-ok"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  echo "FAIL: browser_qa.py exited $STATUS against the fixture page"
  exit 1
fi

if [ ! -s "$SCREENSHOT" ]; then
  echo "FAIL: no screenshot was written to $SCREENSHOT"
  exit 1
fi

echo "PASS: browser_qa.py loaded the fixture, matched text, wrote a screenshot"
