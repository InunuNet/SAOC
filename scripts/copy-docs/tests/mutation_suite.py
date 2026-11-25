"""Mutation suite for the copy-doc gate (v3.1.1, QA gaps 1-4).

Takes the Privacy page (legacy .docx, the built/live .docx, the page JSON), writes mutated copies
and runs the gate on each, serially; one line per case with the expected and actual verdict.
Exit 0 only when every case behaves as expected.

    python scripts/copy-docs/tests/mutation_suite.py LEGACY.docx BUILT.docx copy-docs/source/privacy.json OUT_DIR
"""
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

if len(sys.argv) != 5:
    sys.exit(__doc__)
WT = Path(__file__).resolve().parents[3]
PY = sys.executable
GATE = str(WT / "scripts/copy-docs/build_copy_doc.py")
LEG, BUILT, SRC, OUT = (Path(a).resolve() for a in sys.argv[1:5])
OUT.mkdir(exist_ok=True)
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
ANCHOR = "We do not sell personal information."
REL_HDR = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CT_PFX = "application/vnd.openxmlformats-officedocument.wordprocessingml."


def story(tag: str, text: str, inner: str = "") -> bytes:
    if tag in ("footnotes", "endnotes"):
        one = tag[:-1]
        body = (f'<w:{one} w:id="1"><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:{one}>')
    elif tag == "comments":
        body = (f'<w:comment w:id="0" w:author="x" w:date="2026-11-25T00:00:00Z"><w:p><w:r><w:t>{text}'
                f'</w:t></w:r></w:p></w:comment>')
    else:
        body = f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>"
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:{tag} {W}>{body}{inner}</w:{tag}>'.encode()


def mutate(src: Path, out: Path, fn) -> Path:
    z = zipfile.ZipFile(src)
    parts = {n: z.read(n) for n in z.namelist()}
    fn(parts)
    with zipfile.ZipFile(out, "w") as o:
        for n, b in parts.items():
            o.writestr(n, b)
    return out


def edit(parts, name, f):
    parts[name] = f(parts[name].decode()).encode()


def add_part(parts, name, data, ctype=None, rel_type=None, rid="rIdMut1"):
    parts[name] = data
    if ctype:
        edit(parts, "[Content_Types].xml", lambda s: s.replace(
            "</Types>", f'<Override PartName="/{name}" ContentType="{CT_PFX}{ctype}"/></Types>'))
    if rel_type:
        edit(parts, "word/_rels/document.xml.rels", lambda s: s.replace(
            "</Relationships>", f'<Relationship Id="{rid}" Type="{REL_HDR}/{rel_type}" '
                                f'Target="{name.split("/", 1)[1]}"/></Relationships>'))


def anchor_para(doc: str) -> tuple[int, int]:
    i = doc.index(ANCHOR)
    start = max(doc.rfind("<w:p ", 0, i), doc.rfind("<w:p>", 0, i))
    return start, doc.index("</w:p>", i) + len("</w:p>")


def set_ppr(doc: str, xml: str) -> str:
    a, b = anchor_para(doc)
    p = doc[a:b]
    p = p.replace("<w:pPr>", f"<w:pPr>{xml}", 1) if "<w:pPr>" in p else re.sub(r"(<w:p[^>]*>)", rf"\1<w:pPr>{xml}</w:pPr>", p, 1)
    return doc[:a] + p + doc[b:]


def after_anchor(doc: str, xml: str) -> str:
    _, b = anchor_para(doc)
    return doc[:b] + xml + doc[b:]


TXBX = ('<w:p><w:pPr><w:pStyle w:val="CopyBody"/></w:pPr><w:r><mc:AlternateContent '
        'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="wps">'
        '<w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData>'
        '<wps:wsp xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx>'
        '<w:txbxContent><w:p><w:r><w:t>Invented boxed copy.</w:t></w:r></w:p></w:txbxContent></wps:txbx>'
        '</wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice></mc:AlternateContent>'
        '</w:r></w:p>')
SMARTART = (b'<?xml version="1.0" encoding="UTF-8"?><dgm:dataModel '
            b'xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" '
            b'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst><dgm:pt><dgm:t>'
            b'<a:p><a:r><a:t>Hidden diagram copy</a:t></a:r></a:p></dgm:t></dgm:pt></dgm:ptLst></dgm:dataModel>')
SECT_FTR = '<w:footerReference w:type="default" r:id="rIdMut1" xmlns:r="' + REL_HDR + '"/>'

CASES = []  # (name, side, mutation fn or json fn, expected)


def case(name, side, expect="FAIL"):
    def deco(fn):
        CASES.append((name, side, fn, expect))
        return fn
    return deco


@case("control: unmutated live privacy", "none", "OK")
def _c(p): pass

# ---- gap 1: story parts on the legacy side
@case("G1 legacy footer via footerReference", "legacy")
def _(p):
    add_part(p, "word/footer1.xml", story("ftr", "SAOC Privacy Policy, footer line"), "footer+xml", "footer")
    edit(p, "word/document.xml", lambda s: re.sub(r"(<w:sectPr[^>]*>)", rf"\1{SECT_FTR}", s, 1))

@case("G1 legacy footer part, no reference, content type only", "legacy")
def _(p): add_part(p, "word/footer2.xml", story("ftr", "Unreferenced footer text"), "footer+xml")

@case("G1 legacy footer part, odd name, no rel, no content type", "legacy")
def _(p): add_part(p, "word/extra/ftrA.xml", story("ftr", "Orphan footer text"))

@case("G1 legacy header via relationship only", "legacy")
def _(p): add_part(p, "word/header1.xml", story("hdr", "Header words"), "header+xml", "header")

@case("G1 legacy footnotes", "legacy")
def _(p): add_part(p, "word/footnotes.xml", story("footnotes", "A footnote the copy doc drops"), "footnotes+xml", "footnotes")

@case("G1 legacy endnotes", "legacy")
def _(p): add_part(p, "word/endnotes.xml", story("endnotes", "An endnote the copy doc drops"), "endnotes+xml", "endnotes")

@case("G1 legacy comments", "legacy")
def _(p): add_part(p, "word/comments.xml", story("comments", "Reviewer note on clause 2"), "comments+xml", "comments")

@case("G1 legacy footer repeating body words (dup of body text)", "legacy")
def _(p): add_part(p, "word/footer1.xml", story("ftr", ANCHOR), "footer+xml", "footer")

@case("G1 legacy SmartArt data part with a:t text", "legacy")
def _(p): add_part(p, "word/diagrams/data1.xml", SMARTART)

# ---- gap 2: paragraph layout on the legacy side
@case("G2 legacy jc=center on a mapped body paragraph", "legacy")
def _(p): edit(p, "word/document.xml", lambda s: set_ppr(s, '<w:jc w:val="center"/>'))

@case("G2 legacy jc=right", "legacy")
def _(p): edit(p, "word/document.xml", lambda s: set_ppr(s, '<w:jc w:val="right"/>'))

@case("G2 legacy pageBreakBefore", "legacy")
def _(p): edit(p, "word/document.xml", lambda s: set_ppr(s, "<w:pageBreakBefore/>"))

@case("G2 legacy keepNext, not accepted", "legacy")
def _(p): edit(p, "word/document.xml", lambda s: set_ppr(s, "<w:keepNext/>"))

@case("G2 legacy ind left=720, not accepted", "legacy")
def _(p): edit(p, "word/document.xml", lambda s: set_ppr(s, '<w:ind w:left="720"/>'))

@case("G2 legacy spacing after=240, not accepted", "legacy")
def _(p): edit(p, "word/document.xml", lambda s: set_ppr(s, '<w:spacing w:after="240"/>'))

@case("G2 legacy jc=center via the Normal style", "legacy")
def _(p): edit(p, "word/styles.xml", lambda s: re.sub(
    r'(<w:style w:type="paragraph" w:default="1" w:styleId="Normal">.*?)(</w:style>)',
    lambda m: m.group(1) + "<w:pPr><w:jc w:val=\"center\"/></w:pPr>" + m.group(2), s, count=1, flags=re.S))

# ---- gap 3: role class
@case("G3 legacy mapped body paragraph restyled Heading 2", "legacy")
def _(p): edit(p, "word/document.xml", lambda s: set_ppr(s, '<w:pStyle w:val="Heading2"/>'))

@case("G3 legacy mapped body paragraph given outlineLvl 1", "legacy")
def _(p): edit(p, "word/document.xml", lambda s: set_ppr(s, '<w:outlineLvl w:val="1"/>'))

# ---- gap 4: built side additions
@case("G4 built plain Normal paragraph with invented text", "built")
def _(p): edit(p, "word/document.xml", lambda s: after_anchor(s, "<w:p><w:r><w:t>Invented sentence.</w:t></w:r></w:p>"))

@case("G4 built Copy Body paragraph with invented text", "built")
def _(p): edit(p, "word/document.xml", lambda s: after_anchor(
    s, '<w:p><w:pPr><w:pStyle w:val="CopyBody"/></w:pPr><w:r><w:t>Invented sentence.</w:t></w:r></w:p>'))

@case("G4 built text box with invented text", "built")
def _(p): edit(p, "word/document.xml", lambda s: after_anchor(s, TXBX))

@case("G4 built Copy Note paragraph with invented text", "built")
def _(p): edit(p, "word/document.xml", lambda s: after_anchor(
    s, '<w:p><w:pPr><w:pStyle w:val="CopyNote"/></w:pPr><w:r><w:t>We sell data.</w:t></w:r></w:p>'))

@case("G4 built footer with text", "built")
def _(p):
    add_part(p, "word/footer9.xml", story("ftr", "Invented footer"), "footer+xml", "footer", "rIdMut9")

@case("G4 built comment", "built")
def _(p): add_part(p, "word/comments.xml", story("comments", "Invented comment"), "comments+xml", "comments")


# ---- JSON acceptances
def json_case(name, fn, expect="FAIL", legacy_fn=None):
    CASES.append((name, "json", (fn, legacy_fn), expect))

json_case("G3 JSON: one acceptedStyleChanges entry removed",
          lambda d: d.__setitem__("acceptedStyleChanges", d["acceptedStyleChanges"][1:]))
json_case("G3 JSON: acceptedStyleChanges entry with wrong direction",
          lambda d: d["acceptedStyleChanges"][0].update({"from": "heading", "to": "body"}))
json_case("G3 JSON: acceptedStyleChanges entry with no reason",
          lambda d: d["acceptedStyleChanges"][0].pop("reason"))
json_case("G3 JSON: stale acceptedStyleChanges for an unchanged paragraph",
          lambda d: d["acceptedStyleChanges"].append({"para": 1, "from": "body", "to": "heading", "reason": "x"}))
json_case("G2 JSON: stale acceptedLayoutChanges entry",
          lambda d: d.__setitem__("acceptedLayoutChanges", [{"para": 1, "property": "ind", "reason": "x"}]))


def _jc_para() -> int:
    sys.path.insert(0, str(WT / "scripts/copy-docs"))
    import docx, docfmt  # noqa: E401
    paras, _ = docfmt.read_document(docx.Document(str(LEG)))
    return next(i for i, p in enumerate(paras) if p["text"].startswith(ANCHOR) or ANCHOR in p["text"])


def legacy_jc(p): edit(p, "word/document.xml", lambda s: set_ppr(s, '<w:jc w:val="center"/>'))
def legacy_ind(p): edit(p, "word/document.xml", lambda s: set_ppr(s, '<w:ind w:left="720"/>'))

json_case("G2 JSON: jc=center accepted WITHOUT approvedBy",
          lambda d: d.__setitem__("acceptedLayoutChanges", [{"para": _jc_para(), "property": "jc", "reason": "x"}]),
          "FAIL", legacy_jc)
json_case("G2 JSON: jc=center accepted WITH approvedBy (machinery check)",
          lambda d: d.__setitem__("acceptedLayoutChanges", [{"para": _jc_para(), "property": "jc", "reason": "x",
                                                             "approvedBy": "test"}]), "OK", legacy_jc)
json_case("G2 JSON: keepNext accepted on a reason alone", lambda d: d.__setitem__("acceptedLayoutChanges", [{"para": _jc_para(), "property": "keepNext", "reason": "x"}]), "FAIL", lambda p: edit(p, "word/document.xml", lambda s: set_ppr(s, "<w:keepNext/>")))
json_case("G2 JSON: ind accepted with a reason",
          lambda d: d.__setitem__("acceptedLayoutChanges", [{"para": _jc_para(), "property": "ind",
                                                             "reason": "pure indent"}]), "OK", legacy_ind)


def run(legacy: Path, built: Path, src: Path) -> tuple[str, str]:
    r = subprocess.run([PY, GATE, "check", str(built), "--legacy", str(legacy), "--source", str(src)],
                       capture_output=True, text=True, timeout=120)
    out = r.stdout + r.stderr
    verdict = "OK" if "GATE OK" in out else "FAIL"
    why = [ln.strip() for ln in out.splitlines()
           if ln.startswith("  - ") or "UNREAD" in ln or "OUTSIDE" in ln or "added on built" in ln or "LOST" in ln]
    return verdict, (why[0][:150] if why else "")


bad = 0
for n, (name, side, fn, expect) in enumerate(CASES):
    legacy, built, src = LEG, BUILT, SRC
    if side == "legacy":
        legacy = mutate(LEG, OUT / f"m{n}-legacy.docx", fn)
    elif side == "built":
        built = mutate(BUILT, OUT / f"m{n}-built.docx", fn)
    elif side == "json":
        jfn, lfn = fn
        d = json.loads(SRC.read_text())
        jfn(d)
        src = OUT / f"m{n}.json"
        src.write_text(json.dumps(d, ensure_ascii=False))
        if lfn:
            legacy = mutate(LEG, OUT / f"m{n}-legacy.docx", lfn)
    verdict, why = run(legacy, built, src)
    ok = verdict == expect
    bad += not ok
    print(f"{'PASS' if ok else 'MISS'}  expect {expect:4} got {verdict:4}  {name}\n        {why}")
print(f"\n{len(CASES) - bad}/{len(CASES)} mutation cases behaved as expected")
sys.exit(1 if bad else 0)
