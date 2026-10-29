#!/usr/bin/env python3
"""Static wiring checks for nos-order-recovery. Frozen by @architect; @dev implements against it.

Usage: check_wiring.py <check> [--root DIR]     (exit 0 pass, 1 fail, 2 usage)
Reads source text and `git diff` only. No network, no Firestore, no secrets, writes nothing.
Anchors: a comment `// anchor: <name>` marks the ONE statement on the next line that a mutation
(run_mutations.py) breaks; the verbatim anchored lines are listed in spec.md "Anchor table".
What these checks cannot prove (and the goldens do): behaviour. They prove placement, ordering and absence.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]

ACCESS = "lib/recovery-access.ts"
PAGE = "app/(nos)/tickets/recover/page.tsx"
LIST = "components/tickets/ConfirmedTicketList.tsx"
CONFIRM = "app/(nos)/tickets/confirmation/page.tsx"
ORDERS = "lib/orders.ts"
NEXT_CONFIG = "next.config.ts"
CACHE = ".agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/cache-header-expectations.json"
SPEC_DIR = ".agent/memory/project/specs/nos-order-recovery/"

ALLOWED_FILES = {
    ACCESS, PAGE, LIST, CONFIRM, ORDERS, NEXT_CONFIG, CACHE,
    "docs/nos-order-recovery.md", "contracts/checks/live-write-guard/writers-registry.json",
}
UNCHANGED = [
    "proxy.ts", "lib/recovery-token.ts", "lib/recovery-url.ts", "lib/confirmation-email.ts", "lib/resend-response.ts",
    "lib/resend-rate-limit.ts", "lib/ticketing-test-mode.ts", "lib/site-hosts.ts", "emails", "app/api", "app/(nos)/tickets/[slug]",
    "app/(nos)/tickets/page.tsx", "app/(nos)/tickets/layout.tsx", "app/(nos)/not-found.tsx", "firestore.rules", "firestore.indexes.json",
    "apphosting.yaml", "package.json", "contracts/checks/ticketing-f6-recovery-token", "components/tickets/DownloadTicketButton.tsx",
]
NEW_FILES = [ACCESS, PAGE, LIST]


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    sys.exit(1)


def need(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def read(rel: str) -> str:
    path = ROOT / rel
    need(path.is_file(), f"{rel} is missing")
    return path.read_text(encoding="utf-8")


def git(*args: str) -> str:
    done = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    need(done.returncode == 0, f"git {' '.join(args)} failed: {done.stderr.strip()}")
    return done.stdout


def merge_base() -> str:
    import os

    override = os.environ.get("WIRING_BASE")
    if override:
        return override
    return git("merge-base", "HEAD", "origin/main").strip()


def changed_files() -> list[str]:
    base = merge_base()
    names = set(git("diff", "--name-only", base).splitlines())
    names |= set(git("ls-files", "--others", "--exclude-standard").splitlines())
    return sorted(n for n in names if n)


def anchored(text: str, name: str) -> str:
    lines = text.split("\n")
    for index, line in enumerate(lines[:-1]):
        if f"// anchor: {name}" in line:
            return lines[index + 1]
    fail(f"anchor {name} missing")
    return ""


def index_of(text: str, token: str) -> int:
    at = text.find(token)
    need(at >= 0, f"missing {token!r}")
    return at


def code_only(text: str) -> str:
    return "\n".join(l for l in text.split("\n") if not l.strip().startswith(("//", "*", "/*")))


# --------------------------------------------------------------------------------------------- checks

def check_access_anchors() -> None:
    text = read(ACCESS)
    need(re.search(r"from '\./recovery-token'", text) is not None, "lib/recovery-access.ts imports ./recovery-token by RELATIVE path (the golden runs without the @ alias)")
    need("RECOVERY_TOKEN_MAX_LENGTH = 2048" in text, "RECOVERY_TOKEN_MAX_LENGTH = 2048 is a named export")
    pinned = {
        "ra-secret": "if (!input.secret)",
        "ra-input": "typeof input.rawToken !== 'string'",
        "ra-verify": "verifyRecoveryToken({ token: input.rawToken, secret: input.secret, now: input.now })",
        "ra-verify-denied": "if (!verified.ok || verified.orderId.length === 0 || verified.orderId.includes('/'))",
        "ra-load": "await input.loadOrder(verified.orderId)",
        "ra-entitled": "record === null || record.status !== 'paid' || record.reference === '' || record.recoveryToken === null",
        "ra-default-match": "input.tokensMatch ?? constantTimeStringEqual",
        "ra-stored-match": "!tokensMatch(record.recoveryToken, input.rawToken)",
        "ra-denied-helper": "({ ok: false })",
        "ra-success": "{ ok: true, reference: record.reference }",
    }
    for name, token in pinned.items():
        need(token in anchored(text, name), f"anchor {name}: next line must contain {token!r}")
    need("RECOVERY_TOKEN_MAX_LENGTH" in anchored(text, "ra-input"), "anchor ra-input enforces the length cap")
    need(text.count("constantTimeStringEqual") >= 2, "the stored-token comparison is lib/recovery-token's constantTimeStringEqual (import + use)")
    need(re.search(r"recoveryToken\s*[!=]==?\s*input\.rawToken", code_only(text)) is None, "no raw comparison of the stored token (compare via tokensMatch)")


def check_page_wiring() -> None:
    text = read(PAGE)
    code = code_only(text)
    need("export const dynamic = 'force-dynamic';" in text, "page is force-dynamic")
    need(re.search(r"robots:\s*\{\s*index:\s*false,\s*follow:\s*false", text) is not None, "page metadata is noindex,nofollow")
    need("referrer: 'no-referrer'" in text, "page metadata sets referrer no-referrer")
    for banned in ("generateStaticParams", "revalidate", "unstable_cache", "use cache", "fetchCache", "generateMetadata", "'use client'", "cookies(", "headers("):
        need(banned not in code, f"page must not use {banned}")
    need(re.search(r"\.reason\b|reason:", code) is None, "page never reads a failure reason (non-enumerating)")
    need("RECOVERY_TOKEN_SECRET" in code, "page passes process.env.RECOVERY_TOKEN_SECRET")
    need("getOrderRecoveryRecord" in code, "page injects getOrderRecoveryRecord as loadOrder")
    resolve = anchored(text, "recover-resolve")
    need("resolveRecoveryAccess(" in resolve, "anchor recover-resolve: resolveRecoveryAccess(")
    denied = anchored(text, "recover-denied")
    need("if (!access.ok)" in denied, "anchor recover-denied: if (!access.ok)")
    need("access.ok" not in denied.replace("!access.ok", ""), "recover-denied tests nothing but !access.ok")
    render = anchored(text, "recover-order")
    need("getConfirmedOrderForDisplay(access.reference)" in render, "anchor recover-order: the order is loaded by access.reference only")
    miss = anchored(text, "recover-order-missing")
    need("if (!confirmed)" in miss, "anchor recover-order-missing: if (!confirmed)")
    # Both failure arms end in notFound(), and nothing renders before them.
    for name in ("recover-denied", "recover-order-missing"):
        at = text.index(f"// anchor: {name}")
        window = text[at : at + 160]
        need("notFound();" in window, f"{name}: the branch calls notFound() and nothing else")
    need(text.index("// anchor: recover-resolve") < text.index("// anchor: recover-denied") < text.index("// anchor: recover-order") < text.index("// anchor: recover-order-missing") < text.index("<ConfirmedTicketList"), "resolve, deny, load, deny, then render")
    need("<ConfirmedTicketList" in text, "success renders the shared ConfirmedTicketList")
    need("<form" not in code and "method=" not in code, "no form on the recover page (resend is out of scope)")
    need(re.search(r"title=\"Tickets\"|title='Tickets'|title=\{'Tickets'\}", text) is not None, "hero title is the existing confirmation-page string Tickets")
    need('route="/tickets/confirmation"' in text, "hero route key is the existing /tickets/confirmation")
    need(PAGE == "app/(nos)/tickets/recover/page.tsx", "static recover segment beside [slug]")
    need(not (ROOT / "app/(nos)/tickets/recover/[...rest]").exists() and not (ROOT / "app/(nos)/tickets/recover/layout.tsx").exists(), "no extra segments or layout under recover")


def check_orders_addition() -> None:
    base = merge_base()
    diff = git("diff", "-U0", base, "--", ORDERS)
    removed = [l for l in diff.splitlines() if l.startswith("-") and not l.startswith("---")]
    need(not removed, f"lib/orders.ts change must be a pure addition, removed: {removed[:3]}")
    added = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
    need("export async function getOrderRecoveryRecord(" in added, "adds export getOrderRecoveryRecord")
    for banned in (".set(", ".update(", ".delete(", ".add(", "runTransaction", ".batch(", "console."):
        need(banned not in added, f"getOrderRecoveryRecord is read-only and silent: {banned}")
    need(".doc(orderId)" in added, "reads the order by the signed id (a get by id, never a query on the token)")
    need("recoveryToken" in added and "m_payment_id" in added and "status" in added, "returns reference (m_payment_id), recoveryToken and status")
    need("where(" not in added, "no collection query")


def check_no_logging() -> None:
    for rel in NEW_FILES:
        need("console." not in code_only(read(rel)), f"{rel}: no console.* (a token must never reach a log, and bad tokens must not flood one)")


def check_extraction_verbatim() -> None:
    base = merge_base()
    diff = git("diff", "-U0", base, "--", CONFIRM)
    norm = lambda l: l.strip().replace("confirmedOrder.reference", "orderReference")
    removed = [norm(l[1:]) for l in diff.splitlines() if l.startswith("-") and not l.startswith("---")]
    component = {norm(l) for l in read(LIST).split("\n")}
    kept = {l.strip() for l in read(CONFIRM).split("\n")}
    lost = [l for l in removed if l and not l.startswith(("const ", "import ", "//")) and l not in component and l not in kept]
    need(not lost, f"lines removed from the confirmation page that are not in ConfirmedTicketList verbatim: {lost[:4]}")
    comp = read(LIST)
    for token in ("qrDataUri", "Booking ref:", "DownloadTicketButton", "QR code for booking reference", "scan at the door for check-in"):
        need(token in comp, f"ConfirmedTicketList keeps {token!r}")
    need("<ConfirmedTicketList" in read(CONFIRM), "confirmation page renders ConfirmedTicketList")
    need("Download ticket" not in comp, "button label stays a prop, not a literal in the list")


def check_no_new_copy() -> None:
    base = merge_base()
    literal = re.compile(r"'([^'\n]{3,})'|\"([^\"\n]{3,})\"|>([A-Za-z][^<>{}\n]{3,})<")
    found = []
    for rel in (PAGE, LIST, ACCESS):
        for line in read(rel).split("\n"):
            s = line.strip()
            if s.startswith(("//", "*", "/*", "import ")) or "console." in line or "anchor:" in line or "Error(" in line or "className" in s and "=" in s and "'" not in s:
                continue
            for m in literal.finditer(line):
                text = next(g for g in m.groups() if g)
                if text.count(" ") < 1 or not re.fullmatch(r"[A-Z][A-Za-z0-9 ,.'’!?:;()\-—/]+", text):
                    continue
                present = subprocess.run(["git", "grep", "-F", "-q", "--", text, base, "--", "app", "components", "lib"], cwd=ROOT, capture_output=True).returncode == 0
                if not present:
                    found.append(f"{rel}: {text!r}")
    need(not found, "new user-facing copy (docs/rules/no-invention.md): " + "; ".join(found))


def check_no_resend() -> None:
    names = changed_files()
    need(not any("resend" in n.lower() and n.startswith("app/") for n in names), "no resend route in this feature")
    for rel in NEW_FILES:
        t = code_only(read(rel))
        need("sendEmail" not in t and "sendConfirmationEmail" not in t and "lib/email" not in t, f"{rel} sends no email")
        need("firebase-admin" not in t and "getFirestore" not in t, f"{rel} touches Firestore only through lib/orders")
    need(".set(" not in code_only(read(PAGE)), "page writes nothing")


def check_cache_probe_entries() -> None:
    data = json.loads(read(CACHE))
    dynamic = data["routes"]["dynamic"]
    hits = [r for r in dynamic if r.get("host") == "nos" and r.get("path") == "/tickets/recover?token=bogus"]
    need(len(hits) == 1, "routes.dynamic needs exactly one nos entry for /tickets/recover?token=bogus")
    need(hits[0].get("status") == 404, "the bogus-token entry records status 404 (the not-found page)")
    for route in data["routes"]["isr"] + data["routes"]["static"]:
        need("recover" not in route.get("path", ""), "the recover route is never classed isr or static")
    existing = [r for r in dynamic if r.get("path") == "/tickets/no-such-ticket-f4"]
    need(len(existing) == 1 and existing[0].get("status") == 404, "the existing f4 entry is untouched")


def check_hunk_list() -> None:
    extra = sorted(n for n in changed_files() if n not in ALLOWED_FILES and not n.startswith(SPEC_DIR))
    need(not extra, f"files outside the hunk list: {extra}")


def check_unchanged() -> None:
    base = merge_base()
    for rel in UNCHANGED:
        need(subprocess.run(["git", "diff", "--quiet", base, "--", rel], cwd=ROOT).returncode == 0, f"{rel} must be unchanged")
        need(not git("ls-files", "--others", "--exclude-standard", "--", rel).strip(), f"{rel} gained an untracked file")
    need("const TICKETING_PAYMENTS_LIVE = false;" in read("lib/ticketing-test-mode.ts"), "this feature does not launch payments")


def check_config_shape() -> None:
    text = read(NEXT_CONFIG)
    need("'/tickets/recover'" in text, "next.config.ts has a rule for /tickets/recover")
    need(text.count("SECURITY_HEADERS") >= 3, "the security header list stays the single source for both rules")


def check_routes_manifest() -> None:
    manifest = json.loads(read(".next/routes-manifest.json"))
    static = {r["page"] for r in manifest.get("staticRoutes", [])}
    dynamic = {r["page"] for r in manifest.get("dynamicRoutes", [])}
    need("/tickets/recover" in static, "built routes-manifest lists /tickets/recover as a static route (static segments win over [slug])")
    need("/tickets/[slug]" in dynamic, "[slug] is still a dynamic route (the recover segment is not a rename of it)")


CHECKS = {
    "access-anchors": check_access_anchors,
    "page-wiring": check_page_wiring,
    "orders-addition": check_orders_addition,
    "no-logging": check_no_logging,
    "extraction-verbatim": check_extraction_verbatim,
    "no-new-copy": check_no_new_copy,
    "no-resend": check_no_resend,
    "cache-probe-entries": check_cache_probe_entries,
    "hunk-list": check_hunk_list,
    "unchanged": check_unchanged,
    "config-shape": check_config_shape,
    "routes-manifest": check_routes_manifest,
}


def main() -> int:
    global ROOT
    parser = argparse.ArgumentParser()
    parser.add_argument("check", choices=sorted(CHECKS))
    parser.add_argument("--root", default=None)
    args = parser.parse_args()
    if args.root:
        ROOT = Path(args.root).resolve()
    CHECKS[args.check]()
    print(f"PASS: {args.check}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
