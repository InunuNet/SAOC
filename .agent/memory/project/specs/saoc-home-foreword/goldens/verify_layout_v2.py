"""Static layout-v2 checks for the home Foreword section.

usage: python3 -I verify_layout_v2.py <check>
Root is $CHECK_ROOT (default: current dir). Exit 0 = pass, 1 = fail (reason on stdout).
"""
import os
import re
import sys

ROOT = os.environ.get("CHECK_ROOT", ".")
SECTION = "components/home/ForewordSection.tsx"
CLIENT = "components/home/ForewordExpandable.tsx"
DATA = "lib/data/home-foreword.ts"
NEIGHBOURS = [
    "components/home/MissionBlock.tsx",
    "components/home/EventsStrip.tsx",
    "components/home/YearbookStrip.tsx",
    "components/home/PartnersSection.tsx",
]


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def fail(msg):
    print("FAIL:", msg)
    sys.exit(1)


def need(src, pattern, label):
    if not re.search(pattern, src):
        fail("missing " + label)


def py_values(src):
    """Numeric py-N / pt-N / pb-N values on the file's first <section> element (spacing scale, 4px units)."""
    m = re.search(r"<section\b[^>]*?className=\"([^\"]*)\"", src, re.S)
    if not m:
        return []
    src = m.group(1)
    return [int(n) for n in re.findall(r"(?<![\w-])(?:min-\[\w+\]:|lg:|md:|sm:)?p[ytb]-(\d+)(?![\w\[])", src)]


def check_button():
    s = read(CLIENT)
    need(s, r"^['\"]use client['\"]", "'use client' directive in ForewordExpandable")
    need(s, r"<button\b", "<button> element")
    need(s, r"type=\"button\"", 'type="button"')
    need(s, r"aria-expanded=\{", "aria-expanded bound to state")
    need(s, r"aria-controls=", "aria-controls")
    need(s, r"Continue reading", "label 'Continue reading'")
    need(s, r"useState\(false\)", "initial state collapsed (useState(false))")
    sec = read(SECTION)
    if "use client" in sec:
        fail("ForewordSection must stay a server component")
    need(sec, r"ForewordExpandable", "ForewordSection renders ForewordExpandable")


def check_paragraphs():
    s = read(CLIENT)
    need(s, r"paragraphs\.map\(", "all paragraphs mapped (no slice)")
    if re.search(r"paragraphs\.slice\(", s):
        fail("paragraphs must not be sliced out of the SSR tree")
    need(s, r"hidden=\{[^}]*introCount[^}]*\}|hidden=\{[^}]*index[^}]*\}", "hidden attribute on collapsed paragraphs")
    need(s, r"index\s*>=\s*introCount|index\s*<\s*introCount", "intro/collapsed split by introCount")
    need(s, r"id=\{`home-foreword-p-", "per-paragraph ids for aria-controls")
    d = read(DATA)
    need(d, r"export const HOME_FOREWORD_INTRO_COUNT\s*=\s*1\b", "HOME_FOREWORD_INTRO_COUNT = 1")
    sec = read(SECTION)
    need(sec, r"HOME_FOREWORD_PARAGRAPHS", "ForewordSection passes the full paragraph list")


def check_sticky():
    s = read(CLIENT)
    need(s, r"lg:sticky", "lg:sticky on left column")
    need(s, r"lg:top-\[121px\]", "lg:top-[121px] (97px header + 24px)")
    need(s, r"lg:self-start", "lg:self-start on left column")
    need(s, r"lg:grid-cols-\[5fr_7fr\]", "two-column grid only from lg")
    if re.search(r"(?<!lg:)(?<![\w-])sticky", s):
        fail("sticky must be lg:-prefixed only (nothing sticky on mobile)")
    need(s, r"doc-prose", "doc-prose body column (64ch)")


def check_padding():
    sec = read(SECTION)
    mine = py_values(sec)
    if not mine:
        fail("ForewordSection has no vertical padding class")
    nb = []
    for rel in NEIGHBOURS:
        nb += py_values(read(rel))
    smallest = min(nb)  # PartnersSection py-20
    if max(mine) > smallest:
        fail(f"foreword padding py-{max(mine)} exceeds smallest neighbour py-{smallest}")
    if max(mine) >= 24:
        fail("foreword must not use py-24")
    print("ok", max(mine), "<=", smallest)


def check_motion_focus():
    s = read(CLIENT)
    if re.search(r"transition-\[?height|transition-all|animate-|max-h-|h-0\b", s):
        fail("no height animation / transition-all / animate-*")
    if "smooth" in s:
        fail("no smooth scrolling (reduced-motion safety)")
    need(s, r"scrollIntoView\(\{\s*block:\s*['\"]nearest['\"]", "collapse keeps heading in view via scrollIntoView block nearest")
    if s.count("<button") != 1:
        fail("exactly one persistent <button> (focus stays on it across expand and collapse)")
    need(s, r"inline-flex min-h-11 items-center font-mono text-\[11px\] uppercase tracking-\[0\.18em\] text-primary", "EventsStrip text-link button classes reused")
    need(s, r"focus-visible:outline-2", "focus-visible outline")
    if re.search(r"#[0-9a-fA-F]{3,8}\b", s) or re.search(r"#[0-9a-fA-F]{3,8}\b", read(SECTION)):
        fail("no hex colours")


CHECKS = {
    "button": check_button,
    "paragraphs": check_paragraphs,
    "sticky": check_sticky,
    "padding": check_padding,
    "motion_focus": check_motion_focus,
}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in CHECKS:
        fail("usage: verify_layout_v2.py " + "|".join(CHECKS))
    CHECKS[sys.argv[1]]()
    print("ok")
