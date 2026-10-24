#!/usr/bin/env python3
"""Extract the official SAOC light-on-dark mono emblem from the approved logo presentation.

Source (read-only): branding/SA Orchid Council/SA Orchid Council Logo Presentation.pdf, page 4,
the second panel "VERTICAL - LIGHT TYPE ON DARK". Nothing is recoloured, cropped or upscaled.

  emblem  pdfimages page-4 image 2 (RGB) + its own soft mask, image 3 (the PDF smask) -> RGBA PNG, 768x490

The panel's own type reads "SA Orchid Council" and is NOT extracted: the footer's wordmark is the live
"South African Orchid Council" text of components/chrome/SaocLockup.tsx (NOS Design ruling).

Usage:
  python3 -I scripts/extract-saoc-footer-lockup.py --out .tmp/sandbox/nos-footer-saoc-logo/out   # write the emblem
  python3 -I scripts/extract-saoc-footer-lockup.py --check   # re-extract to a sandbox, compare pixels to public/images
"""
import argparse
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageChops

PDF = "branding/SA Orchid Council/SA Orchid Council Logo Presentation.pdf"
PAGE = "4"
EMBLEM_OUT = "saoc-lockup-vertical-emblem.png"
SHIPPED_DIR = "public/images"
SANDBOX = ".tmp/sandbox/saoc-footer-lockup-extract"
BIN_DIRS = ("/opt/homebrew/bin", "/usr/local/bin")
EMBLEM_RGB, EMBLEM_MASK = "img-002.png", "img-003.png"
EMBLEM_SIZE = (768, 490)


def tool(name):
    for d in BIN_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    found = shutil.which(name)
    if not found:
        sys.exit(f"missing tool: {name}")
    return found


def extract(out):
    work = os.path.join(SANDBOX, "work")
    os.makedirs(work, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    subprocess.run([tool("pdfimages"), "-f", PAGE, "-l", PAGE, "-png", PDF, os.path.join(work, "img")], check=True)
    rgb = Image.open(os.path.join(work, EMBLEM_RGB)).convert("RGB")
    mask = Image.open(os.path.join(work, EMBLEM_MASK)).convert("L")
    assert rgb.size == EMBLEM_SIZE and mask.size == EMBLEM_SIZE, (rgb.size, mask.size)
    rgb.putalpha(mask)
    rgb.save(os.path.join(out, EMBLEM_OUT), optimize=True)


def check():
    out = os.path.join(SANDBOX, "recheck")
    extract(out)
    a = Image.open(os.path.join(out, EMBLEM_OUT)).convert("RGBA")
    b = Image.open(os.path.join(SHIPPED_DIR, EMBLEM_OUT)).convert("RGBA")
    same = a.size == b.size and ImageChops.difference(a, b).getbbox() is None
    print("PASS" if same else "FAIL", EMBLEM_OUT, "pixel-identical RGBA", a.size)
    return 0 if same else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if args.check:
        sys.exit(check())
    if not args.out:
        ap.error("--out or --check required")
    extract(args.out)
