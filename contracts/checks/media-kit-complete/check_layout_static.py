#!/usr/bin/env python3
"""A12: Codi's pinned layout, as far as source can prove it (section order, ink picker, hash, sticky nav reuse, per-format download links, no tabs)."""
import json, re, sys
from pathlib import Path

LAB = json.loads(Path(".agent/memory/project/specs/media-kit-complete/goldens/labels.json").read_text())
src = "".join(f.read_text() for f in sorted(Path("app/(marketing)/media-kit").rglob("*.ts*")))
for d in ("components/media-kit",):
    if Path(d).is_dir(): src += "".join(f.read_text() for f in sorted(Path(d).rglob("*.ts*")))
fails = []
pos = []
for s in LAB["page_sections_in_order"]:
    m = re.search(r"""id=['"{`]+%s['"}`]""" % re.escape(s["id"]), src) or re.search(r"""['"]%s['"]""" % re.escape(s["id"]), src)
    if not m: fails.append(f"section id {s['id']} not found"); continue
    pos.append((m.start(), s["id"]))
    if s["heading"] not in src: fails.append(f"heading {s['heading']!r} not found")
if pos != sorted(pos):
    fails.append("section ids are not in the pinned order in source")
for phrase in ("Download everything (zip)", "Download this section (zip)", "On this page", "Quick start"):
    if phrase not in src: fails.append(f"missing {phrase!r}")
if not re.search(r"type=['\"]radio['\"]", src) or not ("radiogroup" in src.lower() or "<fieldset" in src):
    fails.append("duotone ink picker is not a radio group")
if not re.search(r"location\.hash|hashchange|history\.(replace|push)State", src): fails.append("ink selection is not reflected in the URL hash")
if "sticky" not in src: fails.append("no sticky On this page")
if not re.search(r"ExhibitorJumpNav|ShowJumpChips|<details", src): fails.append("r23 disclosure not reused/rebuilt as <details>")
if not re.search(r"focus-visible", src): fails.append("no visible focus ring styling")
if not re.search(r"<a\b[^>]*\bdownload\b", src, re.S): fails.append("no <a download> link")
if re.search(r"role=['\"]tab(list|panel)?['\"]|aria-selected", src): fails.append("tabs are forbidden by the layout ruling")
if fails:
    print("\n".join(fails)); sys.exit(1)
print("OK: pinned layout present in source")
