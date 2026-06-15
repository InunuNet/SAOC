#!/usr/bin/env bash
# Golden: verify template/execution/mission.py has the cross-date slug scan

FILE="template/execution/mission.py"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found" >&2; exit 1
fi

# Check for the glob scan pattern
grep -q "MISSIONS_DIR.glob" "$FILE" || { echo "FAIL: missing MISSIONS_DIR.glob pattern in $FILE" >&2; exit 1; }

# Check for the done/abandoned/close_out check
grep -q '"done", "abandoned", "close_out"' "$FILE" || { echo "FAIL: missing status set check in $FILE" >&2; exit 1; }

# Check for the sys.exit(1) error path
grep -q "Resume that mission instead" "$FILE" || { echo "FAIL: missing error path in $FILE" >&2; exit 1; }

echo "PASS: template/execution/mission.py has cross-date slug scan"
exit 0
