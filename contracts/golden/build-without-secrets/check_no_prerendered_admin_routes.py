#!/usr/bin/env python3
"""Sweep app/**/page.tsx for pages that both (a) prerender — static or ISR, the
Next default unless the page opts into request-time rendering — and (b)
transitively import `firebase-admin` (directly or via a local module, one hop
or many). That combination is exactly today's /tickets defect: a prerendered
page reaching code that needs credentials the builder does not have.

`app/api/**` route handlers are out of scope by construction (this script only
looks at page.tsx) — Next route handlers default to per-request rendering, and
none of app/api/tickets|admin's routes declare `export const dynamic =
'force-static'` (see check_no_force_static_api_routes in this same directory's
selftest, which asserts that explicitly rather than assuming it).

Classification of a page.tsx as request-time (safe even if it reaches
firebase-admin) requires an ACTUAL Next.js dynamic-rendering trigger, not just
"lives under app/admin":
  - 'use client' as the first statement (ships to the browser, never prerendered
    with server data)
  - calls cookies()/headers() from next/headers (opts out of static rendering)
  - declares `export const dynamic = 'force-dynamic'`
Anything else that imports firebase-admin transitively is a violation.

Two real pages in this repo — app/admin/page.tsx and
app/(marketing)/events/submit/page.tsx — both transitively reach firebase-admin
AND are correctly classified as request-time-safe because they call cookies().
Their appearance in the "skipped, request-time" output (not "clean" — they
really do reach the SDK) is the proof this checker reasons about rendering mode
rather than blanket-excluding paths that look admin-ish.

Type-only imports (`import type { X } from 'firebase-admin/...'`, as in
types/index.ts) are erased at compile time and create no runtime edge — this
checker's import scanner explicitly skips lines starting with `import type`
(see selftest.py, which proves this exclusion is necessary: without it,
types/index.ts's `import type { Timestamp } from 'firebase-admin/firestore'`
makes every page that transitively imports the shared `types` module — most of
the site — a false positive).

Usage: python3 check_no_prerendered_admin_routes.py <repo_root>
Exit 0 if there are zero violations. Exit 1 and list every violation otherwise.
"""
import re
import sys
from pathlib import Path

IMPORT_LINE_RE = re.compile(r"^\s*import\s+type\b")
IMPORT_SPEC_RE = re.compile(r"""(?:from|import)\s*\(?\s*['"]([^'"]+)['"]""")

CLIENT_DIRECTIVE_RE = re.compile(r"""^['"]use client['"]""")
NEXT_HEADERS_IMPORT_RE = re.compile(r"""from\s+['"]next/headers['"]""")
DYNAMIC_CALL_RE = re.compile(r"\b(cookies|headers)\s*\(")
FORCE_DYNAMIC_RE = re.compile(r"""export const dynamic\s*=\s*['"]force-dynamic['"]""")


def find_page_files(app_root: Path):
    for p in sorted(app_root.rglob("page.tsx")):
        if f"{Path('api')}" in p.relative_to(app_root).parts:
            continue
        yield p


def iter_runtime_import_specs(text: str):
    """Yield import specifiers from lines that are NOT type-only imports."""
    for line in text.splitlines():
        if IMPORT_LINE_RE.match(line):
            continue
        for m in IMPORT_SPEC_RE.finditer(line):
            yield m.group(1)


def resolve_import(spec: str, from_file: Path, repo_root: Path) -> Path | None:
    if spec.startswith("@/"):
        base = repo_root / spec[2:]
    elif spec.startswith("."):
        base = (from_file.parent / spec).resolve()
    else:
        return None  # bare package specifier — node_modules, not local source
    if base.suffix in (".ts", ".tsx") and base.exists():
        return base
    for candidate in (
        base.with_suffix(".ts"),
        base.with_suffix(".tsx"),
        base / "index.ts",
        base / "index.tsx",
    ):
        if candidate.exists():
            return candidate
    return None


def reaches_firebase_admin(start: Path, repo_root: Path, max_depth: int = 12) -> bool:
    visited: set[Path] = set()
    stack: list[tuple[Path, int]] = [(start, 0)]
    while stack:
        f, depth = stack.pop()
        if f in visited or depth > max_depth:
            continue
        visited.add(f)
        try:
            text = f.read_text()
        except OSError:
            continue
        for spec in iter_runtime_import_specs(text):
            if spec == "firebase-admin" or spec.startswith("firebase-admin/"):
                return True
            resolved = resolve_import(spec, f, repo_root)
            if resolved and resolved not in visited:
                stack.append((resolved, depth + 1))
    return False


def classify(page_file: Path) -> str:
    text = page_file.read_text()
    head = text.lstrip()
    if CLIENT_DIRECTIVE_RE.match(head.splitlines()[0]) if head else False:
        return "client"
    if NEXT_HEADERS_IMPORT_RE.search(text) and DYNAMIC_CALL_RE.search(text):
        return "dynamic-request-time"
    if FORCE_DYNAMIC_RE.search(text):
        return "dynamic-force"
    return "prerender-candidate"


def sweep(repo_root: Path) -> tuple[list[str], list[tuple[str, str]]]:
    app_root = repo_root / "app"
    violations: list[str] = []
    skipped_but_reaches: list[tuple[str, str]] = []
    for page in find_page_files(app_root):
        cls = classify(page)
        reaches = reaches_firebase_admin(page, repo_root)
        rel = str(page.relative_to(repo_root))
        if not reaches:
            continue
        if cls == "prerender-candidate":
            violations.append(rel)
        else:
            skipped_but_reaches.append((rel, cls))
    return violations, skipped_but_reaches


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: check_no_prerendered_admin_routes.py <repo_root>", file=sys.stderr)
        return 1
    repo_root = Path(sys.argv[1]).resolve()
    violations, skipped = sweep(repo_root)

    print("REQUEST-TIME PAGES THAT REACH firebase-admin (expected, safe):")
    for rel, cls in skipped:
        print(f"  {rel}  [{cls}]")
    if not skipped:
        print("  (none)")

    print("PRERENDERED PAGES THAT REACH firebase-admin (VIOLATIONS):")
    for rel in violations:
        print(f"  {rel}")
    if not violations:
        print("  (none)")

    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
