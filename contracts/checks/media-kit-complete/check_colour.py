#!/usr/bin/env python3
"""A9: recolours obey the presentation: each duotone's deepest tone is its ink; greyscale carries no hue; greyscale-on-dark is lighter than on-light."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

INV = json.loads(Path(".agent/memory/project/specs/media-kit-complete/goldens/inventory.json").read_text())
BASE = Path(INV["base_dir"]) / "saoc/mark"
TOL = 24
fails = []

def opaque(name):
    a = np.array(Image.open(BASE / name).convert("RGBA")).reshape(-1, 4)
    return a[a[:, 3] > 200][:, :3].astype(float)

for ink, hexv in INV["inks"].items():
    px = opaque(f"saoc-mark-duotone-{ink}.png")
    lum = px @ np.array([0.3, 0.59, 0.11])
    deep = px[lum <= np.percentile(lum, 1)].mean(axis=0)
    want = np.array([int(hexv[i:i+2], 16) for i in (1, 3, 5)], float)
    if np.abs(deep - want).max() > TOL: fails.append(f"{ink}: deepest 1% mean {deep.round()} vs ink {want}")
grey = opaque("saoc-mark-greyscale.png")
if (grey.max(axis=1) - grey.min(axis=1)).max() > 3: fails.append("greyscale is not neutral")
rev = opaque("saoc-mark-greyscale-reversed.png")
if (rev.max(axis=1) - rev.min(axis=1)).max() > 3: fails.append("greyscale-reversed is not neutral")
# Pinned samples, SA Orchid Council Logo Presentation.pdf p.3-4 (greyscale marks), 1st/99th luminance percentile means at 288dpi.
def tone(px, hi):
    l = px @ np.array([0.3, 0.59, 0.11])
    return px[l >= np.percentile(l, 99)].mean(axis=0) if hi else px[l <= np.percentile(l, 1)].mean(axis=0)
for nm_, px, lo_hex, hi_hex in (("greyscale", grey, "#212121", "#E3E2DF"), ("greyscale-reversed", rev, "#4A4C47", "#F5F5F5")):
    for hexv, hi in ((lo_hex, False), (hi_hex, True)):
        want = np.array([int(hexv[i:i+2], 16) for i in (1, 3, 5)], float)
        if np.abs(tone(px, hi) - want).max() > 24: fails.append(f"{nm_} {'light' if hi else 'dark'} tone {tone(px, hi).round()} vs pinned {hexv}")
lum = lambda p: float((p @ np.array([0.3, 0.59, 0.11])).mean())
if not lum(rev) > lum(grey): fails.append("greyscale-reversed is not lighter than greyscale")

if fails:
    print("\n".join(fails)); sys.exit(1)
print("OK: six inks reach their stated deep tone; greyscale neutral; reversed grey lighter")
