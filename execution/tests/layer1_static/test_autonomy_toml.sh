#!/usr/bin/env bash
# Layer 1: Verify autonomy.toml has no wildcard toolName and no mixed commandRegex
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_autonomy_toml.sh ==="

TOML=".gemini/policies/autonomy.toml"

assert_file_exists "autonomy.toml exists" "$TOML"

# Check: toolName = "*" must NOT exist (wildcard breaks Gemini API)
if grep -qE 'toolName\s*=\s*"\*"' "$TOML" 2>/dev/null; then
  echo "  FAIL autonomy.toml must not use toolName = \"*\" (wildcard breaks Gemini API)"
  ((FAIL++)); ERRORS+=("no wildcard toolName")
else
  echo "  PASS no wildcard toolName found"
  ((PASS++))
fi

# Check: commandRegex must NOT appear alongside non-shell toolNames
# Strategy: extract any rule block that has commandRegex AND a non-shell toolName
# We do this by checking if commandRegex appears in rules without run_shell_command
if python3 - "$TOML" << 'PYEOF' 2>/dev/null; then
import sys, re

toml_path = sys.argv[1]
try:
    with open(toml_path) as f:
        content = f.read()
except Exception as e:
    print(f"  Cannot read {toml_path}: {e}")
    sys.exit(0)

# Split into rule blocks
blocks = re.split(r'\[\[rule\]\]', content)
bad_blocks = []
for block in blocks[1:]:  # skip preamble
    has_command_regex = 'commandRegex' in block
    has_command_prefix = 'commandPrefix' in block
    if has_command_regex or has_command_prefix:
        # Check if toolName includes non-shell tools
        tool_match = re.search(r'toolName\s*=\s*(.+)', block)
        if tool_match:
            tool_val = tool_match.group(1).strip()
            # Single string
            if '"run_shell_command"' not in tool_val and 'run_shell_command' not in tool_val:
                bad_blocks.append(block[:100].strip())

if bad_blocks:
    print(f"  WARNING: commandRegex/commandPrefix found in non-shell rule blocks:")
    for b in bad_blocks:
        print(f"    {b[:80]}")
    sys.exit(1)
else:
    print("  commandRegex/commandPrefix only used with run_shell_command")
    sys.exit(0)
PYEOF
  ((PASS++))
  echo "  PASS commandRegex not mixed with non-shell tools"
else
  ((FAIL++)); ERRORS+=("commandRegex mixed with non-shell tool")
fi

summary
