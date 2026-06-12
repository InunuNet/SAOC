#!/usr/bin/env python3
"""
sieve — UTF-8 Line Classifier
Spec: SPEC.md

Reads a UTF-8 text file, classifies each line by its highest Unicode codepoint,
applies optional Unicode normalization, and outputs a TSV report.

Usage: python3 sieve.py --normalize {nfc,nfd,none} input.txt
Exit codes: 0 = success, 2 = decode error or missing file
"""

import argparse
import sys
import unicodedata


def classify_line(line: str) -> str:
    """
    Classify a line by its highest Unicode codepoint, priority order:
      EMOJI:   any codepoint >= 0x1F000
      UNICODE: any codepoint >  0x00FF and < 0x1F000
      LATIN:   any codepoint in 0x0080–0x00FF
      ASCII:   all codepoints <= 0x007F
    Empty lines are classified as ASCII (no codepoints above 0x007F).
    """
    if not line:
        return "ASCII"

    has_emoji = False
    has_unicode = False
    has_latin = False

    for ch in line:
        cp = ord(ch)
        if cp >= 0x1F000:
            has_emoji = True
            break  # highest priority — no need to continue
        elif cp > 0x00FF:
            has_unicode = True
        elif cp >= 0x0080:
            has_latin = True

    if has_emoji:
        return "EMOJI"
    if has_unicode:
        return "UNICODE"
    if has_latin:
        return "LATIN"
    return "ASCII"


def normalize_line(line: str, mode: str) -> str:
    """Apply Unicode normalization to a line."""
    if mode == "nfc":
        return unicodedata.normalize("NFC", line)
    elif mode == "nfd":
        return unicodedata.normalize("NFD", line)
    return line  # none


def process_file(path: str, normalize: str) -> None:
    """
    Read, normalize, classify, and print each line as TSV.
    Exits 2 on missing file or UTF-8 decode error.
    """
    try:
        with open(path, "rb") as f:
            raw = f.read()
    except OSError as exc:
        print(f"ERROR: cannot open file: {exc}", file=sys.stderr)
        sys.exit(2)

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        print(f"ERROR: UTF-8 decode error: {exc}", file=sys.stderr)
        sys.exit(2)

    # Normalize CRLF → LF before splitting into lines
    text = text.replace("\r\n", "\n")

    # Split into lines — remove trailing newline to avoid phantom empty line
    if text.endswith("\n"):
        text = text[:-1]
    lines = text.split("\n")

    for line_num, line in enumerate(lines, 1):
        normalized = normalize_line(line, normalize)
        classification = classify_line(normalized)
        char_count = len(normalized)
        print(f"{line_num}\t{classification}\t{char_count}\t{normalized}")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="sieve — UTF-8 Line Classifier"
    )
    parser.add_argument(
        "--normalize",
        choices=["nfc", "nfd", "none"],
        required=True,
        help="Unicode normalization form to apply: nfc, nfd, or none",
    )
    parser.add_argument(
        "input",
        metavar="input.txt",
        help="Input file to classify (must be valid UTF-8)",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    process_file(args.input, args.normalize)
    sys.exit(0)


if __name__ == "__main__":
    main()
