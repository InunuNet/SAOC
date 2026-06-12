#!/usr/bin/env python3
import sys

def is_palindrome(s: str) -> bool:
    # Filter: ignore case, spaces, and non-alphanumeric
    filtered = [char.lower() for char in s if char.isalnum()]
    # Check if palindrome in O(n)
    left, right = 0, len(filtered) - 1
    while left < right:
        if filtered[left] != filtered[right]:
            return False
        left += 1
        right -= 1
    return True

def longest_palindrome(s: str) -> str:
    # Returns the longest palindromic substring of s
    # We will find the longest palindromic substring.
    # Note: the palindromic substring is based on the original substring of s,
    # but the evaluation of palindromic check ignores case, spaces, and non-alphanumeric.
    # Wait, let's re-read the spec:
    # "Returns the longest palindromic substring of s (using the same alphanumeric matching criteria)."
    # Does "palindromic substring of s" mean a substring of s (which may contain spaces and punctuation)
    # or does it mean a filtered substring?
    # Let's check the examples in SPEC:
    # longest_palindrome("babad") -> "bab" or "aba"
    # longest_palindrome("cbbd") -> "bb"
    # longest_palindrome("a") -> "a"
    # Wait, let's see. If the input contains punctuation, e.g., "A man, a plan...",
    # the entire string "A man, a plan, a canal, Panama" is a palindrome because when filtered it is "amanaplanacanalpanama".
    # So the longest palindromic substring of "A man, a plan, a canal, Panama" would be the whole string.
    # Let's write an O(n^2) algorithm:
    # We can check all substrings s[i:j]. For each substring, we check if it is a palindrome using is_palindrome.
    # To run in O(n^2), we can iterate over all possible centers of the palindrome:
    # But wait, checking if s[i:j] is a palindrome using is_palindrome takes O(n), so checking all substrings would be O(n^3) if done naively.
    # To do it in O(n^2) time, we can pre-filter the string but keep track of the original indices,
    # or expand around centers.
    # Let's do expand around centers on the filtered version, then map back to the original string.
    # Wait, let's map each character of the filtered string to its index in the original string:
    filtered_indices = [i for i, char in enumerate(s) if char.isalnum()]
    filtered = [char.lower() for char in s if char.isalnum()]
    
    if not filtered:
        return ""
        
    n = len(filtered)
    start, max_len = 0, 1
    
    def expand(left: int, right: int):
        nonlocal start, max_len
        while left >= 0 and right < n and filtered[left] == filtered[right]:
            current_len = right - left + 1
            if current_len > max_len:
                start = left
                max_len = current_len
            left -= 1
            right += 1
            
    for i in range(n):
        expand(i, i)      # Odd length
        expand(i, i + 1)  # Even length
        
    # Now map the filtered range [start, start + max_len - 1] back to the original string
    orig_start = filtered_indices[start]
    orig_end = filtered_indices[start + max_len - 1]
    return s[orig_start : orig_end + 1]

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 palindrome.py <string>", file=sys.stderr)
        sys.exit(1)
        
    input_str = sys.argv[1]
    pal = is_palindrome(input_str)
    longest = longest_palindrome(input_str)
    
    print(f'"{input_str}" → palindrome: {pal} | longest: "{longest}"')
    sys.exit(0)

if __name__ == "__main__":
    main()
