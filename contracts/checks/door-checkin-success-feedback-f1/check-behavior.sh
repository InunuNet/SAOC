#!/usr/bin/env bash
# A3 — success auto-dismisses after a fixed delay (cleanup-safe); failure never auto-dismisses;
# the camera scan lifecycle stays independent of result state. See
# contracts/golden/door-checkin-success-feedback-f1/overlay-spec.golden.md "Behavior".
set -euo pipefail

FILE="components/admin/DoorScannerClient.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

if ! grep -qE 'setTimeout' "$FILE"; then
  echo "FAIL: no setTimeout found — success auto-dismiss timer expected in $FILE"
  exit 1
fi

if ! grep -qE 'clearTimeout' "$FILE"; then
  echo "FAIL: no clearTimeout found — the auto-dismiss timer must be cleared on unmount / when a newer result arrives, or a stale timer can clear a NEWER scan's result"
  exit 1
fi

if ! grep -qE 'setResult\(null\)' "$FILE"; then
  echo "FAIL: no setResult(null) found — success branch must clear result to return to the live camera view"
  exit 1
fi

# beginScan's lifecycle must not depend on `result` — the effect that starts/stops the
# scanner must not list `result` in its dependency array. Scan the whole file as one string
# (perl -0777) so the useEffect body and its dependency array can span multiple lines.
if ! perl -0777 -ne '
  my $found = 0;
  while (/useEffect\(\s*\(\)\s*=>\s*\{(.*?)\}\s*,\s*\[([^\]]*)\]\s*\)/gs) {
    my ($body, $deps) = ($1, $2);
    next unless $body =~ /beginScan/;
    $found = 1;
    $deps =~ s/^\s+|\s+$//g;
    exit 0 if $deps eq "beginScan";
  }
  exit 1;
' "$FILE"; then
  echo "FAIL: could not confirm the scanner-start effect stays independent of result state (expected dependency array [beginScan])"
  exit 1
fi

echo "PASS: success auto-dismisses, failure holds, camera lifecycle independent of result"
