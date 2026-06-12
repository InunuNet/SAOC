#!/usr/bin/env python3
"""
Create fixture files for sieve tests with correct binary content.
Run from inside the sieve/ directory:
    python3 tests/fixtures/create_fixtures.py
"""

import unicodedata
import os

os.makedirs("tests/fixtures", exist_ok=True)

# ── Basic fixture ─────────────────────────────────────────────────────────────
# Mixed NFC and NFD forms, LF line endings

lines = [
    "hello world",                           # Line 1: ASCII
    unicodedata.normalize("NFC", "café"),    # Line 2: NFC café (4 codepoints)
    "日本語",                                # Line 3: 3 CJK codepoints (UNICODE)
    "\U0001F600",                            # Line 4: 😀 (EMOJI)
    "hi \U0001F600",                         # Line 5: 4 codepoints (EMOJI)
    unicodedata.normalize("NFD", "café"),    # Line 6: NFD café (5 codepoints: c,a,f,e,U+0301)
]

with open("tests/fixtures/sieve_basic.txt", "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lines) + "\n")

print("Created tests/fixtures/sieve_basic.txt")

# ── Basic NFC expected output ─────────────────────────────────────────────────
# After NFC normalization:
#   Line 1: "hello world" → ASCII, 11 chars
#   Line 2: NFC café → LATIN (é=U+00E9 is in 0x80-0xFF), 4 chars
#   Line 3: "日本語" → UNICODE (CJK > 0xFF), 3 chars
#   Line 4: "😀" → EMOJI (>= 0x1F000), 1 char
#   Line 5: "hi 😀" → EMOJI, 4 chars
#   Line 6: NFD café → NFC normalizes to NFC café → LATIN, 4 chars

cafe_nfc = unicodedata.normalize("NFC", "café")  # é = U+00E9

basic_nfc_lines = [
    f"1\tASCII\t11\thello world",
    f"2\tLATIN\t4\t{cafe_nfc}",
    f"3\tUNICODE\t3\t日本語",
    f"4\tEMOJI\t1\t\U0001F600",
    f"5\tEMOJI\t4\thi \U0001F600",
    f"6\tLATIN\t4\t{cafe_nfc}",
]

with open("tests/fixtures/sieve_basic_nfc_expected.txt", "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(basic_nfc_lines) + "\n")

print("Created tests/fixtures/sieve_basic_nfc_expected.txt")

# ── Basic none expected output ────────────────────────────────────────────────
# No normalization:
#   Line 1: "hello world" → ASCII, 11 chars
#   Line 2: NFC café → LATIN (é=U+00E9), 4 chars
#   Line 3: "日本語" → UNICODE, 3 chars
#   Line 4: "😀" → EMOJI, 1 char
#   Line 5: "hi 😀" → EMOJI, 4 chars
#   Line 6: NFD café → UNICODE (U+0301 combining acute > 0xFF and < 0x1F000), 5 chars

cafe_nfd = unicodedata.normalize("NFD", "café")  # e + U+0301

basic_none_lines = [
    f"1\tASCII\t11\thello world",
    f"2\tLATIN\t4\t{cafe_nfc}",
    f"3\tUNICODE\t3\t日本語",
    f"4\tEMOJI\t1\t\U0001F600",
    f"5\tEMOJI\t4\thi \U0001F600",
    f"6\tUNICODE\t5\t{cafe_nfd}",
]

with open("tests/fixtures/sieve_basic_none_expected.txt", "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(basic_none_lines) + "\n")

print("Created tests/fixtures/sieve_basic_none_expected.txt")

# ── Boundary fixture ──────────────────────────────────────────────────────────
# CRLF line endings to test normalization of CRLF → LF

boundary_lines_content = [
    "ASCII boundary",                          # Line 1: ASCII, 14 chars
    "",                                        # Line 2: empty, ASCII, 0 chars
    "ñ",                                       # Line 3: ñ (U+00F1 = LATIN), 1 char
    unicodedata.normalize("NFC", "voilà"),     # Line 4: NFC voilà, LATIN, 5 chars
    unicodedata.normalize("NFD", "voilà"),     # Line 5: NFD voilà (à = a+U+0300), 6 chars
    "\U0001F000",                              # Line 6: 🀀 mahjong tile (exactly 0x1F000 = EMOJI), 1 char
]

boundary_text = "\r\n".join(boundary_lines_content) + "\r\n"
with open("tests/fixtures/sieve_boundary.txt", "wb") as f:
    f.write(boundary_text.encode("utf-8"))

print("Created tests/fixtures/sieve_boundary.txt")

# ── Boundary NFC expected output ──────────────────────────────────────────────
# After NFC normalization:
#   Line 1: "ASCII boundary" → ASCII, 14 chars
#   Line 2: "" → ASCII, 0 chars (trailing tab, empty normalized form)
#   Line 3: "ñ" → LATIN (U+00F1), 1 char
#   Line 4: NFC voilà → NFC = same → LATIN (à=U+00E0), 5 chars
#   Line 5: NFD voilà → NFC → LATIN, 5 chars
#   Line 6: 🀀 → EMOJI (= 0x1F000 >= 0x1F000), 1 char

voila_nfc = unicodedata.normalize("NFC", "voilà")

boundary_nfc_lines = [
    f"1\tASCII\t14\tASCII boundary",
    f"2\tASCII\t0\t",
    f"3\tLATIN\t1\tñ",
    f"4\tLATIN\t5\t{voila_nfc}",
    f"5\tLATIN\t5\t{voila_nfc}",
    f"6\tEMOJI\t1\t\U0001F000",
]

with open("tests/fixtures/sieve_boundary_nfc_expected.txt", "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(boundary_nfc_lines) + "\n")

print("Created tests/fixtures/sieve_boundary_nfc_expected.txt")

# ── Boundary none expected output ─────────────────────────────────────────────
# No normalization:
#   Line 1: "ASCII boundary" → ASCII, 14 chars
#   Line 2: "" → ASCII, 0 chars
#   Line 3: "ñ" → LATIN (U+00F1), 1 char
#   Line 4: NFC voilà → LATIN (à=U+00E0), 5 chars
#   Line 5: NFD voilà → UNICODE (U+0300 combining grave > 0xFF), 6 chars
#   Line 6: 🀀 → EMOJI, 1 char

voila_nfd = unicodedata.normalize("NFD", "voilà")

boundary_none_lines = [
    f"1\tASCII\t14\tASCII boundary",
    f"2\tASCII\t0\t",
    f"3\tLATIN\t1\tñ",
    f"4\tLATIN\t5\t{voila_nfc}",
    f"5\tUNICODE\t6\t{voila_nfd}",
    f"6\tEMOJI\t1\t\U0001F000",
]

with open("tests/fixtures/sieve_boundary_none_expected.txt", "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(boundary_none_lines) + "\n")

print("Created tests/fixtures/sieve_boundary_none_expected.txt")

print("\nAll fixtures created successfully.")

# ── Verification ──────────────────────────────────────────────────────────────
print("\nVerification:")
cafe_nfc_check = unicodedata.normalize("NFC", "café")
cafe_nfd_check = unicodedata.normalize("NFD", "café")
print(f"  NFC café codepoints: {[hex(ord(c)) for c in cafe_nfc_check]}")
print(f"  NFD café codepoints: {[hex(ord(c)) for c in cafe_nfd_check]}")
print(f"  U+0301 (combining acute) = {hex(0x0301)} → > 0x00FF → UNICODE class")
print(f"  U+1F000 (mahjong tile) = {hex(0x1F000)} → >= 0x1F000 → EMOJI class")
