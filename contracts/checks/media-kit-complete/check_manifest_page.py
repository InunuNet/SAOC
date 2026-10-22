#!/usr/bin/env python3
"""A6-A8: manifest == inventory == disk; labels use approved wording only; the page links exactly the manifest and nothing hand-written."""
import json, re, sys
from pathlib import Path

SPEC = Path(".agent/memory/project/specs/media-kit-complete/goldens")
INV = json.loads((SPEC / "inventory.json").read_text())
LAB = json.loads((SPEC / "labels.json").read_text())
BASE = Path(INV["base_dir"])
MANIFEST = Path("lib/data/media-kit-manifest.json")
PAGE_DIR = Path("app/(marketing)/media-kit")
fails = []
def fail(m): fails.append(m)

if not MANIFEST.is_file():
    print(f"FAIL: {MANIFEST} missing"); sys.exit(1)
entries = json.loads(MANIFEST.read_text())
entries = entries["items"] if isinstance(entries, dict) else entries
want = {f["path"] for f in INV["files"]} | {z["path"] for z in INV["zips"]}
got = {e["path"] for e in entries}
for s in sorted(want - got): fail(f"manifest lacks {s}")
for s in sorted(got - want): fail(f"manifest lists unexpected {s}")
if len(got) != len(entries): fail("duplicate manifest paths")

LABEL_FIELDS = ["rendition_label", "ink_label", "lockup_label", "wordmark_label", "mark_label", "variant_label", "orientation_label", "bundle_label"]
for e in entries:
    p = BASE / e["path"]
    if not p.is_file(): fail(f"manifest lists nonexistent {p}"); continue
    if e.get("href") != "/downloads/media-kit/" + e["path"]: fail(f"{e['path']}: href is {e.get('href')}")
    if e.get("bytes") != p.stat().st_size: fail(f"{e['path']}: bytes {e.get('bytes')} != {p.stat().st_size}")
    if not e.get("format"): fail(f"{e['path']}: no format")
    if e["path"].endswith(".png") or e["path"].endswith(".jpg"):
        from PIL import Image
        with Image.open(p) as im: w, h = im.size
        if (e.get("width"), e.get("height")) != (w, h): fail(f"{e['path']}: dims {e.get('width')}x{e.get('height')} != {w}x{h}")
    if e.get("section") not in LAB["sections"]: fail(f"{e['path']}: section {e.get('section')}")
    if e["path"].endswith(".zip") and e.get("bundle_for") != next(z["bundle_for"] for z in INV["zips"] if z["path"] == e["path"]): fail(f"{e['path']}: bundle_for {e.get('bundle_for')}")
    if not e.get("label"): fail(f"{e['path']}: no label")
    for fld in LABEL_FIELDS:
        v = e.get(fld)
        if v is not None and v not in LAB[fld]: fail(f"{e['path']}: {fld}={v!r} not in approved wording")

page = "".join(f.read_text() for f in sorted(PAGE_DIR.rglob("*.ts*")))
if "media-kit-manifest" not in page: fail("page does not import the manifest")
for lit in re.findall(r"/downloads/media-kit/[^\s'\"`)]*", page):
    if not (Path("public") / lit.lstrip("/")).exists() and "${" not in lit: fail(f"page hard-codes {lit}, which does not exist")
for lit in re.findall(r"""['"`](/images/[^\s'"`]+\.(?:png|jpg|svg))""", page):
    if not (Path("public") / lit.lstrip("/")).exists(): fail(f"page references missing {lit}")
for n in INV["usage_illustrations"]:
    if n not in page: fail(f"page does not use usage illustration {n}")
for jpg in re.findall(r"[^\s'\"`]+\.jpe?g", page):
    fail(f"page references a JPG ({jpg}); National Show is PNG only")
for needle in ("download", "width", "height", "format"):
    if needle not in page: fail(f"page never renders {needle}")

if fails:
    print("\n".join(fails[:40])); print(f"FAIL: {len(fails)} problem(s)"); sys.exit(1)
print(f"OK: manifest has {len(entries)} entries matching the inventory; labels approved; page is manifest-driven")
