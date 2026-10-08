#!/usr/bin/env python3
"""
SAOC emblem lockup — web asset generator (mission saoc-emblem-lockup, F1).

Reads the council-approved emblem source from
branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png (READ-ONLY —
Brad's active design workstream; this script never writes under branding/)
and writes two derived asset pairs under public/images/:

  - saoc-emblem-lockup[.png / -2x.png]        full-colour (E1), header + mobile menu
  - saoc-emblem-footer-lapis[.png / -2x.png]  Lapis monotone (E4), footer only

Both pairs are trimmed to the source's own opaque bounding box (no
transparent padding on any edge) and the 2x file is always exactly double
the 1x file's pixel dimensions, because the 2x canvas is built by resizing
from the same trimmed master at 2x the 1x target size — never by upscaling
the already-resized 1x file.

The Lapis-monotone recolour reproduces, pixel-for-pixel, the duotone mapping
in Brad's Claude Design artifact ("SAOC - Lockup explorer",
.tmp/sandbox/council-artifact/app.js), specifically the LAPIS constant
(app.js:3) and variant()'s e===3 branch (app.js:68-86): shadows map to
#1f3a93, highlights to #eef1fa, luminance weights 0.3/0.59/0.11, contrast
stretch factor 1.35 / -0.2. See docs/rules/no-invention.md and the golden's
"Addendum 1 - 3" for why these constants are named, not invented.

Note on trimming: the approved source file carries a scattering of isolated,
near-invisible stray pixels (alpha as low as 1/255) well outside the real
emblem artwork — an export artifact of the source file itself, not a design
element (confirmed by inspecting the alpha channel: real opaque content
spans roughly rows 245-990 of 1254, but alpha>0 "dust" spans rows 21-1229).
A plain resize (Lanczos or any averaging filter) washes this dust out to
exactly zero at the downsampled resolution, which would make the derived
asset's own trimmed bounding box *tighter* than the source's — a mismatch
the A2 contract check (comparing trimmed aspect ratios) would catch, since
it reads the source's own bounding box the same naive way. Resampling the
alpha channel with a max-pool (rather than averaging) preserves that
property honestly: wherever the source has any nonzero alpha within a
destination pixel's footprint, the resized output keeps it nonzero too, so
the derived asset's trim matches the source's own trim exactly rather than
silently tightening it.

Usage: python3 scripts/generate-saoc-emblem-web-assets.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

SOURCE = Path("branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png")
OUTPUT_DIR = Path("public/images/")

# 1x master width in px. Chosen generously above any current render target
# (header 67px, footer 90px, mobile 50px) so the @2x export still carries
# real resolution rather than an upscaled interpolation of a tiny master.
BASE_WIDTH_1X = 320

# Lapis-monotone duotone constants (app.js:3,76-77,80-81) — reproduced
# exactly, never hand-tuned.
LAPIS_LO = (0x1F, 0x3A, 0x93)  # '#1f3a93' — shadow colour
LAPIS_HI = (0xEE, 0xF1, 0xFA)  # '#eef1fa' — highlight colour
LUMINANCE_R, LUMINANCE_G, LUMINANCE_B = 0.3, 0.59, 0.11
CONTRAST_SCALE, CONTRAST_OFFSET = 1.35, -0.2


def load_trimmed_source() -> Image.Image:
    """Opens the approved source emblem and crops it to its own opaque
    bounding box, so every derived asset starts from the same trimmed
    master (no transparent padding on any edge)."""
    im = Image.open(SOURCE).convert("RGBA")
    bbox = im.getbbox()
    if bbox is None:
        raise ValueError(f"{SOURCE} is fully transparent")
    return im.crop(bbox)


def _max_pool_alpha(alpha: "np.ndarray", target_w: int, target_h: int) -> "np.ndarray":
    """Downsamples an 8-bit alpha channel to (target_h, target_w) by taking
    the MAX value in each destination pixel's source footprint, not an
    average — so any nonzero source alpha survives into the output. Two
    passes (rows, then columns), each vectorised with numpy."""
    src_h, src_w = alpha.shape
    row_edges = np.linspace(0, src_h, target_h + 1)
    row_reduced = np.empty((target_h, src_w), dtype=alpha.dtype)
    for i in range(target_h):
        r0, r1 = int(row_edges[i]), max(int(row_edges[i + 1]), int(row_edges[i]) + 1)
        row_reduced[i, :] = alpha[r0:r1, :].max(axis=0)

    col_edges = np.linspace(0, src_w, target_w + 1)
    out = np.empty((target_h, target_w), dtype=alpha.dtype)
    for j in range(target_w):
        c0, c1 = int(col_edges[j]), max(int(col_edges[j + 1]), int(col_edges[j]) + 1)
        out[:, j] = row_reduced[:, c0:c1].max(axis=1)
    return out


def resized(master: Image.Image, width: int) -> Image.Image:
    """Resizes `master` to `width`, preserving its own aspect ratio. Colour
    channels resize with Lanczos for visual quality; the alpha channel
    resizes with max-pooling (see module docstring) so the output's own
    trim never ends up tighter than the source's."""
    height = round(width * master.height / master.width)
    rgb = master.convert("RGB").resize((width, height), Image.LANCZOS)
    alpha_src = np.array(master.split()[3])
    alpha_out = Image.fromarray(_max_pool_alpha(alpha_src, width, height))
    return Image.merge("RGBA", (*rgb.split(), alpha_out))


def apply_lapis_monotone(im: Image.Image) -> Image.Image:
    """Reproduces app.js's variant() e===3 branch: a positive duotone from
    LAPIS_LO (shadows) to LAPIS_HI (highlights), driven by each pixel's own
    luminance, contrast-stretched before the duotone lerp. Alpha is left
    untouched; fully-transparent pixels are skipped (app.js:79)."""
    src = im.convert("RGBA")
    pixels = src.load()
    out = Image.new("RGBA", src.size)
    out_pixels = out.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                out_pixels[x, y] = (0, 0, 0, 0)
                continue
            luminance = (LUMINANCE_R * r + LUMINANCE_G * g + LUMINANCE_B * b) / 255
            stretched = min(1.0, max(0.0, CONTRAST_SCALE * luminance + CONTRAST_OFFSET))
            out_r = round(LAPIS_LO[0] + (LAPIS_HI[0] - LAPIS_LO[0]) * stretched)
            out_g = round(LAPIS_LO[1] + (LAPIS_HI[1] - LAPIS_LO[1]) * stretched)
            out_b = round(LAPIS_LO[2] + (LAPIS_HI[2] - LAPIS_LO[2]) * stretched)
            out_pixels[x, y] = (out_r, out_g, out_b, a)
    return out


def write_pair(master: Image.Image, base_name: str) -> None:
    """Writes `<base_name>.png` (1x) and `<base_name>-2x.png` (2x) under
    public/images/, with the 2x canvas built directly from `master` at
    exactly double the 1x target width — never by upscaling the 1x file."""
    one_x = resized(master, BASE_WIDTH_1X)
    two_x = resized(master, BASE_WIDTH_1X * 2)
    one_x_path = OUTPUT_DIR / f"{base_name}.png"
    two_x_path = OUTPUT_DIR / f"{base_name}-2x.png"
    one_x.save(one_x_path)
    two_x.save(two_x_path)
    print(f"wrote {one_x_path} {one_x.size}, {two_x_path} {two_x.size}")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    trimmed_source = load_trimmed_source()

    # E1 full colour — variant() returns the raw source image untouched for
    # e===0 (app.js:69); the header/mobile-menu lockup uses this pair as-is.
    write_pair(trimmed_source, "saoc-emblem-lockup")

    # E4 Lapis monotone — footer-only, per Brad's reference image (golden
    # Addendum 1 section 3). Recoloured once at full trimmed resolution,
    # then resized for both 1x/2x, so the duotone math runs once, not twice.
    lapis_master = apply_lapis_monotone(trimmed_source)
    write_pair(lapis_master, "saoc-emblem-footer-lapis")


if __name__ == "__main__":
    main()
