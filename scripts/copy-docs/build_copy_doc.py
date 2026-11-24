#!/usr/bin/env python3
"""Build a formatted copy-editing Word document from a structured content file.

A copy doc lays out one website page's copy in page order so a non-technical editor can change
the words directly in Google Drive. Each page section is a table: a dark section bar, then one row
per piece of text with the element ROLE on the left (grey, small) and the EDITABLE COPY on the right,
styled like it reads on the page (headings large and bold, leads larger than body, links underlined).
Text fed from elsewhere (show dates, venue) sits in a grey row marked "Not edited here".

Page copy in the source JSON is verbatim committee copy (docs/rules/no-invention.md). This script
never alters it; `check` proves the built docx carries exactly the copy strings of a reference doc.

Usage (needs python-docx: `python3 -m venv .venv && .venv/bin/pip install python-docx`):
  build_copy_doc.py build copy-docs/source/nos-landing.json copy-docs/nos-landing.docx
  build_copy_doc.py extract copy-docs/nos-landing.docx          # print copy strings, one per line
  build_copy_doc.py check copy-docs/nos-landing.docx --legacy old-flat.docx
  build_copy_doc.py check copy-docs/nos-landing.docx --json copy-docs/source/nos-landing.json

Source JSON shape:
  {"title": str, "key": [str, ...]?, "sections": [
     {"name": str, "where": str?, "elements": [
        {"role": str, "text": str, "editable": bool, "editedWhere": str|null,
         "style": "heading"|"lead"|"body"|"button"|"link"|"label"|"cardTitle"|"theme",
         "sameRow": bool?}]}]}
  `sameRow: true` puts the element in the same row as the one before it (a card's title + text).

Formatting uses only what survives Google Docs' Office-compat editor: tables with DXA widths,
clear shading, single borders, Arial, bold/italic/underline/colour. A4 portrait, 2 cm margins.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import TypedDict

try:
    import docx
    from docx.enum.style import WD_STYLE_TYPE
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor, Twips
    from docx.table import _Cell
    from docx.text.paragraph import Paragraph
except ImportError:  # fail loudly with the fix, not a bare traceback
    sys.exit("python-docx is required: python3 -m venv .venv && .venv/bin/pip install python-docx")


class Element(TypedDict, total=False):
    role: str
    text: str
    editable: bool
    editedWhere: str | None
    style: str
    sameRow: bool


class Section(TypedDict, total=False):
    name: str
    where: str
    elements: list[Element]


# ---- Layout tokens (neutral working-document palette; no SAOC brand fonts or colours) ----------
FONT = "Arial"
PAGE_W, PAGE_H = 11906, 16838          # A4 in twips
MARGIN = 1134                          # 2 cm
CONTENT_W = PAGE_W - 2 * MARGIN        # 9638
ROLE_W = 2155                          # ~3.8 cm role column
COPY_W = CONTENT_W - ROLE_W

INK = "202124"          # copy text: near-black, 16:1 on white
ROLE_INK = "5F6368"     # role labels: grey, 6:1 on ROLE_FILL
ROLE_FILL = "F1F3F4"
BAR_FILL = "3C4043"     # section bar: dark grey, white text 10:1
BAR_SUB = "E8EAED"      # section bar description, 8.6:1 on BAR_FILL
LOCKED_FILL = "E8EAED"  # copy cell of a not-edited-here row
LOCKED_INK = "5F6368"
LINK_INK = "1155CC"     # Google Docs' own link blue, 6.4:1 on white
RULE = "DADCE0"
KEY_FILL = "F8F9FA"

# Copy styles mirror the page hierarchy: (size pt, bold, italic, underline, colour)
COPY_STYLES: dict[str, tuple[float, bool, bool, bool, str]] = {
    "heading": (16, True, False, False, INK),
    "lead": (12.5, False, False, False, INK),
    "body": (11, False, False, False, INK),
    "cardTitle": (12, True, False, False, INK),
    "label": (10, True, False, False, INK),
    "button": (11, True, False, False, INK),
    "link": (12, True, False, True, LINK_INK),
    "theme": (11, False, True, False, INK),
}
NOTE_STYLE = "Copy Note"   # paragraphs in the copy column that are ours, not page copy
COPY_STYLE_PREFIX = "Copy "

# Key lines: text before the first ": " is set bold as a lead-in.
DEFAULT_KEY = [
    "How to use this document: each dark bar is one part of the web page, in the order it appears. "
    "The grey left column says what the text is (heading, lead, button and so on). The right column "
    "holds the words that appear on the website: edit those words directly.",
    "Not edited here: rows shaded grey come from elsewhere on the website; the note in the row says where.",
]


# ---- low-level XML helpers --------------------------------------------------------------------
def _set(el, tag: str, **attrs: str):
    child = el.find(qn(tag))
    if child is None:
        child = OxmlElement(tag)
        el.append(child)
    for k, v in attrs.items():
        child.set(qn(f"w:{k}"), v)
    return child


def shade(cell: _Cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    _set(tc_pr, "w:shd", val="clear", color="auto", fill=fill)


def set_cell_width(cell: _Cell, width: int) -> None:
    cell.width = Twips(width)
    tc_pr = cell._tc.get_or_add_tcPr()
    _set(tc_pr, "w:tcW", w=str(width), type="dxa")


def table_setup(table, widths: list[int]) -> None:
    tbl_pr = table._tbl.tblPr
    _set(tbl_pr, "w:tblW", w=str(sum(widths)), type="dxa")
    _set(tbl_pr, "w:tblLayout", type="fixed")
    borders = _set(tbl_pr, "w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        _set(borders, f"w:{edge}", val="single", sz="4", space="0", color=RULE)
    mar = _set(tbl_pr, "w:tblCellMar")
    for edge, v in (("top", 90), ("bottom", 90), ("left", 140), ("right", 140)):
        _set(mar, f"w:{edge}", w=str(v), type="dxa")
    grid = table._tbl.tblGrid
    for gc, w in zip(grid.findall(qn("w:gridCol")), widths):
        gc.set(qn("w:w"), str(w))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT


def row_flags(row, header: bool = False) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    _set(tr_pr, "w:cantSplit")          # keep a card on one page
    if header:
        _set(tr_pr, "w:tblHeader")      # repeat the section bar when a table runs over a page


def keep_with_next(p: Paragraph) -> None:
    p.paragraph_format.keep_with_next = True


def run(p: Paragraph, text: str, size: float, bold=False, italic=False, underline=False, colour=INK):
    r = p.add_run(text)
    r.font.name = FONT
    r._element.get_or_add_rPr()
    rfonts = _set(r._element.rPr, "w:rFonts")
    for a in ("ascii", "hAnsi", "cs", "eastAsia"):
        rfonts.set(qn(f"w:{a}"), FONT)
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.underline = underline
    r.font.color.rgb = RGBColor.from_string(colour)
    return r


def para_spacing(p: Paragraph, before: float = 0, after: float = 0, line: float = 1.2) -> None:
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line


# ---- styles -----------------------------------------------------------------------------------
def ensure_styles(d) -> None:
    """Named paragraph styles so `extract` can find copy; direct formatting carries the look."""
    styles = d.styles
    normal = styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(11)
    rpr = normal.element.get_or_add_rPr()
    rfonts = _set(rpr, "w:rFonts")
    for a in ("ascii", "hAnsi", "cs", "eastAsia"):
        rfonts.set(qn(f"w:{a}"), FONT)
    for name in [*(f"{COPY_STYLE_PREFIX}{k}" for k in COPY_STYLES), NOTE_STYLE, "Role Label", "Section Where", "Key"]:
        if name not in [s.name for s in styles]:
            s = styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
            s.base_style = normal
    for level, size in (("Heading 1", 20), ("Heading 2", 13)):
        h = styles[level]
        h.font.name = FONT
        h.font.size = Pt(size)
        h.font.bold = True
        h.font.color.rgb = RGBColor.from_string(INK)
        hr = h.element.get_or_add_rPr()
        hf = _set(hr, "w:rFonts")
        for a in ("ascii", "hAnsi", "cs", "eastAsia"):
            hf.set(qn(f"w:{a}"), FONT)


# ---- building blocks --------------------------------------------------------------------------
def add_spacer(d, pts: float = 14) -> None:
    p = d.add_paragraph()
    para_spacing(p, 0, 0, 1.0)
    run(p, "", 2)
    p.paragraph_format.space_after = Pt(pts)


def add_key(d, lines: list[str]) -> None:
    t = d.add_table(rows=1, cols=1)
    table_setup(t, [CONTENT_W])
    cell = t.rows[0].cells[0]
    set_cell_width(cell, CONTENT_W)
    shade(cell, KEY_FILL)
    for i, line in enumerate(lines):
        p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
        p.style = d.styles["Key"]
        para_spacing(p, 0, 4 if i < len(lines) - 1 else 0, 1.25)
        lead, sep, rest = line.partition(": ")
        if sep:
            run(p, lead + ":", 10, bold=True, colour=INK)
            run(p, " " + rest, 10, colour=INK)
        else:
            run(p, line, 10, colour=INK)


def add_section(d, number: int, section: Section) -> None:
    elements = section["elements"]
    rows: list[list[Element]] = []
    for e in elements:
        if e.get("sameRow") and rows:
            rows[-1].append(e)
        else:
            rows.append([e])

    t = d.add_table(rows=1 + len(rows), cols=2)
    table_setup(t, [ROLE_W, COPY_W])

    # Section bar: merged, dark, a real Heading 2 so Docs' outline lists every section.
    bar = t.rows[0].cells[0].merge(t.rows[0].cells[1])
    set_cell_width(bar, CONTENT_W)
    shade(bar, BAR_FILL)
    row_flags(t.rows[0], header=True)
    hp = bar.paragraphs[0]
    hp.style = d.styles["Heading 2"]
    para_spacing(hp, 0, 0, 1.15)
    keep_with_next(hp)
    run(hp, f"{number}.  {section['name']}", 13, bold=True, colour="FFFFFF")
    if section.get("where"):
        wp = bar.add_paragraph()
        wp.style = d.styles["Section Where"]
        para_spacing(wp, 1, 0, 1.15)
        keep_with_next(wp)
        run(wp, section["where"], 9.5, colour=BAR_SUB)

    for ri, group in enumerate(rows, start=1):
        row = t.rows[ri]
        row_flags(row)
        role_cell, copy_cell = row.cells
        set_cell_width(role_cell, ROLE_W)
        set_cell_width(copy_cell, COPY_W)
        shade(role_cell, ROLE_FILL)

        locked = any(not e.get("editable", True) for e in group)
        rp = role_cell.paragraphs[0]
        rp.style = d.styles["Role Label"]
        para_spacing(rp, 1, 0, 1.15)
        run(rp, group[0]["role"], 9, bold=True, colour=ROLE_INK)
        if locked:
            shade(copy_cell, LOCKED_FILL)

        for ei, e in enumerate(group):
            style = e.get("style", "body")
            if style not in COPY_STYLES:
                raise SystemExit(f"unknown style {style!r} in section {section['name']!r}")
            size, bold, italic, underline, colour = COPY_STYLES[style]
            if not e.get("editable", True):
                colour = LOCKED_INK
            p = copy_cell.paragraphs[0] if ei == 0 else copy_cell.add_paragraph()
            p.style = d.styles[f"{COPY_STYLE_PREFIX}{style}"]
            gap = 0 if ei == 0 else (2 if style == "body" and group[ei - 1].get("style") in ("cardTitle", "link") else 5)
            para_spacing(p, gap, 0, 1.3 if style in ("body", "lead") else 1.15)
            run(p, e["text"], size, bold, italic, underline, colour)
        for e in group:
            if not e.get("editable", True) and e.get("editedWhere"):
                np_ = copy_cell.add_paragraph()
                np_.style = d.styles[NOTE_STYLE]
                para_spacing(np_, 4, 0, 1.2)
                run(np_, "Not edited here. ", 9, bold=True, colour=LOCKED_INK)
                run(np_, str(e["editedWhere"]), 9, italic=True, colour=LOCKED_INK)
                break


def build(src: Path, out: Path) -> None:
    data = json.loads(src.read_text(encoding="utf-8"))
    d = docx.Document()
    sec = d.sections[0]
    sec.page_width, sec.page_height = Twips(PAGE_W), Twips(PAGE_H)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, side, Twips(MARGIN))
    ensure_styles(d)
    title = d.add_paragraph(style=d.styles["Heading 1"])
    para_spacing(title, 0, 10, 1.1)
    run(title, data["title"], 20, bold=True)
    add_key(d, data.get("key") or DEFAULT_KEY)
    add_spacer(d, 10)
    for n, section in enumerate(data["sections"], start=1):
        add_section(d, n, section)
        add_spacer(d)
    out.parent.mkdir(parents=True, exist_ok=True)
    d.save(str(out))
    print(f"wrote {out}")


# ---- extraction and identity check --------------------------------------------------------------
def extract_copy(path: Path) -> list[str]:
    """Copy strings of a built copy doc, in page order: copy-column paragraphs, minus our notes."""
    d = docx.Document(str(path))
    found: list[str] = []
    for t in d.tables:
        for row in t.rows:
            cells = row.cells
            if len(cells) < 2 or cells[0]._tc is cells[1]._tc:   # key table or merged section bar
                continue
            for p in cells[1].paragraphs:
                if p.style is not None and p.style.name.startswith(COPY_STYLE_PREFIX) and p.style.name != NOTE_STYLE:
                    found.append(p.text)
    return found


# The legacy flat doc wrote "Role: copy". These prefixes are role labels, not copy.
LEGACY_PREFIXES = (
    "Dates (from show settings): ", "Venue (from show settings): ", "Countdown label: ",
    "Heading: ", "Lede: ", "Lead: ", "Body: ", "Button: ", "Link: ", "Label: ", "Dates: ", "Theme: ",
)
# Legacy section headings that are also the section's on-page heading (page copy, not a label).
LEGACY_COPY_HEADINGS = {"Thirteen judging groups", "Plant Entry for SAOC Members"}


def extract_legacy(path: Path) -> list[str]:
    d = docx.Document(str(path))
    found: list[str] = []
    for p in d.paragraphs[1:]:      # [0] is the document title
        text = p.text
        if not text:
            continue
        if p.style.name.startswith("Heading"):
            if text in LEGACY_COPY_HEADINGS:
                found.append(text)
            continue
        for prefix in LEGACY_PREFIXES:
            if text.startswith(prefix):
                text = text[len(prefix):]
                break
        found.append(text)
    return found


def extract_json(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [e["text"] for s in data["sections"] for e in s["elements"]]


def check(built: Path, legacy: Path | None, src_json: Path | None) -> int:
    got = extract_copy(built)
    want = extract_legacy(legacy) if legacy else extract_json(src_json)  # type: ignore[arg-type]
    if got == want:
        print(f"OK: {len(got)} copy strings identical, same order ({built.name} vs {(legacy or src_json).name})")  # type: ignore[union-attr]
        return 0
    print(f"MISMATCH: built has {len(got)}, reference has {len(want)}")
    import difflib
    for line in difflib.unified_diff(want, got, "reference", "built", lineterm="", n=1):
        print(line)
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("source", type=Path)
    b.add_argument("out", type=Path)
    e = sub.add_parser("extract")
    e.add_argument("docx", type=Path)
    c = sub.add_parser("check")
    c.add_argument("docx", type=Path)
    g = c.add_mutually_exclusive_group(required=True)
    g.add_argument("--legacy", type=Path, help="old flat 'Role: copy' doc")
    g.add_argument("--json", type=Path, help="source JSON")
    a = ap.parse_args()
    if a.cmd == "build":
        build(a.source, a.out)
        return 0
    if a.cmd == "extract":
        for s in extract_copy(a.docx):
            print(s)
        return 0
    return check(a.docx, a.legacy, a.json)


if __name__ == "__main__":
    sys.exit(main())
