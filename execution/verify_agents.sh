#!/usr/bin/env bash
# verify_agents.sh — Verify all 8 Athanor Claude Code agents are present and structurally valid.
# Non-interactive, idempotent, no side effects, no disk writes.
# Exits 0 if all 8 pass checks 1-8. Exits 1 if any fail.
# Check #9 (dispatch smoke test) is advisory only — never fatal.
#
# Dependencies: bash, grep, sed, awk, python3 (PyYAML optional — warning if missing).
#
# Usage: bash execution/verify_agents.sh

set -euo pipefail

AGENTS=(lead analyst architect dev qa docs maintainer designer)
CLAUDE_DIR=".claude/agents"

# Color support only when stdout is a TTY
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  RESET='\033[0m'
else
  GREEN=''
  RED=''
  YELLOW=''
  RESET=''
fi

# Check if PyYAML is available (optional)
HAS_PYYAML=false
if python3 -c "import yaml" 2>/dev/null; then
  HAS_PYYAML=true
fi

# Check if claude CLI is available (for advisory dispatch check)
HAS_CLAUDE=false
if command -v claude >/dev/null 2>&1; then
  HAS_CLAUDE=true
fi

# Capture claude agents output once if available
CLAUDE_AGENTS_OUTPUT=""
if $HAS_CLAUDE; then
  CLAUDE_AGENTS_OUTPUT=$(claude agents 2>/dev/null | cat 2>/dev/null || true)
fi

pass_count=0
fail_count=0
failed_agents=()
failed_reasons=()

for name in "${AGENTS[@]}"; do
  file="$CLAUDE_DIR/${name}.md"
  fail_reason=""
  dispatch_note=""
  model_val=""
  tools_val=""

  # Check #1: file exists
  if [ ! -f "$file" ]; then
    fail_reason="MISSING: $file"
  else
    # Extract frontmatter (lines 1..N until second ---)
    first_line=$(head -1 "$file")

    # Check #2: starts with ---
    if [ "$first_line" != "---" ]; then
      [ -z "$fail_reason" ] && fail_reason="NO_FRONTMATTER: $name"
    fi

    # Check #3: has closing --- in lines 2-30
    if [ -z "$fail_reason" ]; then
      closing=$(awk 'NR>1 && NR<=30 && /^---$/{found=1; exit} END{print found+0}' "$file")
      if [ "$closing" -eq 0 ]; then
        fail_reason="UNCLOSED_FRONTMATTER: $name"
      fi
    fi

    # Extract frontmatter block (between first and second ---)
    if [ -z "$fail_reason" ]; then
      fm=$(awk 'BEGIN{n=0} /^---$/{n++; if(n==2) exit} n==1 && !/^---$/{print}' "$file")

      # Check #4: name: <name> matches filename stem
      fm_name=$(echo "$fm" | grep '^name:' | sed 's/^name:[[:space:]]*//' | tr -d '"'"'" | head -1 || true)
      if [ "$fm_name" != "$name" ]; then
        fail_reason="NAME_MISMATCH: $name (frontmatter says '${fm_name}')"
      fi

      # Check #5: non-empty description:
      if [ -z "$fail_reason" ]; then
        fm_desc=$(echo "$fm" | grep '^description:' | sed 's/^description:[[:space:]]*//' | head -1 || true)
        if [ -z "$fm_desc" ]; then
          fail_reason="NO_DESCRIPTION: $name"
        fi
      fi

      # Check #6: model value (if present) is valid
      if [ -z "$fail_reason" ]; then
        model_val=$(echo "$fm" | grep '^model:' | sed 's/^model:[[:space:]]*//' | head -1 || true)
        if [ -n "$model_val" ]; then
          case "$model_val" in
            sonnet|opus|haiku|claude-*) : ;; # valid
            *) fail_reason="BAD_MODEL: $name (=$model_val)" ;;
          esac
        fi
      fi

      # Check #7: body (after closing ---) is non-empty
      if [ -z "$fail_reason" ]; then
        body=$(awk 'BEGIN{n=0} /^---$/{n++; if(n==2){found=1; next}} found{print}' "$file")
        body_trimmed=$(echo "$body" | tr -d '[:space:]')
        if [ -z "$body_trimmed" ]; then
          fail_reason="EMPTY_BODY: $name"
        fi
      fi

      # Check #8: YAML parses cleanly (advisory if PyYAML missing)
      if [ -z "$fail_reason" ]; then
        if $HAS_PYYAML; then
          # Extract frontmatter content only (no --- delimiters) for yaml parsing
          fm_content=$(awk 'BEGIN{n=0} /^---$/{n++; next} n==1{print} n==2{exit}' "$file")
          if ! echo "$fm_content" | python3 -c "import yaml,sys; yaml.safe_load(sys.stdin)" 2>/dev/null; then
            fail_reason="BAD_YAML: $name"
          fi
        else
          # PyYAML not available — skip with warning (not failure)
          tools_val="(yaml-check:skipped-no-pyyaml)"
        fi
      fi

      # Collect display info
      if [ -z "$model_val" ]; then model_val="(unset)"; fi
      tools_line=$(echo "$fm" | grep -E '^(allowedTools|tools):' | head -1 | sed 's/^[^:]*:[[:space:]]*//' || true)
      tools_val="$tools_line"
    fi
  fi

  # Check #9: advisory dispatch smoke test
  if $HAS_CLAUDE && [ -n "$CLAUDE_AGENTS_OUTPUT" ]; then
    if echo "$CLAUDE_AGENTS_OUTPUT" | grep -q "$name"; then
      dispatch_note=" (dispatch:ok)"
    else
      dispatch_note=" (dispatch:?)"
    fi
  fi

  # Print result
  if [ -z "$fail_reason" ]; then
    pass_count=$((pass_count + 1))
    printf "${GREEN}PASS${RESET}  %-12s (model=%s, tools=%s)%s\n" "$name" "$model_val" "$tools_val" "$dispatch_note"
  else
    fail_count=$((fail_count + 1))
    failed_agents+=("$name")
    failed_reasons+=("$fail_reason")
    printf "${RED}FAIL${RESET}  %-12s %s\n" "$name" "$fail_reason"
  fi

done

# Summary
echo "─────────────────────────────────────────"
total=${#AGENTS[@]}
if [ "$fail_count" -eq 0 ]; then
  printf "${GREEN}verify-agents: %d/%d PASS  (0 failed)${RESET}\n" "$pass_count" "$total"
  if ! $HAS_PYYAML; then
    printf "${YELLOW}WARNING: PyYAML not installed — YAML validation (check #8) was skipped for all agents.${RESET}\n"
  fi
  exit 0
else
  printf "${RED}verify-agents: %d/%d PASS  (%d failed)${RESET}\n" "$pass_count" "$total" "$fail_count"
  for i in "${!failed_agents[@]}"; do
    printf "  - %s:  %s\n" "${failed_agents[$i]}" "${failed_reasons[$i]}"
  done
  if ! $HAS_PYYAML; then
    printf "${YELLOW}WARNING: PyYAML not installed — YAML validation (check #8) was skipped for all agents.${RESET}\n"
  fi
  exit 1
fi
