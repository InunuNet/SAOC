#!/usr/bin/env python3
"""WCAG 2.1 AA contrast checker for the bordered-callout error pattern
(text-primary-800 on bg-bone), reused verbatim from F3 (backlog-a11y-ui-quickfixes).

Adapted from contracts/golden/wcag-accent-contrast/check_contrast.py: same
token-parsing/luminance/contrast-ratio math, reading real hex values out of
globals.css rather than hardcoding a copy of the palette, retargeted at the
one pairing this mission's fix depends on.

Usage: python3 check_bordered_callout_contrast.py <path-to-globals.css>
Exit 0 = pairing passes AA (>=4.5:1). Exit 1 = fails. Exit 2 = tokens missing.
"""
import re
import sys

REQUIRED_VARS = ["primary-800", "bone"]


def parse_tokens(css_path):
    with open(css_path, "r", encoding="utf-8") as f:
        text = f.read()
    tokens = {}
    for name in REQUIRED_VARS:
        m = re.search(r"--" + re.escape(name) + r":\s*(#[0-9a-fA-F]{3,6})\s*;", text)
        if m:
            tokens[name] = m.group(1)
    missing = [n for n in REQUIRED_VARS if n not in tokens]
    if missing:
        print(f"FATAL: could not parse token(s) from {css_path}: {missing}")
        sys.exit(2)
    return tokens


def expand_hex(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def srgb_to_lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(hex_):
    r, g, b = expand_hex(hex_)
    R, G, B = srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b)
    return 0.2126 * R + 0.7152 * G + 0.0722 * B


def contrast_ratio(hex1, hex2):
    l1, l2 = relative_luminance(hex1), relative_luminance(hex2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def main():
    if len(sys.argv) != 2:
        print("usage: check_bordered_callout_contrast.py <path-to-globals.css>")
        sys.exit(2)
    tokens = parse_tokens(sys.argv[1])

    min_ratio = 4.5
    ratio = contrast_ratio(tokens["primary-800"], tokens["bone"])
    status = "PASS" if ratio >= min_ratio else "FAIL"
    print(f"[{status}] text-primary-800 ({tokens['primary-800']}) on bg-bone "
          f"({tokens['bone']}): {ratio:.2f}:1 (required {min_ratio}:1) — "
          f"CartDayPicker/TicketFormField/DownloadTicketButton error text")

    if ratio < min_ratio:
        print("\nRESULT: FAIL — bordered-callout pairing below WCAG AA threshold.")
        sys.exit(1)
    print("\nRESULT: PASS — bordered-callout pairing meets WCAG AA threshold.")
    sys.exit(0)


if __name__ == "__main__":
    main()
