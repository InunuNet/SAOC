# GHOST-PALINDROME SPEC v1.0

## 1. Goal & Acceptance Criteria

Build a command-line tool and python module `palindrome.py` that verifies if a string is a palindrome and extracts its longest palindromic substring.

## 2. Interface

### CLI Execution
```bash
python3 palindrome.py "<string>"
```

### Output Format
Prints exactly to stdout:
```
"<string>" → palindrome: <True/False> | longest: "<result>"
```

### Exit Codes
- `0`: Successful evaluation
- `1`: Invalid arguments or empty invocation
- `2`: Other errors

## 3. Requirements

1. **`is_palindrome(s: str) -> bool`**
   - Returns `True` if `s` is a palindrome, ignoring casing, spaces, and non-alphanumeric characters.
   - Treats empty string `""` as `True`.
   - Examples:
     - `is_palindrome("A man a plan a canal Panama")` → `True`
     - `is_palindrome("race a car")` → `False`
     - `is_palindrome("")` → `True`

2. **`longest_palindrome(s: str) -> str`**
   - Returns the longest palindromic substring of `s` (using the same alphanumeric matching criteria).
   - If there are multiple palindromic substrings of the same longest length, returning either is valid.
   - Examples:
     - `longest_palindrome("babad")` → `"bab"` or `"aba"`
     - `longest_palindrome("cbbd")` → `"bb"`
     - `longest_palindrome("a")` → `"a"`
     - `longest_palindrome("")` → `""`

3. **Performance Constraints**
   - No external library imports (only Python stdlib allowed).
   - `is_palindrome` must run in $O(n)$ time.
   - `longest_palindrome` must run in $O(n^2)$ time or better.

4. **Edge Cases**
   - Empty string.
   - Single character string.
   - Strings with only spaces or punctuation.
