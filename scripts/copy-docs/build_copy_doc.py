#!/usr/bin/env python3
"""Build a formatted copy-editing Word document from a structured content file.

A copy doc lays out one website page's copy in page order so a non-technical editor can change
the words directly in Google Drive. It uses NO TABLES (Brad, 2026-11-25: tables are too hard to
edit): every line is a plain paragraph in a named paragraph style, so the editor can press Enter
anywhere to add a line and the new line keeps the formatting.

  - Section start: a dark, numbered Heading 2 bar, then a small grey "where it sits" line.
  - Role label:    a small bold grey capitals line (HEADING, LEAD, BUTTON ...) above its copy.
  - Copy:          styled like the page (headings large and bold, leads larger than body, links
                   underlined), set in from the margin behind a thin grey rule so the copy reads as
                   one column, separate from the labels.
  - Not edited here: text fed from elsewhere (show dates, venue) is grey-shaded, with a note saying
                   where it is changed.

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
  `sameRow: true` groups the element under the previous element's role label (a card's title + text).

All formatting lives in the paragraph styles (not on individual runs), so Enter carries it on in
Word and in Google Docs' Office-compat editor. Only what Google Docs keeps is used: Arial, bold,
italic, underline, colour, paragraph shading, paragraph borders, indents. A4 portrait, 2 cm margins.
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
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor, Twips
    from docx.styles.style import ParagraphStyle
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
COPY_INDENT = 397                      # 0.7 cm: copy column sits in from the labels

INK = "202124"          # copy text: near-black, 16:1 on white
ROLE_INK = "5F6368"     # role labels and notes: grey, 6.2:1 on white
BAR_FILL = "3C4043"     # section bar: dark grey, white text 10:1
LOCKED_FILL = "E8EAED"  # not-edited-here copy; LOCKED_INK on it is 5.2:1
LOCKED_INK = "5F6368"
LINK_INK = "1155CC"     # Google Docs' own link blue, 6.4:1 on white
RULE = "C4C7C5"         # thin rule left of the copy column
KEY_FILL = "F1F3F4"

# Copy styles mirror the page hierarchy:
#   key: (style name, size pt, bold, italic, underline, colour, space before, space after, line, next)
COPY_STYLES: dict[str, tuple[str, float, bool, bool, bool, str, float, float, float, str]] = {
    "heading":   ("Copy Heading",    16,   True,  False, False, INK,      0, 2, 1.15, "body"),
    "lead":      ("Copy Lead",       12.5, False, False, False, INK,      0, 4, 1.3,  "body"),
    "body":      ("Copy Body",       11,   False, False, False, INK,      0, 4, 1.3,  "body"),
    "cardTitle": ("Copy Card Title", 12,   True,  False, False, INK,      0, 1, 1.15, "body"),
    "label":     ("Copy Label",      10,   True,  False, False, INK,      0, 2, 1.15, "label"),
    "button":    ("Copy Button",     11,   True,  False, False, INK,      0, 2, 1.15, "button"),
    "link":      ("Copy Link",       12,   True,  False, True,  LINK_INK, 0, 1, 1.15, "body"),
    "theme":     ("Copy Theme",      11,   False, True,  False, INK,      0, 2, 1.3,  "theme"),
}
LOCKED_STYLE = "Copy Locked"   # page copy fed from elsewhere: counts as copy, but shaded grey
NOTE_STYLE = "Copy Note"       # our note under locked copy: NOT page copy
COPY_STYLE_PREFIX = "Copy "
ROLE_STYLE = "Role Label"
WHERE_STYLE = "Section Where"
KEY_STYLE = "Key"

# Key lines: text before the first ": " is set bold as a lead-in.
DEFAULT_KEY = [
    "How to use this document: each dark bar starts one part of the web page, in the order it "
    "appears. The small grey capitals say what the text below them is (heading, lead, button and so "
    "on). The text set in from the margin is the words on the website: edit them directly, and press "
    "Enter at the end of a line to add another line in the same style.",
    "Not edited here: grey-shaded text comes from elsewhere on the website; the note under it says where.",
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


def _ppr_insert(ppr, child) -> None:
    """Insert pBdr/shd in schema order: before spacing/ind/jc if present."""
    for later in ("w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap", "w:overflowPunct",
                  "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN", "w:bidi", "w:adjustRightInd",
                  "w:snapToGrid", "w:spacing", "w:ind", "w:contextualSpacing", "w:mirrorIndents",
                  "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment",
                  "w:textboxTightWrap", "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr",
                  "w:sectPr", "w:pPrChange"):
        found = ppr.find(qn(later))
        if found is not None:
            found.addprevious(child)
            return
    ppr.append(child)


def style_border(style: ParagraphStyle, sides: dict[str, tuple[int, int, str]]) -> None:
    """sides: {"left": (size eighths-pt, space pt, colour)}."""
    ppr = style.element.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        if side in sides:
            sz, space, colour = sides[side]
            b = OxmlElement(f"w:{side}")
            for k, v in (("val", "single"), ("sz", str(sz)), ("space", str(space)), ("color", colour)):
                b.set(qn(f"w:{k}"), v)
            bdr.append(b)
    _ppr_insert(ppr, bdr)


def style_shade(style: ParagraphStyle, fill: str) -> None:
    ppr = style.element.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    for k, v in (("val", "clear"), ("color", "auto"), ("fill", fill)):
        shd.set(qn(f"w:{k}"), v)
    # shd follows pBdr in the schema
    bdr = ppr.find(qn("w:pBdr"))
    if bdr is not None:
        bdr.addnext(shd)
    else:
        _ppr_insert(ppr, shd)


def force_font(rpr_parent) -> None:
    if hasattr(rpr_parent, "get_or_add_rPr"):
        rpr = rpr_parent.get_or_add_rPr()
    else:  # plain lxml element (docDefaults/rPrDefault)
        rpr = _set(rpr_parent, "w:rPr")
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)   # rFonts is the first child of rPr in the schema
    for a in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
        if rfonts.get(qn(f"w:{a}")) is not None:
            del rfonts.attrib[qn(f"w:{a}")]
    for a in ("ascii", "hAnsi", "cs", "eastAsia"):
        rfonts.set(qn(f"w:{a}"), FONT)


def define_style(d, name: str, *, size: float, bold=False, italic=False, underline=False,
                 colour=INK, before=0.0, after=0.0, line=1.15, left=0, keep_next=False,
                 caps=False, base: str = "Normal") -> ParagraphStyle:
    names = [s.name for s in d.styles]
    s = d.styles[name] if name in names else d.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    s.base_style = d.styles[base]
    s.quick_style = True
    f = s.font
    f.name = FONT
    force_font(s.element)
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.underline = underline
    f.all_caps = caps
    f.color.rgb = RGBColor.from_string(colour)
    pf = s.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    pf.left_indent = Twips(left)
    pf.keep_with_next = keep_next
    pf.widow_control = True
    return s


# ---- styles -----------------------------------------------------------------------------------
def ensure_styles(d) -> None:
    normal = d.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(11)
    force_font(normal.element)
    # docDefaults carry theme fonts in python-docx's template; pin them to Arial too.
    defaults = d.styles.element.find(qn("w:docDefaults"))
    if defaults is not None:
        rpr_default = defaults.find(qn("w:rPrDefault"))
        if rpr_default is not None:
            force_font(rpr_default)

    define_style(d, "Heading 1", size=20, bold=True, before=0, after=10, line=1.1, keep_next=True)

    # Section bar: dark shaded Heading 2 (Docs' outline lists every section). The same-colour
    # border with space pads the text inside the bar.
    h2 = define_style(d, "Heading 2", size=13, bold=True, colour="FFFFFF", before=22, after=0,
                      line=1.15, left=0, keep_next=True)
    pad = (4, 4, BAR_FILL)
    style_border(h2, {"top": pad, "left": pad, "bottom": pad, "right": pad})
    style_shade(h2, BAR_FILL)
    define_style(d, WHERE_STYLE, size=9.5, italic=True, colour=ROLE_INK, before=5, after=2,
                 line=1.15, keep_next=True)

    role = define_style(d, ROLE_STYLE, size=8, bold=True, colour=ROLE_INK, before=11, after=2,
                        line=1.0, keep_next=True, caps=True)

    rule = (8, 9, RULE)   # 1 pt rule, 9 pt clear of the text
    by_key: dict[str, ParagraphStyle] = {}
    for key, (name, size, bold, italic, underline, colour, before, after, line, _nxt) in COPY_STYLES.items():
        s = define_style(d, name, size=size, bold=bold, italic=italic, underline=underline,
                         colour=colour, before=before, after=after, line=line, left=COPY_INDENT)
        style_border(s, {"left": rule})
        by_key[key] = s
    for key, spec in COPY_STYLES.items():
        by_key[key].next_paragraph_style = by_key[spec[9]]
    role.next_paragraph_style = by_key["body"]

    locked = define_style(d, LOCKED_STYLE, size=11, colour=LOCKED_INK, before=0, after=0,
                          line=1.3, left=COPY_INDENT)
    style_border(locked, {"left": rule})
    style_shade(locked, LOCKED_FILL)
    note = define_style(d, NOTE_STYLE, size=9, italic=True, colour=LOCKED_INK, before=0, after=2,
                        line=1.2, left=COPY_INDENT)
    style_border(note, {"left": rule})
    style_shade(note, LOCKED_FILL)
    locked.next_paragraph_style = locked
    note.next_paragraph_style = by_key["body"]

    key = define_style(d, KEY_STYLE, size=10, colour=INK, before=0, after=0, line=1.3)
    kpad = (4, 6, KEY_FILL)
    style_border(key, {"top": kpad, "left": kpad, "bottom": kpad, "right": kpad})
    style_shade(key, KEY_FILL)


# ---- building blocks --------------------------------------------------------------------------
def para(d, style: str, text: str = "") -> Paragraph:
    p = d.add_paragraph(style=d.styles[style])
    if text:
        p.add_run(text)
    return p


def add_key(d, lines: list[str]) -> None:
    for line in lines:
        p = para(d, KEY_STYLE)
        lead, sep, rest = line.partition(": ")
        if sep:
            p.add_run(lead + ":").bold = True
            p.add_run(" " + rest)
        else:
            p.add_run(line)


def add_section(d, number: int, section: Section) -> None:
    para(d, "Heading 2", f"{number}.  {section['name']}")
    if section.get("where"):
        para(d, WHERE_STYLE, section["where"])

    groups: list[list[Element]] = []
    for e in section["elements"]:
        if e.get("sameRow") and groups:
            groups[-1].append(e)
        else:
            groups.append([e])

    for group in groups:
        para(d, ROLE_STYLE, group[0]["role"])
        for i, e in enumerate(group):
            style = e.get("style", "body")
            if style not in COPY_STYLES:
                raise SystemExit(f"unknown style {style!r} in section {section['name']!r}")
            if not e.get("editable", True):
                para(d, LOCKED_STYLE, e["text"])
            else:
                p = para(d, COPY_STYLES[style][0], e["text"])
                if i + 1 < len(group):
                    p.paragraph_format.keep_with_next = True   # keep a card together
        notes = [e["editedWhere"] for e in group if not e.get("editable", True) and e.get("editedWhere")]
        if notes:
            n = para(d, NOTE_STYLE)
            n.add_run("Not edited here. ").bold = True
            n.add_run(str(notes[0]))


def build(src: Path, out: Path) -> None:
    data = json.loads(src.read_text(encoding="utf-8"))
    d = docx.Document()
    sec = d.sections[0]
    sec.page_width, sec.page_height = Twips(PAGE_W), Twips(PAGE_H)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, side, Twips(MARGIN))
    ensure_styles(d)
    para(d, "Heading 1", data["title"])
    add_key(d, data.get("key") or DEFAULT_KEY)
    for n, section in enumerate(data["sections"], start=1):
        add_section(d, n, section)
    if d.tables:
        raise SystemExit("copy docs must not contain tables")
    out.parent.mkdir(parents=True, exist_ok=True)
    d.save(str(out))
    print(f"wrote {out}")


# ---- extraction and identity check --------------------------------------------------------------
def extract_copy(path: Path) -> list[str]:
    """Copy strings of a built copy doc, in page order: paragraphs in a Copy style, minus our notes."""
    d = docx.Document(str(path))
    if d.tables:
        raise SystemExit(f"{path} contains tables; copy docs are paragraph-only")
    return [
        p.text for p in d.paragraphs
        if p.style is not None and p.style.name.startswith(COPY_STYLE_PREFIX) and p.style.name != NOTE_STYLE
    ]


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
    ref = legacy if legacy is not None else src_json
    assert ref is not None  # argparse makes one of --legacy / --json required
    want = extract_legacy(ref) if legacy is not None else extract_json(ref)
    if got == want:
        print(f"OK: {len(got)} copy strings identical, same order ({built.name} vs {ref.name})")
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
