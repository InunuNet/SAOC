#!/usr/bin/env python3
"""A2/A3 — the generator's output file pairs exist, are trimmed, transparent,
match the source emblem's own trimmed aspect ratio within 2%, and each 2x file
is exactly double its 1x sibling's dimensions. Covers both lockup assets:
  - header/footer... no: header full-colour E1 pair (saoc-emblem-lockup[.png/-2x.png])
  - footer Lapis-monotone E4 pair (saoc-emblem-footer-lapis[.png/-2x.png])

Usage: python3 contracts/checks/saoc-emblem-lockup-f1/check-new-emblem-assets.py
Exit 0 on all checks passing, 1 with a reason on the first failure.
"""
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow is not installed")
    sys.exit(1)

SOURCE = "branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png"

PAIRS = [
    ("public/images/saoc-emblem-lockup.png", "public/images/saoc-emblem-lockup-2x.png"),
    ("public/images/saoc-emblem-footer-lapis.png", "public/images/saoc-emblem-footer-lapis-2x.png"),
]


def trimmed_size(path):
    im = Image.open(path).convert("RGBA")
    bbox = im.getbbox()
    if bbox is None:
        print(f"{path}: fully transparent image")
        sys.exit(1)
    if bbox != (0, 0, im.width, im.height):
        print(f"{path}: not trimmed — bbox {bbox} != canvas {(0, 0, im.width, im.height)}")
        sys.exit(1)
    return im.size


def check_pair(one_x, two_x, src_aspect):
    try:
        w1, h1 = trimmed_size(one_x)
    except FileNotFoundError:
        print(f"missing: {one_x}")
        sys.exit(1)
    try:
        w2, h2 = trimmed_size(two_x)
    except FileNotFoundError:
        print(f"missing: {two_x}")
        sys.exit(1)

    if w2 != w1 * 2 or h2 != h1 * 2:
        print(f"{two_x} {(w2, h2)} is not exactly double {one_x}'s {(w1, h1)}")
        sys.exit(1)

    aspect1 = w1 / h1
    if abs(aspect1 - src_aspect) / src_aspect > 0.02:
        print(f"{one_x} aspect ratio {aspect1:.4f} diverges >2% from source trimmed aspect {src_aspect:.4f}")
        sys.exit(1)

    if Image.open(one_x).mode != "RGBA" or Image.open(two_x).mode != "RGBA":
        print(f"{one_x}/{two_x} must stay RGBA (transparent ground)")
        sys.exit(1)

    print(f"OK: {one_x} {(w1, h1)}, {two_x} {(w2, h2)}, both trimmed, transparent, aspect matches source")


def main():
    try:
        src_im = Image.open(SOURCE).convert("RGBA")
    except FileNotFoundError:
        print(f"missing source: {SOURCE}")
        sys.exit(1)
    src_bbox = src_im.getbbox()
    src_w = src_bbox[2] - src_bbox[0]
    src_h = src_bbox[3] - src_bbox[1]
    src_aspect = src_w / src_h

    for one_x, two_x in PAIRS:
        check_pair(one_x, two_x, src_aspect)


if __name__ == "__main__":
    main()
