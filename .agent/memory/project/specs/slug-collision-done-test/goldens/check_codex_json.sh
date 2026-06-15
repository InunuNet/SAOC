#!/usr/bin/env bash
# Golden: verify template/.agent/providers/codex.json exists and has required keys

FILE="template/.agent/providers/codex.json"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found" >&2; exit 1
fi

# Check provider field
python3 -c "
import json, sys
data = json.loads(open('$FILE').read())
required = {'provider', 'display_name', 'supports_headless', 'supports_hooks', 'supports_subagents', 'supports_max_turns', 'supports_max_tokens', 'token_accounting'}
missing = required - set(data.keys())
if missing:
    print('FAIL: missing keys:', ', '.join(sorted(missing)), file=sys.stderr)
    sys.exit(1)
if data.get('provider') != 'codex':
    print('FAIL: provider field is not codex, got:', data.get('provider'), file=sys.stderr)
    sys.exit(1)
print('PASS: codex.json has all required keys and correct provider field')
" || exit 1

exit 0
