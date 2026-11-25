"""Read a Word paragraph's text, the author's inline formatting, links and list numbering.

One reader for both sides of the copy-doc gate: import_legacy.py reads the legacy Drive doc with it,
and build_copy_doc.py's `check` reads the legacy doc and the built doc with it and compares them.

What it reads, per paragraph:
  - text: every character, including text inside content controls (w:sdt) and smart tags, which
    python-docx's `Paragraph.text` skips. A line break is "\n", a tab "\t".
  - runs: the paragraph cut into runs of equal DIRECT formatting (run properties written on the run
    itself, not inherited from a style). Carried attributes are listed in CARRIED; a hyperlink run
    also carries `link` (its URL, or "#anchor").
  - list: the paragraph's Word numbering (num id, level, number format, level text, start, bullet font).
  - problems: anything the copy doc cannot carry (tracked changes, fields, images, character styles
    other than Hyperlink, run properties outside CARRIED). The gate fails on any problem, so nothing
    the author wrote is dropped without a loud failure.
"""
from __future__ import annotations

from typing import Any

from docx.oxml.ns import qn

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R_ID = qn("r:id")

# Run properties carried as the author's own inline formatting. Booleans keep their explicit value
# (True, or False for an explicit "off"); the rest keep the attribute value.
BOOL_PROPS = ("b", "i", "caps", "smallCaps", "strike", "dstrike")
VALUE_PROPS = ("color", "sz", "highlight", "u", "vertAlign")
CARRIED = BOOL_PROPS + VALUE_PROPS
# Run properties that do not change what the reader sees in a left-to-right Latin document.
IGNORED_PROPS = {"bCs", "iCs", "szCs", "rtl", "lang", "noProof", "webHidden", "cs"}
# The typeface is a layout decision of the copy styles (v3: Fraunces and Karla), like the paragraph
# style it replaces; a run's own typeface (e.g. Google's "Arial Unicode MS" fallback for an arrow) is
# not carried. The reader counts each one in `typefaces` so the gate reports it rather than hiding it.
LAYOUT_PROPS = {"rFonts"}
# Paragraph-level wrappers whose content is read as part of the paragraph.
TRANSPARENT = {"sdt", "sdtContent", "smartTag", "customXml"}
# Markers with no text of their own.
MARKERS = {"pPr", "bookmarkStart", "bookmarkEnd", "proofErr", "commentRangeStart", "commentRangeEnd",
           "permStart", "permEnd", "sdtPr", "sdtEndPr", "smartTagPr", "customXmlPr", "lastRenderedPageBreak"}

_FALSE = {"0", "false", "off", "none"}


def _local(el) -> str:
    return el.tag.split("}", 1)[1] if "}" in el.tag else el.tag


def _rpr_attrs(rpr, in_link: bool, problems: list[str], layout: list[str]) -> dict[str, Any]:
    attrs: dict[str, Any] = {}
    if rpr is None:
        return attrs
    for child in rpr:
        name = _local(child)
        val = child.get(qn("w:val"))
        if name in BOOL_PROPS:
            attrs[name] = not (val is not None and val.lower() in _FALSE)
        elif name in VALUE_PROPS:
            if name == "color" and (val is None or val.lower() == "auto"):
                continue
            if name == "vertAlign" and val == "baseline":
                continue
            attrs[name] = val
        elif name == "rStyle":
            if not (in_link and val == "Hyperlink"):
                problems.append(f"character style {val!r} is not carried")
        elif name in LAYOUT_PROPS:
            layout.append(name)
        elif name not in IGNORED_PROPS:
            problems.append(f"run property <w:{name}> is not carried")
    return attrs


def _run_text(r, problems: list[str]) -> str:
    out: list[str] = []
    for child in r:
        name = _local(child)
        if name == "t":
            out.append(child.text or "")
        elif name in ("br", "cr"):
            kind = child.get(qn("w:type"))
            if kind in (None, "textWrapping"):
                out.append("\n")
            else:
                problems.append(f"{kind} break is not carried")
        elif name in ("tab", "ptab"):
            out.append("\t")
        elif name == "noBreakHyphen":
            out.append("-")
        elif name in ("rPr", "lastRenderedPageBreak"):
            continue
        else:
            problems.append(f"run content <w:{name}> is not carried")
    return "".join(out)


def _walk(el, part, link: str | None, segs: list[tuple[str, dict[str, Any]]], problems: list[str],
          layout: list[str]) -> None:
    for child in el:
        name = _local(child)
        if name == "r":
            attrs = _rpr_attrs(child.find(qn("w:rPr")), link is not None, problems, layout)
            if link is not None:
                attrs["link"] = link
            text = _run_text(child, problems)
            if text:
                segs.append((text, attrs))
        elif name == "hyperlink":
            rid = child.get(R_ID)
            anchor = child.get(qn("w:anchor"))
            url = part.rels[rid].target_ref if rid else f"#{anchor}"
            _walk(child, part, url, segs, problems, layout)
        elif name in TRANSPARENT:
            _walk(child, part, link, segs, problems, layout)
        elif name in MARKERS:
            continue
        else:
            problems.append(f"paragraph content <w:{name}> is not carried")


def merge(segs: list[tuple[str, dict[str, Any]]]) -> list[dict[str, Any]]:
    """Adjacent segments with equal attributes become one run: the canonical run list."""
    runs: list[dict[str, Any]] = []
    for text, attrs in segs:
        if runs and {k: v for k, v in runs[-1].items() if k != "text"} == attrs:
            runs[-1]["text"] += text
        else:
            runs.append({"text": text, **attrs})
    return runs


def slice_runs(runs: list[dict[str, Any]], start: int) -> list[dict[str, Any]]:
    """The canonical runs from character `start` on."""
    out: list[tuple[str, dict[str, Any]]] = []
    pos = 0
    for r in runs:
        text = r["text"]
        attrs = {k: v for k, v in r.items() if k != "text"}
        lo = max(start - pos, 0)
        if lo < len(text):
            out.append((text[lo:], attrs))
        pos += len(text)
    return merge(out)


def formatted(runs: list[dict[str, Any]]) -> bool:
    return any(len(r) > 1 for r in runs)


# ---- lists ---------------------------------------------------------------------------------------
def _style_numpr(style):
    while style is not None:
        ppr = style.element.pPr
        if ppr is not None and ppr.numPr is not None:
            return ppr.numPr
        style = style.base_style
    return None


def _numbering(doc):
    try:
        return doc.part.numbering_part.element
    except (KeyError, NotImplementedError):
        return None


def list_info(paragraph, doc) -> dict[str, Any] | None:
    ppr = paragraph._p.pPr
    numpr = ppr.numPr if ppr is not None and ppr.numPr is not None else _style_numpr(paragraph.style)
    if numpr is None or numpr.numId is None:
        return None
    num_id = str(numpr.numId.val)
    if num_id == "0":
        return None
    level = int(numpr.ilvl.val) if numpr.ilvl is not None else 0
    info: dict[str, Any] = {"num": num_id, "level": level}
    numbering = _numbering(doc)
    if numbering is None:
        info["format"] = None
        return info
    num = next((n for n in numbering.findall(qn("w:num")) if n.get(qn("w:numId")) == num_id), None)
    if num is None:
        info["format"] = None
        return info
    abs_id = num.find(qn("w:abstractNumId")).get(qn("w:val"))
    lvl = None
    start_override = None
    for ov in num.findall(qn("w:lvlOverride")):
        if ov.get(qn("w:ilvl")) == str(level):
            so = ov.find(qn("w:startOverride"))
            if so is not None:
                start_override = int(so.get(qn("w:val")))
            lvl = ov.find(qn("w:lvl"))
    if lvl is None:
        absn = next(a for a in numbering.findall(qn("w:abstractNum")) if a.get(qn("w:abstractNumId")) == abs_id)
        lvl = next((x for x in absn.findall(qn("w:lvl")) if x.get(qn("w:ilvl")) == str(level)), None)
    if lvl is None:
        info["format"] = None
        return info

    def val(tag: str) -> str | None:
        el = lvl.find(qn(tag))
        return None if el is None else el.get(qn("w:val"))

    fonts = lvl.find(qn("w:rPr") + "/" + qn("w:rFonts"))
    start = val("w:start")
    info.update({
        "format": val("w:numFmt") or "decimal",
        "text": val("w:lvlText"),
        "start": start_override if start_override is not None else (int(start) if start else 1),
        "font": None if fonts is None else fonts.get(qn("w:ascii")),
    })
    return info


# ---- paragraph-level layout ----------------------------------------------------------------------
# Paragraph properties handled elsewhere: the style (compared as a role class), the list (compared
# in full) and the paragraph-mark run properties (they format only the pilcrow, never visible text).
PPR_HANDLED = {"pStyle", "numPr", "rPr"}
# Properties that change the reading of the page, looked up through the paragraph style too.
STYLE_LAYOUT = ("jc", "pageBreakBefore", "outlineLvl")


def _attrs(el) -> str:
    parts = [f"{k.split('}', 1)[-1]}={v}" for k, v in sorted(el.attrib.items())]
    for child in el:
        parts.append(f"{_local(child)}({_attrs(child)})")
    return " ".join(parts) or "on"


def paragraph_layout(paragraph) -> list[tuple[str, str]]:
    """The paragraph's own layout properties as (property, value), e.g. ("ind", "left=720"), plus
    alignment, page break and outline level inherited from its style, as ("jc", "center (style Title)")."""
    out: list[tuple[str, str]] = []
    ppr = paragraph._p.pPr
    direct = set()
    if ppr is not None:
        for child in ppr:
            name = _local(child)
            if name in PPR_HANDLED:
                continue
            direct.add(name)
            out.append((name, _attrs(child)))
    style = paragraph.style
    while style is not None:
        sppr = style.element.pPr
        if sppr is not None:
            for name in STYLE_LAYOUT:
                el = sppr.find(qn(f"w:{name}"))
                if el is not None and name not in direct:
                    direct.add(name)
                    val = _attrs(el)
                    if not (name == "jc" and val in ("val=left", "val=start", "val=both")):
                        out.append((name, f"{val} (style {style.name})"))
        style = style.base_style
    return out


HEADING_STYLES = ("heading", "title", "subtitle")


def style_class(style_name: str | None, layout: list[tuple[str, str]]) -> str:
    """'heading' or 'body': the role class of a paragraph's style (an outline level counts as heading)."""
    name = (style_name or "").lower()
    if name.startswith(HEADING_STYLES) or name in ("copy heading", "copy card title"):
        return "heading"
    if any(prop == "outlineLvl" and not value.startswith("val=9") for prop, value in layout):
        return "heading"
    return "body"


# ---- document ------------------------------------------------------------------------------------
def read_paragraph(paragraph, doc) -> dict[str, Any]:
    problems: list[str] = []
    segs: list[tuple[str, dict[str, Any]]] = []
    layout: list[str] = []
    _walk(paragraph._p, paragraph.part, None, segs, problems, layout)
    runs = merge(segs)
    ppr = paragraph._p.pPr
    if ppr is not None and ppr.find(qn("w:pPrChange")) is not None:
        problems.append("tracked paragraph-property change is not carried")
    layout_props = paragraph_layout(paragraph)
    style_name = paragraph.style.name if paragraph.style is not None else None
    return {
        "text": "".join(r["text"] for r in runs),
        "runs": runs,
        "list": list_info(paragraph, doc),
        "style": paragraph.style.name if paragraph.style is not None else None,
        "problems": problems,
        "typefaces": len(layout),
        "layout": layout_props,
        "class": style_class(style_name, layout_props),
    }


def read_document(doc) -> tuple[list[dict[str, Any]], list[str]]:
    """Every body paragraph (same indexes as python-docx's doc.paragraphs) and body-level problems."""
    paras = [read_paragraph(p, doc) for p in doc.paragraphs]
    problems: list[str] = []
    for child in doc.element.body:
        name = _local(child)
        if name in ("p", "sectPr", "bookmarkStart", "bookmarkEnd"):
            continue
        text = "".join(t.text or "" for t in child.iter(qn("w:t")))
        problems.append(f"body-level <w:{name}> holding {text[:60]!r} is outside any paragraph")
    return paras, problems
