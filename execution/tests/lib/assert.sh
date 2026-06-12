#!/usr/bin/env bash
# Shared assertion helpers. Source this in each test.
PASS=0; FAIL=0; ERRORS=()
assert_exit() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo "  PASS $desc (exit $actual)"
    ((PASS++))
  else
    echo "  FAIL $desc (expected exit $expected, got $actual)"
    ((FAIL++)); ERRORS+=("$desc")
  fi
}
assert_output_contains() {
  local desc="$1" pattern="$2" output="$3"
  if echo "$output" | grep -q "$pattern"; then
    echo "  PASS $desc"
    ((PASS++))
  else
    echo "  FAIL $desc (pattern '$pattern' not found)"
    ((FAIL++)); ERRORS+=("$desc")
  fi
}
assert_output_not_contains() {
  local desc="$1" pattern="$2" output="$3"
  if echo "$output" | grep -q "$pattern"; then
    echo "  FAIL $desc (pattern '$pattern' found but should not be)"
    ((FAIL++)); ERRORS+=("$desc")
  else
    echo "  PASS $desc"
    ((PASS++))
  fi
}
assert_file_exists() {
  local desc="$1" path="$2"
  if [ -f "$path" ]; then
    echo "  PASS $desc"
    ((PASS++))
  else
    echo "  FAIL $desc (file not found: $path)"
    ((FAIL++)); ERRORS+=("$desc")
  fi
}
assert_dir_exists() {
  local desc="$1" path="$2"
  if [ -d "$path" ]; then
    echo "  PASS $desc"
    ((PASS++))
  else
    echo "  FAIL $desc (dir not found: $path)"
    ((FAIL++)); ERRORS+=("$desc")
  fi
}
summary() {
  echo ""
  echo "----------------------------"
  echo "Results: $PASS passed, $FAIL failed"
  if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "Failures:"
    for e in "${ERRORS[@]}"; do echo "  - $e"; done
  fi
  [ "$FAIL" -eq 0 ]  # exit 0 if all pass
}
