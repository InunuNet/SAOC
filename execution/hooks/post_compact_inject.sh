#!/usr/bin/env bash
# post_compact_inject.sh — UserPromptSubmit command hook.
# Companion to post_compact_restore.sh. If a queued post-compact context flag exists,
# inject it as additionalContext on the next user turn and delete the flag.
# If the flag is absent, emit an empty JSON object and exit 0 (no-op).
set -uo pipefail
FLAG=".agent/memory/scratch/.post_compact_context.txt"
if [ -f "$FLAG" ]; then
  python3 - "$FLAG" <<'PYEOF'
import json, sys, pathlib
content = pathlib.Path(sys.argv[1]).read_text()
pathlib.Path(sys.argv[1]).unlink()
print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": content}}))
PYEOF
else
  echo "{}"
fi
