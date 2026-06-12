#!/usr/bin/env bash
# run_tests.sh

# Exit on error
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_FILE="$DIR/../palindrome.py"

echo "Running Palindrome tests..."

# Test 1: Empty string
out1=$(python3 "$PYTHON_FILE" "")
if [[ "$out1" != '"" → palindrome: True | longest: ""' ]]; then
    echo "Test 1 failed: $out1"
    exit 1
fi

# Test 2: Standard palindrome with punctuation/casing/spaces
out2=$(python3 "$PYTHON_FILE" "A man a plan a canal Panama")
if [[ "$out2" != '"A man a plan a canal Panama" → palindrome: True | longest: "A man a plan a canal Panama"' ]]; then
    echo "Test 2 failed: $out2"
    exit 1
fi

# Test 3: Non-palindrome with some palindromic substring
out3=$(python3 "$PYTHON_FILE" "babad")
if [[ "$out3" != '"babad" → palindrome: False | longest: "bab"' && "$out3" != '"babad" → palindrome: False | longest: "aba"' ]]; then
    echo "Test 3 failed: $out3"
    exit 1
fi

# Test 4: Another non-palindrome
out4=$(python3 "$PYTHON_FILE" "cbbd")
if [[ "$out4" != '"cbbd" → palindrome: False | longest: "bb"' ]]; then
    echo "Test 4 failed: $out4"
    exit 1
fi

# Test 5: String with spacing/punctuation longest palindrome mapping
out5=$(python3 "$PYTHON_FILE" "race a car")
if [[ "$out5" != '"race a car" → palindrome: False | longest: "a ca"' ]]; then
    echo "Test 5 failed: $out5"
    exit 1
fi

echo "PASS 5/5"
