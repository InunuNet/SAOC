# Ghost-Palindrome Module

A command-line tool and Python module that evaluates whether a given string is a palindrome and extracts its longest palindromic substring.

## Features
- **Case, Space, and Punctuation Insensitivity**: Check for palindromes while ignoring capitalization, spaces, and other non-alphanumeric characters.
- **Longest Palindromic Substring**: Extract the longest palindromic substring, returning the original substring format (with spacing/punctuation preserved).
- **Time Complexity Constraints**:
  - Palindrome check: $O(n)$
  - Longest substring: $O(n^2)$ or better

## Installation & Requirements
- No external library dependencies.
- Compatible with Python 3.

## Usage

### Command-Line Interface (CLI)
Invoke the script from the command line, passing the target string as the first argument:
```bash
python3 palindrome.py "<string>"
```

**Example:**
```bash
python3 palindrome.py "A man a plan a canal Panama"
```
**Output:**
```
"A man a plan a canal Panama" → palindrome: True | longest: "A man a plan a canal Panama"
```

### Exit Codes
- `0`: Evaluation succeeded
- `1`: Invalid arguments or empty invocation
- `2`: Other execution errors

### Import as a Module
Import functions directly in Python scripts:
```python
from palindrome import is_palindrome, longest_palindrome

print(is_palindrome("race a car")) # False
print(longest_palindrome("babad")) # "bab" or "aba"
```
