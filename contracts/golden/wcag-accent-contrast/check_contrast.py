#!/usr/bin/env python3
"""WCAG 2.1 AA contrast checker for the SAOC --accent token family.

Reads the REAL token hex values out of a globals.css file (never a hardcoded
copy of the palette) and asserts every known text/surface pairing that uses
--accent, --accent-soft, or --ivory-on-accent meets its required threshold.

Usage: python3 check_contrast.py <path-to-globals.css>
Exit 0 = every pairing passes. Exit 1 = at least one pairing fails (prints why).
"""
import re
import sys

REQUIRED_VARS = [
    "primary", "primary-800", "accent", "accent-soft", "parchment", "bone", "ivory",
]


def parse_tokens(css_path):
    with open(css_path, "r", encoding="utf-8") as f:
        text = f.read()
    tokens = {}
    for name in REQUIRED_VARS:
        # matches:  --name: #rrggbb;   (allow 3 or 6 digit hex, ignore var() aliases)
        m = re.search(
            r"--" + re.escape(name) + r":\s*(#[0-9a-fA-F]{3,6})\s*;",
            text,
        )
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
        print("usage: check_contrast.py <path-to-globals.css>")
        sys.exit(2)
    tokens = parse_tokens(sys.argv[1])

    # Every real pairing in the SAOC codebase that renders --accent /
    # --accent-soft as TEXT (or as a filled button background under
    # --ivory text). Threshold 4.5:1 = WCAG AA normal text / small UI text
    # (nothing in this token's real usage is >=18.66px bold or >=24px, so
    # the 3:1 large-text/graphical-boundary exception does not apply to any
    # of these — see contrast-audit.md for the per-usage size check).
    pairs = [
        ("accent", "parchment", 4.5, "text-accent on parchment/ivory bg (ContactForm, "
         "TicketPurchaseForm, TicketFormField error text; eyebrow labels on light sections)"),
        ("accent", "bone", 4.5, "text-accent on bone bg (eyebrow labels in bg-bone "
         "sections; the binding/tightest light-surface case)"),
        ("accent-soft", "primary", 4.5, "text-accent-soft on bg-primary (dark-surface "
         "eyebrow labels after remediation swap from text-accent)"),
        ("accent-soft", "primary-800", 4.5, "text-accent-soft on bg-primary-800 (hero / "
         "archive dark-surface eyebrow labels after remediation swap)"),
        ("ivory", "accent", 4.5, "text-ivory on bg-accent filled buttons (ContactForm "
         "submit, TicketPurchaseForm submit, hero CTA, 'Next' cycle badge)"),
    ]

    all_ok = True
    for fg, bg, min_ratio, desc in pairs:
        ratio = contrast_ratio(tokens[fg], tokens[bg])
        status = "PASS" if ratio >= min_ratio else "FAIL"
        if ratio < min_ratio:
            all_ok = False
        print(f"[{status}] {fg} ({tokens[fg]}) on {bg} ({tokens[bg]}): "
              f"{ratio:.2f}:1 (required {min_ratio}:1) — {desc}")

    if not all_ok:
        print("\nRESULT: FAIL — one or more --accent pairings below WCAG AA threshold.")
        sys.exit(1)
    print("\nRESULT: PASS — all --accent pairings meet WCAG AA threshold.")
    sys.exit(0)


if __name__ == "__main__":
    main()
