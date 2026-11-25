#!/usr/bin/env python3
"""Build a formatted copy-editing Word document from a structured content file.

A copy doc lays out one website page's copy in page order so a non-technical editor can change
the words directly in Google Drive. It uses NO TABLES (Brad, 2026-11-25: tables are too hard to
edit): every line is a plain paragraph in a named paragraph style, so the editor can press Enter
anywhere to add a line and the new line keeps the formatting.

  - Section start: a royal, numbered Heading 2 bar, then a small grey "where it sits" line.
  - Role label:    a small bold muted capitals line (HEADING, LEAD, BUTTON ...) above its copy.
  - Copy:          styled like the page (headings large and bold, leads larger than body, links
                   underlined), set in from the margin behind a thin olive rule so the copy reads as
                   one column, separate from the labels.
  - Not edited here: text fed from elsewhere (show dates, venue) sits on a pale gold tint, with a note saying
                   where it is changed.

Page copy in the source JSON is verbatim committee copy (docs/rules/no-invention.md). This script
never alters it; `check` proves the built docx carries exactly the copy strings of a reference doc.

Usage (needs python-docx: `python3 -m venv .venv && .venv/bin/pip install python-docx`):
  build_copy_doc.py build copy-docs/source/nos-landing.json copy-docs/nos-landing.docx
  build_copy_doc.py extract copy-docs/nos-landing.docx          # print copy strings, one per line
  build_copy_doc.py check copy-docs/nos-landing.docx --legacy old-flat.docx --source copy-docs/source/nos-landing.json
  build_copy_doc.py check copy-docs/nos-landing.docx --json copy-docs/source/nos-landing.json
  build_copy_doc.py same a.docx b.docx                          # every zip part byte-identical

Pages live in copy-docs/pages.json (page -> Drive fileId -> source JSON). A page's JSON is filled
from its legacy Drive doc by scripts/copy-docs/import_legacy.py, using the role map in the JSON.

Source JSON shape:
  {"title": str, "key": [str, ...]?, "sections": [
     {"name": str, "where": str?, "elements": [
        {"role": str, "text": str, "editable": bool, "editedWhere": str|null,
         "style": "heading"|"lead"|"body"|"button"|"link"|"label"|"cardTitle"|"theme",
         "sameRow": bool?, "legacyPara": int?, "legacyPrefix": str?}]}],
   "legacySectionLabels": [str, ...]?, "acceptedLayoutChanges": [...]?, "acceptedStyleChanges": [...]?}
  `sameRow: true` groups the element under the previous element's role label (a card's title + text).
  `acceptedAddition` {approvedBy, reason}: copy added after the legacy doc was written (an element with
  this has no `legacyPara`). The gate accepts exactly that text, and only with both fields filled.
  `legacyPara` / `legacyPrefix` are the role map import_legacy.py fills `text` from; the build ignores them.
  `legacySectionLabels`: exact text of the legacy doc's Heading-styled section titles that are labels
  of the old layout (dropped; the section bars replace them). Any other legacy line is copy.
  `acceptedLayoutChanges` [{para, property, reason, approvedBy?}] and `acceptedStyleChanges`
  [{para, from, to, reason}]: what the gate may accept as not carried (see gate()).

All layout formatting lives in the paragraph styles (not on individual runs), so Enter carries it on in
Word and in Google Docs' Office-compat editor. Only what Google Docs keeps is used: Google Fonts (Fraunces, Karla), bold,
italic, underline, colour, paragraph shading, paragraph borders, indents. A4 portrait, 2 cm margins.

v3.1 (Brad 2026-11-25): the AUTHOR'S OWN inline formatting is carried too, exactly as the legacy doc
had it. It is the only run-level formatting in a copy doc:
  - `runs` on an element (or `titleRuns` for the title): the copy cut into runs with the legacy run's
    direct bold, italic, underline, strike, caps, superscript/subscript, size, colour, highlight, and
    hyperlink URL. The runs' text joins to exactly `text`. Elements without `runs` are one plain run,
    so a page with no author formatting builds byte-identically to v3.
  - `list` on an element ({"num", "level"}) plus the JSON's `lists` table: real Word numbering, one
    Word list per legacy list, with the legacy number format, level text, start and bullet font.
  - Links get the "Hyperlink" character style (violet, underlined); it and the numbering are only
    added to a doc that has links or lists.
`check --legacy` is the v3.1 gate: per paragraph, the text, the formatted runs, the link targets and
the list level/format/grouping must equal the legacy doc's. Any loss fails it (see docfmt.py).
"""
from __future__ import annotations

import argparse
import difflib
import io
import json
import sys
import tempfile
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any, TypedDict

try:
    import docx
    from docx.enum.style import WD_STYLE_TYPE
    from docx.opc.constants import RELATIONSHIP_TYPE as RT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor, Twips
    from docx.styles.style import ParagraphStyle
    from docx.text.paragraph import Paragraph
    from docx.text.run import Run
except ImportError:  # fail loudly with the fix, not a bare traceback
    sys.exit("python-docx is required: python3 -m venv .venv && .venv/bin/pip install python-docx")

sys.path.insert(0, str(Path(__file__).resolve().parent))
import docfmt  # noqa: E402  (sibling module; path set just above)
import rawtext  # noqa: E402


class Element(TypedDict, total=False):
    role: str
    text: str
    editable: bool
    editedWhere: str | None
    style: str
    sameRow: bool
    legacyPara: int        # role map: index of the legacy doc paragraph this copy is sliced from
    legacyPrefix: str      # role map: the "Role: " prefix the legacy doc wrote before the copy
    acceptedAddition: dict[str, str]   # {approvedBy, reason}: copy the legacy doc never had (no legacyPara)
    runs: list[dict[str, Any]]   # v3.1: the author's inline formatting (docfmt canonical runs)
    list: dict[str, Any]         # v3.1: {"num": legacy list id, "level": int}


class Section(TypedDict, total=False):
    name: str
    where: str
    elements: list[Element]


# ---- Layout tokens: the NOS site palette and type (Brad 2026-11-25 lifted the neutral rule) -------
# Brad 2026-11-25: "add some of the site's styling". Every value below comes from the NOS site's
# own tokens and type roles: app/(nos)/national-show/nos-theme.css (palette, eyebrow/label role,
# Light display headings, olive-deep left rule of the hero facts) and nos-structure.css (.nos-hm-*
# lead/body/card roles on the landing page). Logo fonts are logo-only and never used here.
SERIF = "Fraunces"             # --font-nos-fraunces: headings, card titles (400)
SERIF_LIGHT = "Fraunces Light"  # Fraunces 300, the site's display weight (Docs maps "<Family> Light")
SANS = "Karla"                 # --font-nos-karla: body copy, labels, buttons
FONT = SANS                    # document default
PAGE_W, PAGE_H = 11906, 16838          # A4 in twips
MARGIN = 1134                          # 2 cm
COPY_INDENT = 397                      # 0.7 cm: copy column sits in from the labels

ROYAL = "211A57"        # --primary / --ink: headings; 15.6:1 on white
INK = "3A3654"          # --ink-700: body copy (ruling Q5); 11.4:1 on white
MUTED = "6A6780"        # --muted / --ink-500: labels, notes; 5.4:1 on white, 4.8:1 on BONE
IVORY = "FBFAF0"        # --ivory / --parchment: text on royal; 14.8:1
VIOLET = "7E3F97"       # --accent: the site's link underline / focus colour; 6.9:1 on white
OLIVE_DEEP = "7F7D33"   # --olive-deep: the hero facts' 1.5px left rule (decorative, not text)
BONE = "F3F2D6"         # --bone / --gold (pale gold): key box and not-edited-here tint

ROLE_INK = MUTED
BAR_FILL = ROYAL
LOCKED_FILL = BONE
LOCKED_INK = MUTED
RULE = OLIVE_DEEP
KEY_FILL = BONE

# Copy styles mirror the site's type roles:
#   key: (style name, font, size pt, bold, italic, underline, colour, before, after, line, next)
COPY_STYLES: dict[str, tuple[str, str, float, bool, bool, bool, str, float, float, float, str]] = {
    "heading":   ("Copy Heading",    SERIF_LIGHT, 18,   False, False, False, ROYAL,  0, 3, 1.15, "body"),
    "lead":      ("Copy Lead",       SERIF_LIGHT, 13,   False, False, False, INK,    0, 4, 1.38, "body"),
    "body":      ("Copy Body",       SANS,        11,   False, False, False, INK,    0, 4, 1.5,  "body"),
    "cardTitle": ("Copy Card Title", SERIF,       13,   False, False, False, ROYAL,  0, 1, 1.25, "body"),
    "label":     ("Copy Label",      SANS,        10.5, True,  False, False, INK,    0, 2, 1.3,  "label"),
    "button":    ("Copy Button",     SANS,        11,   True,  False, False, ROYAL,  0, 2, 1.3,  "button"),
    "link":      ("Copy Link",       SANS,        12,   True,  False, True,  VIOLET, 0, 1, 1.3,  "body"),
    "theme":     ("Copy Theme",      SERIF_LIGHT, 12,   False, True,  False, ROYAL,  0, 2, 1.42, "theme"),
}
LOCKED_STYLE = "Copy Locked"   # page copy fed from elsewhere: counts as copy, but shaded grey
NOTE_STYLE = "Copy Note"       # our note under locked copy: NOT page copy
COPY_STYLE_PREFIX = "Copy "
ROLE_STYLE = "Role Label"
WHERE_STYLE = "Section Where"
KEY_STYLE = "Key"

KEY_TITLE_STYLE = "Key Title"
LINK_CHAR_STYLE = "Hyperlink"   # character style of the author's links (only in docs with links)
LIST_STEP = 360                 # a list level's indent step and hanging indent, in twips

# Key: (title, text) pairs. Each is two paragraphs in their own styles, so nothing is run-formatted.
DEFAULT_KEY = [
    ("How to use this document",
     "Each dark blue bar starts one part of the web page, in the order it appears. The small grey "
     "capitals say what the text below them is (heading, lead, button and so on). The text set in "
     "from the margin, beside the thin line, is the words on the website: edit them directly, and "
     "press Enter at the end of a line to add another line in the same style."),
    ("Not edited here",
     "Text on a pale gold background comes from elsewhere on the website; the note under it says where."),
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


def force_font(rpr_parent, font: str = FONT) -> None:
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
        rfonts.set(qn(f"w:{a}"), font)


def define_style(d, name: str, *, font: str = SANS, size: float, bold=False, italic=False, underline=False,
                 colour=INK, before=0.0, after=0.0, line=1.15, left=0, keep_next=False,
                 caps=False, base: str = "Normal") -> ParagraphStyle:
    names = [s.name for s in d.styles]
    s = d.styles[name] if name in names else d.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    s.base_style = d.styles[base]
    s.quick_style = True
    f = s.font
    f.name = font
    force_font(s.element, font)
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
def ensure_styles(d, links: bool = False) -> None:
    normal = d.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(11)
    force_font(normal.element)
    # docDefaults carry theme fonts in python-docx's template; pin them to the body face too.
    defaults = d.styles.element.find(qn("w:docDefaults"))
    if defaults is not None:
        rpr_default = defaults.find(qn("w:rPrDefault"))
        if rpr_default is not None:
            force_font(rpr_default)

    define_style(d, "Heading 1", font=SERIF_LIGHT, size=21, colour=ROYAL, before=0, after=12,
                 line=1.15, keep_next=True)

    # Section bar: royal Heading 2 with ivory Fraunces (Docs' outline lists every section). The
    # same-colour border with space pads the text inside the bar.
    h2 = define_style(d, "Heading 2", font=SERIF, size=14, colour=IVORY, before=24, after=0,
                      line=1.2, left=0, keep_next=True)
    pad = (4, 4, BAR_FILL)
    style_border(h2, {"top": pad, "left": pad, "bottom": pad, "right": pad})
    style_shade(h2, BAR_FILL)
    define_style(d, WHERE_STYLE, font=SANS, size=9.5, italic=True, colour=ROLE_INK, before=5, after=2,
                 line=1.15, keep_next=True)

    # The site's label/eyebrow role: Karla, bold, small, uppercase (nos-theme.css .nos-label).
    role = define_style(d, ROLE_STYLE, font=SANS, size=8.5, bold=True, colour=ROLE_INK, before=12, after=2,
                        line=1.0, keep_next=True, caps=True)

    rule = (8, 9, RULE)    # 1 pt olive-deep rule (the hero facts' left rule), 9 pt clear of the text
    by_key: dict[str, ParagraphStyle] = {}
    for key, (name, font, size, bold, italic, underline, colour, before, after, line, _nxt) in COPY_STYLES.items():
        s = define_style(d, name, font=font, size=size, bold=bold, italic=italic, underline=underline,
                         colour=colour, before=before, after=after, line=line, left=COPY_INDENT)
        style_border(s, {"left": rule})
        s.paragraph_format.keep_together = True   # a copy paragraph never splits over a page
        by_key[key] = s
    for key, spec in COPY_STYLES.items():
        by_key[key].next_paragraph_style = by_key[spec[10]]
    role.next_paragraph_style = by_key["body"]

    locked = define_style(d, LOCKED_STYLE, font=SANS, size=11, colour=LOCKED_INK, before=0, after=0,
                          line=1.5, left=COPY_INDENT)
    style_border(locked, {"left": rule})
    style_shade(locked, LOCKED_FILL)
    note = define_style(d, NOTE_STYLE, font=SANS, size=9, italic=True, colour=LOCKED_INK, before=0, after=2,
                        line=1.2, left=COPY_INDENT)
    style_border(note, {"left": rule})
    style_shade(note, LOCKED_FILL)
    locked.next_paragraph_style = locked
    note.next_paragraph_style = by_key["body"]

    kpad = (4, 6, KEY_FILL)
    key_title = define_style(d, KEY_TITLE_STYLE, font=SANS, size=10, bold=True, colour=ROYAL,
                             before=0, after=0, line=1.3, keep_next=True)
    key = define_style(d, KEY_STYLE, font=SANS, size=10, colour=INK, before=0, after=3, line=1.35)
    for k in (key_title, key):
        style_border(k, {"top": kpad, "left": kpad, "bottom": kpad, "right": kpad})
        style_shade(k, KEY_FILL)
    key_title.next_paragraph_style = key
    key.next_paragraph_style = key

    if links:   # only a doc with links gets the style, so a doc without them builds as in v3
        link = d.styles.add_style(LINK_CHAR_STYLE, WD_STYLE_TYPE.CHARACTER)
        link.base_style = d.styles["Default Paragraph Font"]
        link.font.underline = True
        link.font.color.rgb = RGBColor.from_string(VIOLET)


# ---- building blocks --------------------------------------------------------------------------
def para(d, style: str, text: str = "", runs: list[dict[str, Any]] | None = None) -> Paragraph:
    p = d.add_paragraph(style=d.styles[style])
    if runs:
        if "".join(r["text"] for r in runs) != text:
            raise SystemExit(f"runs do not join to the element text: {text[:60]!r}")
        add_runs(p, runs)
    elif text:
        p.add_run(text)
    return p


# The author's run properties, written in the schema order of w:rPr (CT_RPr's EG_RPrBase).
RPR_ORDER = ("rStyle", "b", "i", "caps", "smallCaps", "strike", "dstrike", "color", "sz", "highlight",
             "u", "vertAlign")


def _rpr(run_el, attrs: dict[str, Any], link: bool) -> None:
    props = dict(attrs)
    if link:
        props["rStyle"] = LINK_CHAR_STYLE
    rpr = None
    for name in RPR_ORDER:
        if name not in props:
            continue
        if rpr is None:
            rpr = OxmlElement("w:rPr")
            run_el.insert(0, rpr)
        el = OxmlElement(f"w:{name}")
        value = props[name]
        if name in docfmt.BOOL_PROPS:
            if value is False:
                el.set(qn("w:val"), "0")
        else:
            el.set(qn("w:val"), str(value))
        rpr.append(el)


def add_runs(p: Paragraph, runs: list[dict[str, Any]]) -> None:
    """Append the author's runs; consecutive runs with the same link share one w:hyperlink."""
    unknown = {k for r in runs for k in r} - {"text", "link", *docfmt.CARRIED}
    if unknown:
        raise SystemExit(f"unknown run attributes {sorted(unknown)}")
    holder = None
    holder_url = None
    for r in runs:
        url = r.get("link")
        attrs = {k: v for k, v in r.items() if k not in ("text", "link")}
        if url is None:
            holder, holder_url = None, None
            parent = p._p
        else:
            if holder is None or holder_url != url:
                holder = OxmlElement("w:hyperlink")
                if url.startswith("#"):
                    holder.set(qn("w:anchor"), url[1:])
                else:
                    holder.set(qn("r:id"), p.part.relate_to(url, RT.HYPERLINK, is_external=True))
                p._p.append(holder)
                holder_url = url
            parent = holder
        run_el = OxmlElement("w:r")
        parent.append(run_el)
        Run(run_el, p).text = r["text"]     # "\n" becomes <w:br/>, "\t" <w:tab/>
        _rpr(run_el, attrs, url is not None)


def add_numbering(d, lists: dict[str, Any]) -> dict[str, str]:
    """One Word list per legacy list: legacy list id -> new numId. Indents keep the copy column."""
    numbering = d.part.numbering_part.element
    abs_ids = [int(a.get(qn("w:abstractNumId"))) for a in numbering.findall(qn("w:abstractNum"))]
    num_ids = [int(n.get(qn("w:numId"))) for n in numbering.findall(qn("w:num"))]
    next_abs, next_num = max(abs_ids, default=-1) + 1, max(num_ids, default=0) + 1
    first_num = numbering.find(qn("w:num"))
    mapping: dict[str, str] = {}
    for legacy_id, spec in lists.items():
        absn = OxmlElement("w:abstractNum")
        absn.set(qn("w:abstractNumId"), str(next_abs))
        mlt = OxmlElement("w:multiLevelType")
        mlt.set(qn("w:val"), "hybridMultilevel")
        absn.append(mlt)
        for level in sorted(spec["levels"], key=int):
            lv = spec["levels"][level]
            lvl = OxmlElement("w:lvl")
            lvl.set(qn("w:ilvl"), str(level))
            for tag, val in (("w:start", lv["start"]), ("w:numFmt", lv["format"]),
                             ("w:lvlText", lv["text"]), ("w:lvlJc", "left")):
                if val is None:
                    continue
                el = OxmlElement(tag)
                el.set(qn("w:val"), str(val))
                lvl.append(el)
            ppr = OxmlElement("w:pPr")
            ind = OxmlElement("w:ind")
            ind.set(qn("w:left"), str(COPY_INDENT + LIST_STEP * (int(level) + 1)))
            ind.set(qn("w:hanging"), str(LIST_STEP))
            ppr.append(ind)
            lvl.append(ppr)
            if lv.get("font"):
                rpr = OxmlElement("w:rPr")
                fonts = OxmlElement("w:rFonts")
                for a in ("ascii", "hAnsi"):
                    fonts.set(qn(f"w:{a}"), lv["font"])
                fonts.set(qn("w:hint"), "default")
                rpr.append(fonts)
                lvl.append(rpr)
            absn.append(lvl)
        if first_num is not None:
            first_num.addprevious(absn)   # every abstractNum precedes every num in the schema
        else:
            numbering.append(absn)
        num = OxmlElement("w:num")
        num.set(qn("w:numId"), str(next_num))
        ref = OxmlElement("w:abstractNumId")
        ref.set(qn("w:val"), str(next_abs))
        num.append(ref)
        numbering.append(num)
        mapping[legacy_id] = str(next_num)
        next_abs += 1
        next_num += 1
    return mapping


def set_list(p: Paragraph, num_id: str, level: int) -> None:
    ppr = p._p.get_or_add_pPr()
    numpr = OxmlElement("w:numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), str(level))
    nid = OxmlElement("w:numId")
    nid.set(qn("w:val"), num_id)
    numpr.append(ilvl)
    numpr.append(nid)
    pstyle = ppr.find(qn("w:pStyle"))
    if pstyle is not None:
        pstyle.addnext(numpr)
    else:
        ppr.insert(0, numpr)


def add_key(d, pairs: list[tuple[str, str]] | list[list[str]]) -> None:
    for title, text in pairs:
        para(d, KEY_TITLE_STYLE, title)
        para(d, KEY_STYLE, text)


def add_section(d, number: int, section: Section, list_ids: dict[str, str] | None = None) -> None:
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
                p = para(d, LOCKED_STYLE, e["text"], e.get("runs"))
            else:
                p = para(d, COPY_STYLES[style][0], e["text"], e.get("runs"))
                if i + 1 < len(group):
                    p.paragraph_format.keep_with_next = True   # keep a card together
            if e.get("list"):
                if not list_ids or e["list"]["num"] not in list_ids:
                    raise SystemExit(f"list {e['list']['num']!r} is not in the JSON's `lists` table")
                set_list(p, list_ids[e["list"]["num"]], int(e["list"]["level"]))
        notes = [e["editedWhere"] for e in group if not e.get("editable", True) and e.get("editedWhere")]
        if notes:
            para(d, NOTE_STYLE, f"Not edited here. {notes[0]}")


def build(src: Path, out: Path) -> None:
    data = json.loads(src.read_text(encoding="utf-8"))
    d = docx.Document()
    sec = d.sections[0]
    sec.page_width, sec.page_height = Twips(PAGE_W), Twips(PAGE_H)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, side, Twips(MARGIN))
    elements = [e for s in data["sections"] for e in s["elements"]]
    has_links = any("link" in r for e in elements for r in e.get("runs", [])) or \
        any("link" in r for r in data.get("titleRuns", []))
    ensure_styles(d, links=has_links)
    list_ids = add_numbering(d, data["lists"]) if data.get("lists") else None
    para(d, "Heading 1", data["title"], data.get("titleRuns"))
    add_key(d, data.get("key") or DEFAULT_KEY)
    for n, section in enumerate(data["sections"], start=1):
        add_section(d, n, section, list_ids)
    if d.tables:
        raise SystemExit("copy docs must not contain tables")
    out.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    d.save(buf)
    write_reproducible(buf.getvalue(), out)
    print(f"wrote {out}")


def write_reproducible(docx_bytes: bytes, out: Path) -> None:
    """Rewrite the zip with fixed entry timestamps so the same JSON always builds the same bytes."""
    src = zipfile.ZipFile(io.BytesIO(docx_bytes))
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for name in src.namelist():
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            dst.writestr(info, src.read(name))


def same_parts(a: Path, b: Path) -> int:
    """0 when both docx files hold the same parts, in the same order, byte for byte."""
    za, zb = zipfile.ZipFile(a), zipfile.ZipFile(b)
    if za.namelist() != zb.namelist():
        print(f"DIFFERENT part lists: {za.namelist()} vs {zb.namelist()}")
        return 1
    bad = [n for n in za.namelist() if za.read(n) != zb.read(n)]
    for n in bad:
        print(f"DIFFERENT part: {n}")
    if not bad:
        print(f"SAME: {len(za.namelist())} parts byte-identical ({a.name} vs {b.name})")
    return 1 if bad else 0


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


def _cut(runs: list[dict[str, Any]], end: int) -> list[dict[str, Any]]:
    """The canonical runs of the first `end` characters."""
    out: list[tuple[str, dict[str, Any]]] = []
    pos = 0
    for r in runs:
        if pos >= end:
            break
        out.append((r["text"][: end - pos], {k: v for k, v in r.items() if k != "text"}))
        pos += len(r["text"])
    return docfmt.merge(out)


LIST_KEYS = ("level", "format", "text", "start", "font")
# Pure spacing and indent may be accepted on a reason alone (the copy styles set them). Any other
# dropped paragraph property (alignment, page break, keep-with-next, outline level, borders, shading,
# section break, ...) can change how the page reads, so its acceptance must also name who approved it.
PURE_LAYOUT = {"ind", "spacing"}


def _own_paragraphs(path: Path) -> list[tuple[str, str]]:
    """(style, text) of the paragraphs the builder writes itself: the opening title and every
    paragraph in one of our non-copy styles."""
    paras = rawtext.paragraphs(path)
    own = [(style, text) for _, style, text in paras if style in rawtext.ADDED_STYLES]
    title = [(paras[0][1], paras[0][2])] if paras else []
    return title + own


def gate(built: Path, legacy: Path, source: Path) -> int:
    """v3.1.1 gate: every legacy line is carried, and per paragraph the text, the author's formatted
    runs, the link targets and the list level/format/grouping are identical. Per paragraph, every
    legacy paragraph property the built doc drops (alignment, indent, spacing, page break, keep, outline
    level, ... including those set by its style) fails unless the page JSON's acceptedLayoutChanges
    lists it with a reason, plus an approvedBy for anything other than ind or spacing; a heading/body
    role change fails unless acceptedStyleChanges lists it. Our own paragraphs must equal a fresh build
    from the JSON, and the raw-XML reader must find every story part's words. Any loss fails."""
    data = json.loads(source.read_text(encoding="utf-8"))
    ld, bd = docx.Document(str(legacy)), docx.Document(str(built))
    lparas, lprob = docfmt.read_document(ld)
    bparas, bprob = docfmt.read_document(bd)
    fails = [f"legacy: {x}" for x in lprob] + [f"built: {x}" for x in bprob]
    if bd.tables:
        fails.append("built doc contains tables")

    all_elements = [(s["name"], e) for s in data["sections"] for e in s["elements"]]
    elements = [(n, e) for n, e in all_elements if "acceptedAddition" not in e]
    additions = [(n, e) for n, e in all_elements if "acceptedAddition" in e]
    for n, e in additions:
        acc = e["acceptedAddition"]
        filled = all(isinstance(acc.get(k), str) and acc[k].strip() for k in ("approvedBy", "reason"))
        if not filled or "legacyPara" in e or not e.get("text"):
            fails.append(f"{n} / {e.get('role')}: acceptedAddition needs approvedBy and reason, "
                         f"text, and no legacyPara")
    mapped = {e["legacyPara"]: e for _, e in elements if isinstance(e.get("legacyPara"), int)}
    if len(mapped) != len(elements):
        fails.append("an element has no legacyPara, or two share one")
    title_is_copy = 0 in mapped
    section_labels = list(data.get("legacySectionLabels", []))
    labels_left = Counter(section_labels)   # each listed label covers exactly one legacy line

    # Legacy side: what must be carried, in order. Every non-empty line is copy, the title, or a
    # Heading-styled section label of the old layout (which must hold no formatting of its own).
    expected: list[tuple[str, int, str]] = []
    if not title_is_copy:
        expected.append(("title", 0, ""))
    expected += [(f"{name} / {e.get('role')}", e["legacyPara"], e.get("legacyPrefix", "")) for name, e in elements]
    for i, lp in enumerate(lparas):
        if not lp["text"]:
            if lp["list"]:
                fails.append(f"legacy paragraph {i} is an empty list item")
            continue
        if i in mapped or (i == 0 and not title_is_copy):
            continue
        if (lp["style"] or "").startswith("Heading") and labels_left[lp["text"]] > 0:
            labels_left[lp["text"]] -= 1
            if docfmt.formatted(lp["runs"]) or lp["list"] or lp["problems"]:
                fails.append(f"legacy label paragraph {i} {lp['text'][:40]!r} has formatting a label drops")
            continue
        why = " (a Heading line, but not (or no longer) listed in legacySectionLabels)" if (lp["style"] or "").startswith("Heading") else ""
        fails.append(f"legacy paragraph {i} {lp['text'][:60]!r} is not carried{why}")
    for i in mapped:
        if 0 <= i < len(lparas) and lparas[i]["text"] in section_labels:
            fails.append(f"legacy paragraph {i} is listed in legacySectionLabels but mapped as copy")

    # Built side: the title, then every paragraph in a Copy style except our notes.
    if not bparas or bparas[0]["style"] != "Heading 1":
        fails.append("built doc does not open with its Heading 1 title")
    body = [bp for bp in bparas if (bp["style"] or "").startswith(COPY_STYLE_PREFIX) and bp["style"] != NOTE_STYLE]
    if additions:
        # The built copy paragraphs run in element order: each accepted addition must be exactly its text.
        if len(body) != len(all_elements):
            fails.append(f"built has {len(body)} copy paragraphs, the JSON has {len(all_elements)} elements")
        else:
            kept = []
            for (_, e), bp in zip(all_elements, body):
                if "acceptedAddition" not in e:
                    kept.append(bp)
                elif bp["text"] != e["text"]:
                    fails.append(f"accepted addition TEXT differs: JSON {e['text']!r}, built {bp['text']!r}")
            body = kept
        print(f"accepted additions: {len(additions)}")
        for n, e in additions:
            print(f"  + {e['text'][:70]!r} (approved by {e['acceptedAddition'].get('approvedBy')})")
    got = ([bparas[0]] if not title_is_copy else []) + body
    if len(got) != len(expected):
        fails.append(f"built has {len(got)} copy paragraphs, legacy has {len(expected)}")

    # Explicit acceptances in the page JSON: layout the copy styles replace, and role-class changes.
    acc_layout: dict[tuple[int, str], dict[str, Any]] = {}
    for a in data.get("acceptedLayoutChanges", []):
        if not a.get("reason"):
            fails.append(f"acceptedLayoutChanges entry {a} has no reason")
        acc_layout[(a.get("para"), a.get("property"))] = a
    acc_style = {a.get("para"): a for a in data.get("acceptedStyleChanges", [])}
    used_layout: set[tuple[int, str]] = set()
    used_style: set[int] = set()
    dropped_layout: list[str] = []

    list_map: dict[str, str] = {}
    n_fmt = n_link = n_list = n_face = 0
    for (where, i, prefix), bp in zip(expected, got):
        lp = lparas[i]
        tag = f"[legacy {i}] {where}"
        fails += [f"{tag}: legacy {x}" for x in lp["problems"]] + [f"{tag}: built {x}" for x in bp["problems"]]
        if not lp["text"].startswith(prefix):
            fails.append(f"{tag}: legacy line does not start with its prefix {prefix!r}")
            continue
        if docfmt.formatted(_cut(lp["runs"], len(prefix))):
            fails.append(f"{tag}: the dropped prefix {prefix!r} carries formatting")
        want_text = lp["text"][len(prefix):]
        if bp["text"] != want_text:
            fails.append(f"{tag}: TEXT differs\n    legacy {want_text!r}\n    built  {bp['text']!r}")
            continue
        want_runs = docfmt.slice_runs(lp["runs"], len(prefix))
        if want_runs != bp["runs"]:
            fails.append(f"{tag}: FORMATTING differs\n    legacy {want_runs}\n    built  {bp['runs']}")
        n_fmt += docfmt.formatted(want_runs)
        n_face += lp["typefaces"]
        n_link += sum(1 for r in want_runs if "link" in r)

        # Paragraph-level layout: anything the legacy paragraph set that the built one does not.
        built_layout = set(bp["layout"])
        for prop, value in lp["layout"]:
            if (prop, value) in built_layout:
                continue
            key = (i, prop)
            line = f"[legacy {i}] {prop}: {value}"
            acc = acc_layout.get(key)
            if acc is None:
                fails.append(f"{tag}: LAYOUT dropped and not accepted: {prop} = {value}")
                dropped_layout.append(f"{line}  -> NOT ACCEPTED")
            elif prop not in PURE_LAYOUT and not acc.get("approvedBy"):
                fails.append(f"{tag}: LAYOUT {prop} = {value} needs an approvedBy in acceptedLayoutChanges")
                dropped_layout.append(f"{line}  -> accepted without approvedBy: FAIL")
            else:
                used_layout.add(key)
                dropped_layout.append(f"{line}  -> accepted: {acc['reason']}")

        # Role class of the style: a heading must stay a heading, body copy must stay body copy.
        lc, bc = lp["class"], bp["class"]
        if lc != bc:
            acc = acc_style.get(i)
            if acc is None or acc.get("from") != lc or acc.get("to") != bc or not acc.get("reason"):
                fails.append(f"{tag}: STYLE ROLE changed {lc} ({lp['style']}) -> {bc} ({bp['style']}) "
                             f"without a matching acceptedStyleChanges entry")
            else:
                used_style.add(i)

        ll, bl = lp["list"], bp["list"]
        if (ll is None) != (bl is None):
            fails.append(f"{tag}: LIST differs: legacy {ll}, built {bl}")
        elif ll is not None and bl is not None:
            n_list += 1
            if any(ll.get(k) != bl.get(k) for k in LIST_KEYS):
                fails.append(f"{tag}: LIST differs: legacy {ll}, built {bl}")
            if list_map.setdefault(ll["num"], bl["num"]) != bl["num"]:
                fails.append(f"{tag}: legacy list {ll['num']} is split across built lists")
    if len(set(list_map.values())) != len(list_map):
        fails.append("two legacy lists were merged into one built list")
    for key in acc_layout.keys() - used_layout:
        fails.append(f"acceptedLayoutChanges lists {key}, which is not a dropped property: remove it")
    for para in acc_style.keys() - used_style:
        fails.append(f"acceptedStyleChanges lists paragraph {para}, which has no role change: remove it")
    print(f"layout: {len(dropped_layout)} legacy paragraph propert{'y' if len(dropped_layout) == 1 else 'ies'} "
          f"not carried by the built doc")
    for line in dropped_layout:
        print(f"  {line}")

    # Independent second reader: raw w:t text from the XML of every text part, in order.
    prefixes = sorted({e.get("legacyPrefix", "") for _, e in elements} - {""})
    prefix_uses = sum(1 for _, e in elements if e.get("legacyPrefix"))
    raw_ok, raw_report = rawtext.check(legacy, built, prefixes, prefix_uses, section_labels, title_is_copy,
                                      [e["text"] for _, e in additions])
    for line in raw_report:
        print(line)
    if not raw_ok:
        fails.append("raw-XML text check failed (see the raw text lines above)")

    # Our own paragraphs (title, key, section bars, where-lines, role labels, notes) are skipped by the
    # text checks above, so they must be exactly what a fresh build from the page JSON writes: text
    # cannot be slipped into the doc under one of our styles.
    with tempfile.TemporaryDirectory() as tmp:
        fresh = Path(tmp) / "fresh.docx"
        build(source, fresh)
        want_own, got_own = _own_paragraphs(fresh), _own_paragraphs(built)
    if want_own != got_own:
        sm = difflib.SequenceMatcher(None, want_own, got_own, autojunk=False)
        for op, a1, a2, b1, b2 in sm.get_opcodes():
            if op != "equal":
                fails.append(f"OWN paragraphs differ from a fresh build: expected {want_own[a1:a2]}, "
                             f"built has {got_own[b1:b2]}")

    if fails:
        print(f"GATE FAIL: {len(fails)} problem(s) ({built.name} vs {legacy.name})")
        for f in fails:
            print(f"  - {f}")
        return 1
    print(f"GATE OK: {len(got)} paragraphs carried ({built.name} vs {legacy.name}): text identical, "
          f"{n_fmt} with author formatting identical, {n_link} link runs identical, "
          f"{n_list} list paragraphs in {len(list_map)} lists identical; "
          f"{n_face} run typeface override(s) replaced by the copy styles; {len(used_style)} accepted "
          f"role-class change(s), {len(used_layout)} accepted layout drop(s)")
    return 0


def extract_json(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [e["text"] for s in data["sections"] for e in s["elements"]]


def check(built: Path, legacy: Path | None, src_json: Path | None, source: Path | None = None) -> int:
    if legacy is not None:
        if source is None:
            raise SystemExit("check --legacy needs --source (the page JSON holding the role map)")
        return gate(built, legacy, source)
    assert src_json is not None  # argparse makes one of --legacy / --json required
    got, want = extract_copy(built), extract_json(src_json)
    if got == want:
        print(f"OK: {len(got)} copy strings identical, same order ({built.name} vs {src_json.name})")
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
    g.add_argument("--legacy", type=Path, help="the legacy Drive doc: runs the full v3.1 gate")
    g.add_argument("--json", type=Path, help="source JSON")
    c.add_argument("--source", type=Path, help="with --legacy (required): the page's source JSON (role map)")
    s = sub.add_parser("same")
    s.add_argument("a", type=Path)
    s.add_argument("b", type=Path)
    a = ap.parse_args()
    if a.cmd == "build":
        build(a.source, a.out)
        return 0
    if a.cmd == "extract":
        for line in extract_copy(a.docx):
            print(line)
        return 0
    if a.cmd == "same":
        return same_parts(a.a, a.b)
    return check(a.docx, a.legacy, a.json, a.source)


if __name__ == "__main__":
    sys.exit(main())
