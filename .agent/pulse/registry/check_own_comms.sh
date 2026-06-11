#!/usr/bin/env bash
# Athanor Pulse job: watch own comms.md file for new responses from the maintainer.
# If a new response is found, output an alert to the inbox so it gets ingested.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LOCK_DIR="$PROJECT_ROOT/.agent/pulse/registry/processing"
mkdir -p "$LOCK_DIR"

COMMS="$PROJECT_ROOT/comms.md"
[ -f "$COMMS" ] || exit 0

# Extract lines from "Incoming Responses (From Maintainer)" section
IN_RESPONSES_SECTION=false
while IFS= read -r line; do
  if [[ "$line" == *"### Incoming Responses (From Maintainer)"* ]]; then
    IN_RESPONSES_SECTION=true
    continue
  fi
  if [ "$IN_RESPONSES_SECTION" = true ]; then
    # If we hit another header, stop parsing
    if [[ "$line" =~ ^# ]]; then
      break
    fi
    trimmed=$(echo "$line" | xargs)
    [ -z "$trimmed" ] && continue
    [[ "$trimmed" == *"No responses yet"* ]] && continue
    
    # Calculate signature to avoid duplicate alerts
    SIG=$(echo "$trimmed" | md5 2>/dev/null || echo "$trimmed" | md5sum | cut -d' ' -f1)
    LOCK="$LOCK_DIR/comms-response-$SIG.lock"
    if [ ! -f "$LOCK" ]; then
      touch "$LOCK"
      echo "New response from maintainer: $trimmed"
    fi
  fi
done < "$COMMS"
