#!/usr/bin/env python3
"""Regenerates goldens/copy.json and goldens/classification.json from the frozen source.

The architect runs this once; the outputs are frozen by checks.sha256. check-source.mjs re-verifies every
unit against goldens/sources/content.md with its own code, so a drift in this script cannot hide.
Usage: python3 .agent/memory/project/specs/nos-landing-v1/checks/gen-goldens.py
"""
import json
import re
import sys
from pathlib import Path

SPEC = Path(".agent/memory/project/specs/nos-landing-v1")
SRC = (SPEC / "goldens/sources/content.md").read_text(encoding="utf-8").split("\n")
PAGE = Path("app/(nos)/national-show/page.tsx").read_text(encoding="utf-8")


def line(n):
    return SRC[n - 1]


def body(n):
    s = re.sub(r"^\s*(\*\s+)?(\+\s+)?", "", line(n))
    return s.replace("**", "").strip()


def cut_note(s):
    """The copy stops where her inline instruction starts (' – Copy', ' — Copy')."""
    return re.split(r"\s[–—]\s(?:Copy|Added)", s, maxsplit=1)[0].strip()


units = []


def U(uid, n, raw, section, tag=None, optional=False, decision=None, derive=None, order=True):
    assert raw in line(n), (uid, n, raw)
    em = re.findall(r"\*([^*]+)\*", raw)
    text = raw.replace("*", "")
    if derive == "drop-strikethrough":
        text = re.sub(r"\s*~~[^~]+~~", "", text)
        text = text.replace("  ", " ")
    units.append({"id": uid, "line": n, "raw": raw, "text": text, "em": em, "section": section,
                  "tag": tag, "optional": optional, "decision": decision, "derive": derive, "order": order})


# hero ---------------------------------------------------------------------------------------
U("hero-h1", 29, body(29), "hero", "h1", decision="D1")
U("hero-lede", 33, body(33).split("To: ", 1)[1], "hero", None)
U("hero-theme", 35, body(35).split("wording above: ", 1)[1], "hero", "p")
# about (section 2) ---------------------------------------------------------------------------
U("about-tagline", 41, "Three years in the making, four days on the bench", "about", "h2")
U("about-lead", 42, body(42), "about", "p")
U("about-judging", 46, body(46), "about", "p")
U("stat-1", 47, body(47), "about", None)
U("stat-2", 48, body(48), "about", None)
U("stat-3", 49, body(49), "about", None)
# visit (section 3 cards) ---------------------------------------------------------------------
U("visit-h2", 52, body(52), "visit", "h2", decision="D2")
for key, tn, bn, dec in (("about", 54, 56, None), ("pyv", 58, 60, None), ("wte", 62, 64, "D3"), ("faq", 66, 68, None)):
    U(f"card-{key}-title", tn, body(tn), "visit", "h3")
    U(f"card-{key}-blurb", bn, cut_note(body(bn)).replace("~~cloakroom~~ ", "~~cloakroom~~ "), "visit", "p",
      decision=dec, derive="drop-strikethrough" if dec == "D3" else None)
U("card-past-title", 70, "Past shows", "visit", "h3", optional=True, decision="D6")
U("card-prev-title", 72, "Previous editions", "visit", "h3", optional=True, decision="D6")
# judging groups ------------------------------------------------------------------------------
U("judging-h2", 74, body(74), "judging", "h2")
for g in range(1, 14):
    n = 76 + (g - 1) * 2 if g <= 10 else 96 + (g - 11)
    head = body(n)
    assert head.startswith(f"Group {g}: "), (g, head)
    U(f"group-{g}-label", n, f"Group {g}", "judging", "p", decision="D9")
    U(f"group-{g}-name", n, head.split(": ", 1)[1], "judging", "h3", decision="D9")
    if g <= 10:
        U(f"group-{g}-desc", n + 1, body(n + 1), "judging", "p")
# plant entry (section 4) ---------------------------------------------------------------------
U("entry-h2", 101, body(101), "entry", "h2")
for k, base in enumerate((103, 109, 115, 121), start=1):
    U(f"stage-{k}-label", base, body(base), "entry", "p")
    U(f"stage-{k}-title", base + 2, body(base + 2), "entry", "h3")
    U(f"stage-{k}-desc", base + 4, body(base + 4), "entry", "p")
U("entry-cta", 127, body(127), "entry", None, decision="D4")
# closing -------------------------------------------------------------------------------------
U("closing-text", 131, body(131), "closing", "p", decision="D5")

# retained: strings that exist on main today and must survive (the doc is silent on them) -------
def const(name):
    m = re.search(rf"^const {name} = (['\"])(.*)\1;$", PAGE, re.M)
    assert m, name
    return m.group(2).replace("\\'", "'").replace('\\"', '"')


retained = [
    {"id": "keep-dates-label", "section": "about", "text": const("DATES_LABEL"), "const": "DATES_LABEL"},
    {"id": "keep-dates-line", "section": "about", "text": const("DATES_LINE"), "const": "DATES_LINE"},
    {"id": "keep-symposium", "section": "programme", "text": const("SYMPOSIUM_LINE"), "const": "SYMPOSIUM_LINE"},
    {"id": "keep-wosa", "section": "programme", "text": const("WOSA_LINE"), "const": "WOSA_LINE"},
    {"id": "keep-workshops", "section": "programme", "text": const("WORKSHOPS_LINE"), "const": "WORKSHOPS_LINE"},
    {"id": "keep-exhibit-lead", "section": "exhibit", "text": const("EXHIBIT_LEAD"), "const": "EXHIBIT_LEAD"},
    {"id": "keep-exhibit-body", "section": "exhibit", "text": const("EXHIBIT_BODY"), "const": "EXHIBIT_BODY"},
]

# retired on the landing page: must appear nowhere in the served HTML (raw, so meta and JSON-LD count) -------
retired = [
    {"id": "old-lede", "text": const("LEDE"), "why": "L31: she asks the current wording to be changed (D10: meta description and JSON-LD share the constant)"},
    {"id": "old-about-heading", "text": const("ABOUT_HEADING"), "why": "L41: the tag line replaces the Section 2 heading (D5)"},
    {"id": "old-about-lead", "text": const("ABOUT_LEAD"), "why": "Section 2 lists exactly two paragraphs (D5)"},
    {"id": "old-about-body", "text": const("ABOUT_BODY"), "why": "Section 2 lists exactly two paragraphs (D5)"},
    {"id": "old-closing", "text": const("CLOSING"), "why": "L131 is the closing line; two closing paragraphs would contradict it (D5)"},
]

# instruction and annotation phrases that must never render, and her queried typos that must never be corrected -----
forbidden_text = [
    "Copy needs to be provided", "Copy to be provided", "Copy and photos need to be provided", "Copy and Photos need to be provided",
    "Added to google drive", "Added to Google Drive", "Provided in the Google folder", "in the google folder", "Awaiting final list",
    "Link is good", "link is working", "Why was this removed", "put it back in", "The blow needs", "blow needs to be added",
    "show entry registration form", "Nitsi", "Fiona", "Change the wording", "Logo to be confirmed", "Use only 3 fonts",
    "Some Rules to Follow", "Key content", "Top Banner", "Hero Banner", "Ticket tab is working", "cloakroom", "Register Here",
]
corrections = [
    {"id": "judges-typo", "never": "can be judged", "must": "can be judges"},
    {"id": "communication-typo", "never": "love to communicate", "must": "love to communication"},
    {"id": "ten-heading", "never": "Thirteen judging groups", "must": "Ten judging groups"},
    {"id": "ten-heading-2", "never": "Nine judging groups", "must": "Ten judging groups"},
    {"id": "ten-heading-3", "never": "13 judging groups", "must": "Ten judging groups"},
]

# deferred: footer lines (shared chrome, D7). Verified only that the diff does not touch the shared chrome. -------
deferred = [
    {"id": "footer-stay-h", "line": 141, "text": body(141)},
    {"id": "footer-stay-blurb", "line": 143, "text": body(143)},
    {"id": "footer-topic-1", "line": 145, "text": body(145)},
    {"id": "footer-topic-2", "line": 146, "text": body(146)},
    {"id": "footer-explore-h", "line": 148, "text": body(148)},
]

json.dump({"schema": "nos-landing-v1.copy/v1", "source": "goldens/sources/content.md", "units": units, "retained": retained,
           "retired": retired, "forbiddenText": forbidden_text, "corrections": corrections, "deferred": deferred,
           "sectionOrder": ["hero", "about", "visit", "judging", "entry", "closing"], "groupCount": 13, "stageCount": 4, "statCount": 3},
          open(SPEC / "goldens/copy.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# classification ------------------------------------------------------------------------------
I, C, A = "instruction", "copy", "ambiguous"
cls = {}


def put(ns, klass, note, units_=()):
    for n in ([ns] if isinstance(ns, int) else ns):
        cls[n] = {"line": n, "class": klass, "note": note, "units": list(units_)}


put(1, I, "document title")
put(3, I, "says which page this document is about")
put(5, I, "masthead naming the event; the same name is in the header lockup (L25 'Correct'), no new text")
put(7, I, "masthead theme; duplicates L35, which is the line that says where the theme goes")
put(9, I, "label for the rules")
put(11, I, "naming rule (follow-up sweep, not rendered)")
put(13, I, "naming rule, the form to use (follow-up sweep, not rendered)")
put(15, I, "font rule, with NOS Design; not acted on here")
put(17, I, "section label")
put(19, I, "describes the page's purpose, not copy for it")
put(21, I, "label")
put(23, I, "label")
put([24, 25, 26], I, "header checks marked 'Correct': no change requested")
put(27, I, "section label")
put(29, C, "hero heading text", ["hero-h1"])
put(31, I, "tells us to replace the quoted current wording; the old string must not render")
put(33, C, "'To:' is her instruction; the copy is everything after it", ["hero-lede"])
put(35, C, "'Add the theme below the wording above:' is her instruction; the copy is everything after it", ["hero-theme"])
put([37, 38, 39], I, "status notes (Tickets works; Plan your visit copy is in Drive; rest of hero unchanged)")
put(40, I, "section label")
put(41, C, "the quoted tag line is the copy; the question around it is her instruction", ["about-tagline"])
put(42, C, "Section 2 paragraph", ["about-lead"])
put(44, A, "'The blow needs to be added to this page.' reads as an editorial note ('blow' for 'blurb'): the judging paragraph on the next line is the blurb she means. Classified instruction, not rendered, the string is forbidden")
put(46, C, "Section 2 judging paragraph, typos kept ('can be judges')", ["about-judging"])
put([47, 48, 49], C, "stat", ["stat-1", "stat-2", "stat-3"])
put(50, I, "section label")
put(52, A, "bold line with no body: section heading for the cards, or a label? Classified copy (heading) because the four cards sit under it and her labels use 'Section N' wording, not this", ["visit-h2"])
put([54, 58, 62, 66], C, "card title")
put([56, 60, 68], C, "card blurb; the ' – Copy needs to be provided...' tail is her instruction", [])
put(64, A, "card blurb with her strikethrough on 'cloakroom': rendered without the struck word", ["card-wte-blurb"])
put([70, 72], A, "card titles with no blurb and no route that can be public yet (archive answers 404 while no past show is public)", [])
put(74, C, "heading kept verbatim although it says 'Ten' over 13 groups (queried by SAOC)", ["judging-h2"])
put(99, I, "section label")
put(101, C, "section heading", ["entry-h2"])
put([103, 109, 115, 121], C, "stage label", [])
put([105, 111, 117, 123], C, "stage title", [])
put([107, 113, 119, 125], C, "stage description", [])
put(127, C, "call to action line", ["entry-cta"])
put(129, A, "'Register Here' is a button label; the rest says the form does not exist yet. A control with no destination would be invented: no control rendered (D4)")
put(131, C, "closing line", ["closing-text"])
put([133, 135], C, "link labels already on the page; ' – ...' tail is her instruction", [])
put(137, I, "section label (she numbers it 4 again)")
put(139, A, "'Logo to be confirmed for SAOC': a request about a logo, no logo supplied. Instruction, nothing rendered; visual gap for NOS Design")
put([141, 143, 145, 146, 148], C, "footer copy (shared chrome, deferred D7)", [])
put(list(range(150, 161)), C, "Explore link label; the status after the dash is her instruction (see spec section 8)", [])
for g in range(1, 14):
    n = 76 + (g - 1) * 2 if g <= 10 else 96 + (g - 11)
    put(n, C, f"Group {g} heading", [f"group-{g}-label", f"group-{g}-name"])
    if g <= 10:
        put(n + 1, C, f"Group {g} description (italics are her formatting)", [f"group-{g}-desc"])
for k, base in enumerate((103, 109, 115, 121), start=1):
    cls[base]["units"] = [f"stage-{k}-label"]
    cls[base + 2]["units"] = [f"stage-{k}-title"]
    cls[base + 4]["units"] = [f"stage-{k}-desc"]
for key, tn, bn in (("about", 54, 56), ("pyv", 58, 60), ("wte", 62, 64), ("faq", 66, 68)):
    cls[tn]["units"] = [f"card-{key}-title"]
    cls[bn]["units"] = [f"card-{key}-blurb"]
cls[70]["units"] = ["card-past-title"]
cls[72]["units"] = ["card-prev-title"]

nonblank = [i + 1 for i, s in enumerate(SRC) if s.strip()]
missing = sorted(set(nonblank) - set(cls))
extra = sorted(set(cls) - set(nonblank))
if missing or extra:
    sys.exit(f"classification mismatch: missing={missing} extra={extra}")
out = [cls[n] for n in nonblank]
counts = {k: sum(1 for o in out if o["class"] == k) for k in (C, I, A)}
json.dump({"schema": "nos-landing-v1.classification/v1", "source": "goldens/sources/content.md", "counts": counts,
           "nonBlankLines": len(out), "lines": out},
          open(SPEC / "goldens/classification.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("units", len(units), "lines", len(out), counts)
