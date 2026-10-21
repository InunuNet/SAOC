#!/usr/bin/env python3
"""A1-A5: every expected media-kit file exists, has the expected dimensions/bytes, zips match, no strays."""
import hashlib, json, sys, zipfile
from pathlib import Path
from PIL import Image

INV = json.loads(Path(".agent/memory/project/specs/media-kit-complete/goldens/inventory.json").read_text())
BASE = Path(INV["base_dir"])
RULES = INV["lockup_rules"]
fails = []
def fail(m): fails.append(m)

lock_dims = {}
for f in INV["files"]:
    p = BASE / f["path"]
    if not p.is_file():
        fail(f"missing {p}"); continue
    if f["path"].endswith(".svg"):
        continue
    with Image.open(p) as im:
        w, h = im.size
        rgba = im.convert("RGBA")
        corner = rgba.getpixel((0, 0))
    if f["width"] is not None and (w, h) != (f["width"], f["height"]):
        fail(f"{p} is {w}x{h}, expected {f['width']}x{f['height']}")
    if f["kind"] == "mark" and corner[3] != 0:
        fail(f"{p} corner not transparent")
    if f["kind"] == "chip":
        want = tuple(int(f["ground_hex"][i:i+2], 16) for i in (1, 3, 5)) + (255,)
        if corner != want: fail(f"{p} corner {corner} != ground {want}")
    if f["kind"] == "lockup":
        if corner[3] != 0: fail(f"{p} corner not transparent")
        lock_dims.setdefault((f["wordmark"], f["orientation"]), set()).add((w, h))
        if f["orientation"] == "horizontal":
            if h < RULES["horizontal_min_height"] or not RULES["horizontal_aspect"][0] <= w / h <= RULES["horizontal_aspect"][1]:
                fail(f"{p} {w}x{h} outside horizontal rule")
        else:
            lo, hi = RULES["vertical_aspect_h_over_w"]
            if w < RULES["vertical_min_width"] or not lo <= h / w <= hi:
                fail(f"{p} {w}x{h} outside vertical rule")
    if "source" in f and hashlib.sha256(p.read_bytes()).digest() != hashlib.sha256(Path(f["source"]).read_bytes()).digest():
        fail(f"{p} is not byte-identical to {f['source']}")
for key, dims in lock_dims.items():
    if len(dims) != 1: fail(f"lockup dims differ within {key}: {sorted(dims)}")

colour = BASE / "saoc/mark/saoc-mark-colour.png"
master = Path(INV["colour_mark_byte_identical_to"])
if colour.is_file() and colour.read_bytes() != master.read_bytes():
    fail("saoc-mark-colour.png is not byte-identical to public/images/Eulophia-speciosa-emblem.png")

for z in INV["zips"]:
    zp = BASE / z["path"]
    if not zp.is_file(): fail(f"missing {zp}"); continue
    with zipfile.ZipFile(zp) as zf:
        if sorted(zf.namelist()) != sorted(z["members"]): fail(f"{zp} members differ from inventory")
        by_name = {Path(f["path"]).name: BASE / f["path"] for f in INV["files"]}
        for n in zf.namelist():
            if n in by_name and zf.read(n) != by_name[n].read_bytes(): fail(f"{zp}:{n} differs from the loose file")

UDIR = Path(INV["usage_dir"])
for n in INV["usage_illustrations"]:
    if not (UDIR / n).is_file(): fail(f"missing usage illustration {UDIR / n}")

expected = {f["path"] for f in INV["files"]} | {z["path"] for z in INV["zips"]} | set(INV["legacy_untracked_by_page"])
actual = {str(p.relative_to(BASE)) for p in BASE.rglob("*") if p.is_file() and p.name != ".DS_Store"}
for s in sorted(actual - expected): fail(f"stray file {s}")

if fails:
    print("\n".join(fails[:40])); print(f"FAIL: {len(fails)} problem(s)"); sys.exit(1)
print(f"OK: {len(INV['files'])} files + {len(INV['zips'])} zips match the inventory")
