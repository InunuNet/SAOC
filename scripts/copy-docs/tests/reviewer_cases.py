"""QA reviewer's mutation cases for the copy-doc gate (rounds at c313cf75 and b3d66dd2), plus the
cases added for gaps 5-8. Each case mutates a legacy doc, a built doc or a page JSON, runs the gate
serially, and expects FAIL; the unmutated controls expect OK. Exit 0 only when every case behaves.

The case bodies are the reviewer's, unchanged; only the harness paths are parameters.

    python scripts/copy-docs/tests/reviewer_cases.py LEGACY_DIR OUT_DIR
      LEGACY_DIR holds the legacy Drive docs as <page>.docx (nos-landing, privacy, ...);
      the built docs and page JSONs are the repo's copy-docs/<page>.docx and copy-docs/source/<page>.json.
"""
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

if len(sys.argv) != 3:
    sys.exit(__doc__)
REPO = Path(__file__).resolve().parents[3]
PY = sys.executable
SCRIPT = str(REPO / "scripts/copy-docs/build_copy_doc.py")
LEGACY_DIR, OUT = (Path(a).resolve() for a in sys.argv[1:3])
OUT.mkdir(exist_ok=True)
D = "word/document.xml"
RESULTS: list[tuple[str, str, str, str]] = []   # (name, expected, got, first reason)


def legacy_path(page): return str(LEGACY_DIR / f"{page}.docx")
def built_path(page): return str(REPO / f"copy-docs/{page}.docx")
def source_path(page): return str(REPO / f"copy-docs/source/{page}.json")


def rewrite(src, dst, part, fn, extra=None):
    zi = zipfile.ZipFile(src)
    zo = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED)
    for it in zi.infolist():
        d = zi.read(it.filename)
        if it.filename == part:
            d = fn(d.decode()).encode()
        zo.writestr(it, d)
    for name, data in (extra or {}).items():
        zo.writestr(name, data)
    zo.close()


def gate(page, legacy, built, source=None):
    r = subprocess.run([PY, SCRIPT, "check", built, "--legacy", legacy, "--source", source or source_path(page)],
                       capture_output=True, text=True, timeout=180)
    return r.returncode, r.stdout + r.stderr


def record(name, rc, out, expect="FAIL"):
    got = "FAIL" if rc else "OK"
    keys = ("  - ", "LOST", "added on", "OUTSIDE", "CANNOT CARRY")
    why = next((ln.strip() for ln in out.splitlines() if any(k in ln for k in keys)), "")
    RESULTS.append((name, expect, got, why[:170]))


def run(name, page, side, part, fn, extra=None):
    L, B = legacy_path(page), built_path(page)
    if side == "legacy":
        L2 = str(OUT / f"{name}-L.docx"); rewrite(L, L2, part, fn, extra); L = L2
    else:
        B2 = str(OUT / f"{name}-B.docx"); rewrite(B, B2, part, fn, extra); B = B2
    rc, out = gate(page, L, B)
    record(name, rc, out)


def sub1(pat, repl, count=1, flags=re.S):
    def f(x):
        y, n = re.subn(pat, repl, x, count=count, flags=flags)
        assert n > 0, "mutation did not apply: " + pat
        return y
    return f


# ---- controls: every unmutated page passes
for page in ("nos-landing", "privacy", "terms", "saoc-about", "saoc-foreword"):
    rc, out = gate(page, legacy_path(page), built_path(page))
    record(f"control-{page}", rc, out, "OK")

# ---- reviewer cases (verbatim bodies) ---------------------------------------------------------
FT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">%s</w:ftr>'
def rels(x): return x.replace("</Relationships>", '<Relationship Id="rId900" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>')
def sect(x):
    return re.sub(r"(<w:sectPr[^>]*>)", r'\1<w:footerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="rId900"/>', x, count=1)
def withfooter(name, body, page="privacy", side="legacy"):
    src = legacy_path(page) if side == "legacy" else built_path(page)
    t = str(OUT / f"t_{name}.docx"); out = str(OUT / f"{name}.docx")
    rewrite(src, t, "word/_rels/document.xml.rels", rels, {"word/footer1.xml": FT % body})
    rewrite(t, out, D, sect)
    L, B = (out, built_path(page)) if side == "legacy" else (legacy_path(page), out)
    rc, o = gate(page, L, B)
    record(name, rc, o)
withfooter("F-plain", '<w:p><w:r><w:t>Registered NPO 123-456 footer line</w:t></w:r></w:p>')
withfooter("F-heading1-style", '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Registered NPO 123-456 footer line</w:t></w:r></w:p>')
withfooter("F-heading-style-lower", '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Registered NPO 123-456 footer line</w:t></w:r></w:p>')
withfooter("F-prefix-word", '<w:p><w:r><w:t>Heading: Registered NPO 123-456</w:t></w:r></w:p>')
withfooter("F-fallback-only", '<w:p><w:r><mc:AlternateContent><mc:Fallback><w:pict><w:txbxContent><w:p><w:r><w:t>Only in fallback</w:t></w:r></w:p></w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>')
withfooter("F-choice-and-fallback-differ", '<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:txbxContent><w:p><w:r><w:t>Choice text real</w:t></w:r></w:p></w:txbxContent></mc:Choice><mc:Fallback><w:pict><w:txbxContent><w:p><w:r><w:t>Fallback old</w:t></w:r></w:p></w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>')
withfooter("F-textbox-plain", '<w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>Textbox in footer</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p>')
withfooter("F-drawingml-a-t", '<w:p><w:r><w:drawing><a:graphic><a:graphicData><a:t>DrawingML words</a:t></a:graphicData></a:graphic></w:drawing></w:r></w:p>')
withfooter("F-math-m-t", '<w:p><m:oMath><m:r><m:t>x equals words</m:t></m:r></m:oMath></w:p>')
withfooter("F-instrText", '<w:p><w:r><w:instrText> HYPERLINK "https://x.example" </w:instrText></w:r><w:r><w:t>vis</w:t></w:r></w:p>')
withfooter("F-delText", '<w:p><w:del w:id="3" w:author="a"><w:r><w:delText>deleted words</w:delText></w:r></w:del></w:p>')
# built-side additions
withfooter("BF-added-footer", '<w:p><w:r><w:t>Invented footer words</w:t></w:r></w:p>', side="built")
withfooter("BF-added-in-fallback", '<w:p><w:r><mc:AlternateContent><mc:Fallback><w:pict><w:txbxContent><w:p><w:r><w:t>invented hidden</w:t></w:r></w:p></w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>', side="built")
withfooter("BF-added-copy-note-style", '<w:p><w:pPr><w:pStyle w:val="CopyNote"/></w:pPr><w:r><w:t>invented note</w:t></w:r></w:p>', side="built")
# body: Fallback-wrapped text in built body / legacy body
FB = '<w:r><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Fallback><w:t>HIDDEN ADDED</w:t></mc:Fallback></mc:AlternateContent></w:r>'
run("B-body-fallback-added", "privacy", "built", D, sub1(r'(<w:t>Responding to enquiries and requests\.</w:t></w:r>)', r'\1' + FB))
run("L-body-fallback-lost", "privacy", "legacy", D, sub1(r'(<w:t>Responding to enquiries and requests\.</w:t></w:r>)', r'\1' + FB))
# body: copy word swallowed? legacy heading-style paragraph carrying new copy
run("L-heading-style-extra-line", "privacy", "legacy", D, sub1(r'(<w:sectPr)', r'<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Extra legal clause in heading style</w:t></w:r></w:p>\1'))
run("L-heading-style-existing-copy", "privacy", "legacy", D, sub1(r'(<w:p [^>]*>)(<w:pPr>)(<w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr>)', r'\1\2<w:pStyle w:val="Heading2"/>\3'))

# ---- added for gaps 5-8 -------------------------------------------------------------------------
# 5: a Heading line on the landing that is not a listed section label; a stray "Role: " line.
run("L-landing-heading-unlisted", "nos-landing", "legacy", D, sub1(r'(<w:sectPr)', r'<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Hero</w:t></w:r></w:p>\1'))
run("L-landing-prefix-stray-line", "nos-landing", "legacy", D, sub1(r'(<w:sectPr)', r'<w:p><w:r><w:t>Link: extra words</w:t></w:r></w:p>\1'))
# 6: Choice and Fallback in the built body (Choice text is read; it is invented, so it fails).
run("B-body-choice-added", "privacy", "built", D, sub1(r'(<w:t>Responding to enquiries and requests\.</w:t></w:r>)', r'\1<w:r><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="wps"><w:t>CHOICE ADDED</w:t></mc:Choice><mc:Fallback><w:t>CHOICE ADDED</w:t></mc:Fallback></mc:AlternateContent></w:r>'))
# 7: a:t, m:t and delText in the legacy body.
run("L-body-a-t", "privacy", "legacy", D, sub1(r'(<w:t>Responding to enquiries and requests\.</w:t></w:r>)', r'\1<w:r><w:drawing><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><a:t>Shape words</a:t></a:graphicData></a:graphic></w:drawing></w:r>'))
run("L-body-m-t", "privacy", "legacy", D, sub1(r'(<w:t>Responding to enquiries and requests\.</w:t></w:r>)', r'\1<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>maths words</m:t></m:r></m:oMath>'))
run("L-body-delText", "privacy", "legacy", D, sub1(r'(<w:t>Responding to enquiries and requests\.</w:t></w:r>)', r'\1<w:del w:id="9" w:author="a"><w:r><w:delText>deleted words</w:delText></w:r></w:del>'))
# 8: invented words inside each of our own structural paragraphs in the built body.
for style in ("Key", "KeyTitle", "Heading2", "SectionWhere", "RoleLabel", "CopyNote"):
    run(f"B-own-{style}-extra-words", "nos-landing", "built", D,
        sub1(rf'(<w:pStyle w:val="{style}"/>(?:(?!</w:p>).)*?<w:t[^>]*>)', r'\1INVENTED '))
run("B-own-H1-extra-words", "privacy", "built", D, sub1(r'(<w:pStyle w:val="Heading1"/>(?:(?!</w:p>).)*?<w:t[^>]*>)', r'\1INVENTED '))


# JSON: a section label removed from the list; a prefix without its colon.
def json_case(name, page, fn):
    d = json.loads(Path(source_path(page)).read_text())
    fn(d)
    src = OUT / f"{name}.json"
    src.write_text(json.dumps(d, ensure_ascii=False))
    rc, out = gate(page, legacy_path(page), built_path(page), str(src))
    record(name, rc, out)
json_case("J-landing-section-label-unlisted", "nos-landing",
          lambda d: d["legacySectionLabels"].remove("Programme"))
json_case("J-landing-section-label-listed-twice", "nos-landing",
          lambda d: d["legacySectionLabels"].append("Hero"))
def _no_colon(d):
    e = next(e for s in d["sections"] for e in s["elements"] if e.get("legacyPrefix") == "Link: ")
    e["legacyPrefix"] = "Link"
json_case("J-landing-prefix-without-colon", "nos-landing", _no_colon)

bad = 0
for name, expect, got, why in RESULTS:
    ok = expect == got
    bad += not ok
    print(f"{'PASS' if ok else 'MISS'}  expect {expect:4} got {got:4}  {name}\n        {why}")
print(f"\n{len(RESULTS) - bad}/{len(RESULTS)} reviewer cases behaved as expected")
sys.exit(1 if bad else 0)
