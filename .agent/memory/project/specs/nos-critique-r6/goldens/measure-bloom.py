#!/usr/bin/env python3
"""nos-critique-r6 f5 (R80 #1): measure where the bloom sits in each NOS hero photograph.

"Bloom" = the in-focus subject. Backgrounds in all five photographs are blurred, so local
sharpness separates subject from background where brightness or colour cannot (the violet,
yellow and pink photographs have bright or saturated backgrounds). Method, fixed so the result
is reproducible: 600px-long-edge grayscale, Laplacian magnitude, Gaussian blur radius 12,
keep the top 25% of pixels as the bloom mask, then write the mask's 100-bin column and row mass
marginals (fractions summing to 1) plus the centroid. check-f5-rendered.mjs reads the JSON this
script writes (goldens/bloom-marginals.json) and scores the shipped crop against the best crop.

Run: python3 .agent/memory/project/specs/nos-critique-r6/goldens/measure-bloom.py [images-dir] [out.json]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

IMAGES = ["orchid-dark", "orchid-yellow", "orchid-violet", "orchid-purple", "orchid-pink"]
BINS = 100
KEEP = 0.25
EDGE = 600
BLUR = 12

here = Path(__file__).resolve().parent
images_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else here.parents[5] / ".tmp/sandbox/critique-r6/public/images"
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else here / "bloom-marginals.json"


def measure(name: str) -> dict:
    img = Image.open(images_dir / f"{name}.jpg").convert("L")
    img.thumbnail((EDGE, EDGE))
    a = np.asarray(img, dtype=np.float64)
    p = np.pad(a, 1, mode="edge")
    lap = np.abs(4 * a - p[:-2, 1:-1] - p[2:, 1:-1] - p[1:-1, :-2] - p[1:-1, 2:])
    energy = np.asarray(
        Image.fromarray(np.clip(lap * 4, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(BLUR)),
        dtype=np.float64,
    )
    mask = energy >= np.quantile(energy, 1 - KEEP)
    h, w = mask.shape
    cols = np.array([mask[:, int(i * w / BINS) : int((i + 1) * w / BINS)].sum() for i in range(BINS)], dtype=np.float64)
    rows = np.array([mask[int(i * h / BINS) : int((i + 1) * h / BINS), :].sum() for i in range(BINS)], dtype=np.float64)
    ys, xs = np.nonzero(mask)
    return {
        "width": Image.open(images_dir / f"{name}.jpg").size[0],
        "height": Image.open(images_dir / f"{name}.jpg").size[1],
        "centroid": [round(float(xs.mean()) / w, 4), round(float(ys.mean()) / h, 4)],
        "cols": [round(float(v), 6) for v in cols / cols.sum()],
        "rows": [round(float(v), 6) for v in rows / rows.sum()],
    }


result = {"method": f"laplacian>gauss{BLUR}>top{int(KEEP * 100)}%>{BINS}-bin marginals", "images": {n: measure(n) for n in IMAGES}}
out_path.write_text(json.dumps(result, indent=1) + "\n")
for n, v in result["images"].items():
    print(f"{n:15s} {v['width']}x{v['height']}  centroid x={v['centroid'][0]:.3f} y={v['centroid'][1]:.3f}")
