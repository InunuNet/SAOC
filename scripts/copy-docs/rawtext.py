"""Independent raw-XML text check for copy docs (does not use python-docx's paragraph model).

Reads every w:t straight from the zip, in document order, from the body, every header and footer,
footnotes, endnotes, comments, text boxes (w:txbxContent) and content controls (w:sdt); fields and
hyperlinks are covered because their visible text is w:t too. Story parts are found by content type
and by file name, so a header or footer counts whether or not a section references it.

An mc:Fallback is skipped only when its mc:AlternateContent also has an mc:Choice (the Choice is the
copy that is read); a Fallback with no Choice is read AND fails the check, on either side. Text this
reader cannot carry fails rather than being guessed at: DrawingML a:t, math m:t and tracked-deletion
w:delText in any part, and w:t in any part that is not a story part.

The legacy doc's words, in order, must all appear in the new doc, in order, once the paragraphs we
add (title when it is the Drive name, key, section bars, where-lines, role labels, notes) are removed
from the new side. Words the old layout used as labels may go, and are listed. Both kinds apply to
body paragraphs of the main document only; anywhere else every word is copy:
  - a Heading-styled legacy line whose exact text the page JSON lists in `legacySectionLabels` (an
    old section title, now a section bar); any other Heading-styled line is copy, and
  - the "Role: " prefix (`legacyPrefix` in the page JSON, which must end in ": ") at the start of a
    legacy line; the number of lines it is set aside on must equal the number of elements that
    declare one.
Any other legacy word that is missing is a loss, and any word the new doc adds outside our own
paragraphs is invented copy: either fails the check. Any text outside the main body, on either
side, also fails: a copy doc carries body text only.
"""
from __future__ import annotations

import difflib
import re
from collections import Counter
import zipfile
from pathlib import Path

from lxml import etree

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
NS = {"w": W}
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
M = "http://schemas.openxmlformats.org/officeDocument/2006/math"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
PART = re.compile(r"^word/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$")
STORY_TYPES = ("document.main+xml", "template.main+xml", "header+xml", "footer+xml", "footnotes+xml",
               "endnotes+xml", "comments+xml")
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


def story_parts(z: zipfile.ZipFile) -> tuple[list[str], list[str]]:
    """(story parts to read, main part first; other parts that hold text and are not read)."""
    names = set(z.namelist())
    stories = {n for n in names if PART.match(n)}
    main = {"word/document.xml"} & names
    if "[Content_Types].xml" in names:
        for o in etree.fromstring(z.read("[Content_Types].xml")).iter(f"{{{CT}}}Override"):
            ctype, part = o.get("ContentType", ""), o.get("PartName", "").lstrip("/")
            if part in names and ctype.startswith("application/vnd.openxmlformats-officedocument.wordprocessingml"):
                if ctype.endswith(STORY_TYPES):
                    stories.add(part)
                if ctype.endswith(STORY_TYPES[:2]):
                    main.add(part)
    unread = []
    for n in sorted(names - stories):
        if not n.endswith(".xml") and not n.endswith(".rels"):
            continue
        root = etree.fromstring(z.read(n))
        if any((t.text or "").strip() for t in root.iter(f"{{{W}}}t", f"{{{A}}}t")):
            unread.append(n)
    return sorted(stories, key=lambda n: (n not in main, n)), unread


def _shadowed(el) -> bool:
    """True when el sits in an mc:Fallback whose AlternateContent also has an mc:Choice."""
    for a in el.iterancestors(f"{{{MC}}}Fallback"):
        parent = a.getparent()
        if parent is not None and parent.find(f"{{{MC}}}Choice") is not None:
            return True
    return False


def problems(path: Path) -> list[str]:
    """Text this reader will not carry: fails the check wherever it is found."""
    z = zipfile.ZipFile(path)
    stories, unread = story_parts(z)
    out = [f"UNREAD text part: {n}" for n in unread]
    for part in stories:
        root = etree.fromstring(z.read(part))
        for tag, what in ((f"{{{A}}}t", "DrawingML a:t"), (f"{{{M}}}t", "math m:t"),
                          (f"{{{W}}}delText", "tracked deletion w:delText")):
            for el in root.iter(tag):
                if (el.text or "").strip() and not _shadowed(el):
                    out.append(f"{what} text in {part}: {el.text.strip()[:60]!r}")
        for fb in root.iter(f"{{{MC}}}Fallback"):
            parent = fb.getparent()
            if parent is not None and parent.find(f"{{{MC}}}Choice") is None and not _shadowed(fb):
                text = " ".join((t.text or "") for t in fb.iter(f"{{{W}}}t", f"{{{A}}}t")).strip()
                if text:
                    out.append(f"mc:Fallback with no mc:Choice holds text in {part}: {text[:60]!r}")
    return out


def paragraphs(path: Path) -> list[tuple[str, str, str]]:
    """(part, style name, text) for every w:p in every story part, main document first."""
    z = zipfile.ZipFile(path)
    names = _style_names(z)
    order, _ = story_parts(z)
    out = []
    for part in order:
        root = etree.fromstring(z.read(part))
        for p in root.iter(f"{{{W}}}p"):
            if _shadowed(p):
                continue
            chunks = []
            for el in p.iter(f"{{{W}}}t", f"{{{W}}}tab", f"{{{W}}}br", f"{{{W}}}cr"):
                # only this paragraph's own text: a text box nested in a run has its own w:p
                owner = next(el.iterancestors(f"{{{W}}}p"))
                if owner is not p or _shadowed(el):
                    continue
                chunks.append((el.text or "") if el.tag == f"{{{W}}}t" else " ")
            ps = p.find("w:pPr/w:pStyle", NS)
            style = names.get(ps.get(f"{{{W}}}val"), ps.get(f"{{{W}}}val")) if ps is not None else "Normal"
            out.append((part, (style or "Normal").lower(), "".join(chunks)))
    return out


def check(legacy: Path, built: Path, prefixes: list[str], prefix_uses: int, section_labels: list[str],
          title_from_drive_name: bool) -> tuple[bool, list[str]]:
    lp = paragraphs(legacy)
    bp = paragraphs(built)
    lmain, bmain = (lp[0][0] if lp else ""), (bp[0][0] if bp else "")
    bad = [f"{side}: {x}" for side, path in (("legacy", legacy), ("built", built)) for x in problems(path)]
    bad += [f"legacyPrefix {pre!r} does not end in ': ' (a prefix must be a whole 'Role: ' label)"
            for pre in prefixes if not pre.endswith(": ") or len(pre) < 3]
    # A copy doc is body text only: header, footer, footnote, endnote or comment text on either side
    # is never carried by the builder, so it fails even when the words also occur in the body.
    outside = [(side, part, style, text) for side, ps, main in (("legacy", lp, lmain), ("built", bp, bmain))
               for part, style, text in ps if text.strip() and part != main]
    # Legacy words, each tagged with whether the old layout used it as a label (main body only).
    ltoks: list[tuple[str, str, int]] = []   # (word, kind, legacy paragraph number)
    n_prefixed = 0
    labels_left = Counter(section_labels)   # each listed label covers exactly one legacy line
    for i, (part, style, text) in enumerate(lp):
        words = text.split()
        label_upto = 0
        if part == lmain and i > 0:
            if style.startswith("heading") and labels_left[text] > 0:
                labels_left[text] -= 1
                label_upto = len(words)
            else:
                for pre in sorted(prefixes, key=len, reverse=True):
                    if pre.endswith(": ") and text.startswith(pre):
                        label_upto = len(pre.split())
                        n_prefixed += 1
                        break
        for j, w in enumerate(words):
            ltoks.append((w, "label" if j < label_upto else "copy", i))
    bad += [f"legacySectionLabels lists {t!r} {n} more time(s) than the legacy body has it as a Heading line"
            for t, n in labels_left.items() if n > 0]
    if n_prefixed != prefix_uses:
        bad.append(f"a 'Role: ' prefix was set aside on {n_prefixed} legacy lines, but {prefix_uses} elements "
                   f"declare one: a prefix matched a line it does not belong to")
    first_h1 = True
    btoks: list[str] = []
    for part, style, text in bp:
        if part == bmain and style in ADDED_STYLES:
            continue
        if part == bmain and style == "heading 1" and first_h1:
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
    report += [f"  OUTSIDE the body on {side} side: {part} ({'HEADING-styled ' if st.startswith('heading') else ''}"
               f"{st}): {text!r}" for side, part, st, text in outside]
    report += [f"  CANNOT CARRY {x}" for x in bad]
    return not lost and not added and not outside and not bad, report
