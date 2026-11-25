"""Independent raw-XML text check for copy docs (does not use python-docx's paragraph model).

Reads every w:t straight from the zip, in document order, from the body, headers, footers,
footnotes, endnotes, text boxes (w:txbxContent) and content controls (w:sdt); fields and hyperlinks
are covered because their visible text is w:t too. mc:Fallback copies of text boxes are skipped so a
box is not read twice. Comments are not page text and are not read.

The legacy doc's words, in order, must all appear in the new doc, in order, once the paragraphs we
add (title when it is the Drive name, key, section bars, where-lines, role labels, notes) are removed
from the new side. Words the old layout used as labels are allowed to go, and are listed:
  - words of a Heading-styled legacy paragraph (an old section title, now a section bar), unless the
    page JSON lists it in `legacyCopyHeadings` (it is also on-page copy), and
  - the "Role: " prefix words (`legacyPrefix` in the page JSON) at the start of a legacy line.
Any other legacy word that is missing is a loss, and any word the new doc adds outside our own
paragraphs is invented copy: either fails the check.
"""
from __future__ import annotations

import difflib
import re
import zipfile
from pathlib import Path

from lxml import etree

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
NS = {"w": W}
PART = re.compile(r"^word/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$")
ADDED_STYLES = {"key", "key title", "heading 2", "section where", "role label", "copy note"}   # lower case


def _style_names(z: zipfile.ZipFile) -> dict[str, str]:
    if "word/styles.xml" not in z.namelist():
        return {}
    root = etree.fromstring(z.read("word/styles.xml"))
    out = {}
    for s in root.iter(f"{{{W}}}style"):
        name = s.find(f"{{{W}}}name")
        out[s.get(f"{{{W}}}styleId")] = name.get(f"{{{W}}}val") if name is not None else s.get(f"{{{W}}}styleId")
    return out


def paragraphs(path: Path) -> list[tuple[str, str, str]]:
    """(part, style name, text) for every w:p in every text part, in document order."""
    z = zipfile.ZipFile(path)
    names = _style_names(z)
    order = sorted((n for n in z.namelist() if PART.match(n)), key=lambda n: (n != "word/document.xml", n))
    out = []
    for part in order:
        root = etree.fromstring(z.read(part))
        for p in root.iter(f"{{{W}}}p"):
            if any(a.tag == f"{{{MC}}}Fallback" for a in p.iterancestors()):
                continue
            chunks = []
            for el in p.iter(f"{{{W}}}t", f"{{{W}}}tab", f"{{{W}}}br", f"{{{W}}}cr"):
                # only this paragraph's own text: a text box nested in a run has its own w:p
                owner = next(el.iterancestors(f"{{{W}}}p"))
                if owner is not p or any(a.tag == f"{{{MC}}}Fallback" for a in el.iterancestors()):
                    continue
                chunks.append((el.text or "") if el.tag == f"{{{W}}}t" else " ")
            ps = p.find("w:pPr/w:pStyle", NS)
            style = names.get(ps.get(f"{{{W}}}val"), ps.get(f"{{{W}}}val")) if ps is not None else "Normal"
            out.append((part, (style or "Normal").lower(), "".join(chunks)))
    return out


def check(legacy: Path, built: Path, prefixes: list[str], title_from_drive_name: bool,
          copy_headings: set[str] = frozenset()) -> tuple[bool, list[str]]:
    lp = paragraphs(legacy)
    bp = paragraphs(built)
    # Legacy words, each tagged with whether the old layout used it as a label.
    ltoks: list[tuple[str, str, int]] = []   # (word, kind, legacy paragraph number)
    for i, (_, style, text) in enumerate(lp):
        words = text.split()
        label_upto = 0
        if style.startswith("heading") and i > 0 and text not in copy_headings:
            label_upto = len(words)
        else:
            for pre in sorted(prefixes, key=len, reverse=True):
                if pre and text.startswith(pre):
                    label_upto = len(pre.split())
                    break
        for j, w in enumerate(words):
            ltoks.append((w, "label" if j < label_upto else "copy", i))
    first_h1 = True
    btoks: list[str] = []
    for _, style, text in bp:
        if style in ADDED_STYLES:
            continue
        if style == "heading 1" and first_h1:
            first_h1 = False
            if title_from_drive_name:
                continue
        btoks += text.split()
    # Label words are set aside before matching, so a dropped label can never "use up" a copy word.
    labels = [(i, w) for w, kind, i in ltoks if kind == "label"]
    copy = [(w, i) for w, kind, i in ltoks if kind == "copy"]
    sm = difflib.SequenceMatcher(None, [w for w, _ in copy], btoks, autojunk=False)
    lost, added = [], []
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op in ("delete", "replace"):
            lost += [(i, w) for w, i in copy[a1:a2]]
        if op in ("insert", "replace"):
            added.append(" ".join(btoks[b1:b2]))

    def runs(items: list[tuple[int, str]]) -> list[str]:
        out: dict[int, list[str]] = {}
        for i, w in items:
            out.setdefault(i, []).append(w)
        return [f"legacy para {i} ({lp[i][0].split('/')[-1]}): {' '.join(ws)!r}" for i, ws in out.items()]

    report = [f"raw text: legacy {len(copy)} copy words (+{len(labels)} old-layout label words) in {len(lp)} "
              f"paragraphs; built {len(btoks)} copy words; lost {len(lost)}, added {sum(len(a.split()) for a in added)}"]
    report += [f"  LOST {x}" for x in runs(lost)]
    report += [f"  label dropped by design {x}" for x in runs(labels)]
    report += [f"  added on built side: {a!r}" for a in added]
    return not lost and not added, report
