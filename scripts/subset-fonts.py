#!/usr/bin/env python3
"""Slim the SAOC site fonts in place (F1e lever 2): Latin + Latin-1 + typographic punctuation, and
only the weight range each face is declared with in app/layout.tsx. Needs `pip install fonttools brotli`.
Usage (from the project root): python3 scripts/subset-fonts.py
The shipped files already are Google's Latin subsets, so the code point set below is the same set;
the saving comes from clipping the variable axes to the declared weight ranges and dropping hinting
and name records. Idempotent: running it on its own output changes nothing.
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONT_DIR = os.path.join("app", "fonts")
KEEP = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + list(range(0x2000, 0x2070))
    + [0x131, 0x152, 0x153, 0x2BB, 0x2BC, 0x2C6, 0x2DA, 0x2DC, 0x304, 0x308, 0x329]
    + [0x2074, 0x20AC, 0x2122, 0x2191, 0x2193, 0x2212, 0x2215, 0xFEFF, 0xFFFD]
)
# file -> variable axis ranges to keep (None: static font). Ranges match the `weight` in app/layout.tsx.
FACES = {
    "crimson-pro/CrimsonPro-latin-normal.woff2": {"wght": (300, 600)},
    "crimson-pro/CrimsonPro-latin-italic.woff2": {"wght": (300, 600)},
    "manrope/Manrope-latin-normal.woff2": {"wght": (400, 700)},
    "jetbrains-mono/JetBrainsMono-latin-normal.woff2": {"wght": (400, 500)},
    "lora/Lora-latin-normal.woff2": None,
}


def slim(path: str, axes) -> None:
    font = TTFont(path)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = [1, 2]
    options.hinting = False
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=KEEP)
    subsetter.subset(font)
    if axes:
        font = instancer.instantiateVariableFont(font, axes, inplace=False)
    font.flavor = "woff2"
    font.save(path)


def main() -> int:
    for name, axes in FACES.items():
        path = os.path.join(FONT_DIR, name)
        before = os.path.getsize(path)
        slim(path, axes)
        print(f"{name}: {before} -> {os.path.getsize(path)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
