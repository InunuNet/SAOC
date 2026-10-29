#!/usr/bin/env python3
"""Static wiring checks for nos-recovery-ttl. Frozen by @architect; @dev implements against it.

Usage: check_wiring.py <check> [--root DIR]     (exit 0 pass, 1 fail, 2 usage)
Reads source text and `git diff` only. No network, no Firestore, no secrets, writes nothing.
`// anchor: <name>` marks the ONE statement on the next line that a mutation (run_mutations.py) breaks.
These checks prove placement, ordering, absence and the size of the route.ts diff. Behaviour is proved by the
goldens (recovery-expiry, recovery-mint, checkout-mint-site), which execute the real code.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]

EXPIRY = "lib/recovery-expiry.ts"
TOKEN = "lib/recovery-token.ts"
ROUTE = "app/api/tickets/checkout/route.ts"
SPEC_DIR = ".agent/memory/project/specs/nos-recovery-ttl/"
ALLOWED_FILES = {EXPIRY, TOKEN, ROUTE, "docs/nos-recovery-ttl.md"}
UNCHANGED = [
    "lib/recovery-access.ts", "lib/recovery-url.ts", "lib/show-window-lookup.ts", "lib/show-resolution.ts",
    "lib/checkout-reservation.ts", "lib/orders.ts", "lib/admin-auth.ts", "sanity", "proxy.ts", "next.config.ts",
    "app/(nos)", "app/(marketing)", "app/admin", "app/api/admin", "app/api/vendors", "firestore.rules",
    "firestore.indexes.json", "apphosting.yaml", "package.json", "pnpm-lock.yaml", "contracts/checks",
    "contracts/golden", ".claude", "execution", "CLAUDE.md", "AGENTS.md", "types",
]
EXISTING_COPY = "Ticket recovery is not configured. Please try again later."
ROUTE_ADDED_ALLOWED = {
    "import { resolveRecoveryExpiry } from '@/lib/recovery-expiry';",
    "recoveryExpiresAt: Date;",
    "const recoveryExpiry = resolveRecoveryExpiry({ showWindow, now: new Date() });",
    "if (!recoveryExpiry.ok) {",
    "console.error('[tickets/checkout] Cannot set the recovery link expiry.', { code: recoveryExpiry.code });",
    "return NextResponse.json(",
    f"{{ error: '{EXISTING_COPY}' }},",
    "{ status: 500 }",
    ");",
    "}",
    "recoveryExpiresAt: recoveryExpiry.expiresAt,",
    "expiresAt: input.recoveryExpiresAt,",
}


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
    names = set(git("diff", "--name-only", merge_base()).splitlines())
    names |= set(git("ls-files", "--others", "--exclude-standard").splitlines())
    return sorted(n for n in names if n)


def anchored(text: str, name: str) -> str:
    lines = text.split("\n")
    for index, line in enumerate(lines[:-1]):
        if f"// anchor: {name}" in line:
            return lines[index + 1]
    fail(f"anchor {name} missing")
    return ""


def code_only(text: str) -> str:
    return "\n".join(l for l in text.split("\n") if not l.strip().startswith(("//", "*", "/*")))


# --------------------------------------------------------------------------------------------- checks

def check_route_wiring() -> None:
    text = read(ROUTE)
    code = code_only(text)
    post = text[text.index("export async function POST("):text.index("async function reserveTicket(")]
    guard = post.index("if (!recoveryTokenSecret)")
    resolve = post.index("// anchor: rx-resolve")
    refuse = post.index("// anchor: rx-refuse")
    reserve = post.index("reserveTicket({")
    need(guard < resolve < refuse < reserve, "order in POST: secret guard, rx-resolve, rx-refuse, then reserveTicket({ (refuse before any write)")
    need("resolveRecoveryExpiry({ showWindow, now: new Date() })" in anchored(text, "rx-resolve"), "anchor rx-resolve: the ONLY input is the existing showWindow and a fresh Date (no new Sanity read, no literal date)")
    need("const recoveryExpiry =" in anchored(text, "rx-resolve"), "anchor rx-resolve binds recoveryExpiry")
    need("if (!recoveryExpiry.ok)" in anchored(text, "rx-refuse"), "anchor rx-refuse: if (!recoveryExpiry.ok)")
    block = post[refuse:post.index("\n  }\n", refuse) + 5]
    need("return NextResponse.json(" in block and "status: 500" in block, "the refusal returns an HTTP 500 response")
    need(re.findall(r"error: '([^']*)'", block) == [EXISTING_COPY], "the refusal reuses the existing recovery copy and adds none")
    need(block.count("console.error(") == 1 and "code: recoveryExpiry.code" in block, "exactly one log line carrying the refusal code")
    reserve_call = post[reserve:post.index("});", reserve)]
    need("recoveryExpiresAt: recoveryExpiry.expiresAt," in reserve_call, "reserveTicket is handed recoveryExpiry.expiresAt")
    need(len(re.findall(r"mintRecoveryToken\(", code)) == 1, "exactly one mintRecoveryToken call in the route")
    call = re.search(r"mintRecoveryToken\(\{(.*?)\}\)", code, re.S)
    need(call is not None, "mint call found")
    body = call.group(1) if call else ""
    need("expiresAt: input.recoveryExpiresAt," in body, "mint passes expiresAt: input.recoveryExpiresAt")
    need("ttlMs" not in body, "mint passes no ttlMs")
    need(re.search(r"recoveryExpiresAt: Date;", text) is not None, "ReservationInput declares recoveryExpiresAt: Date (required, not optional)")
    need(re.search(r"from '@/lib/recovery-expiry'", text) is not None, "imports resolveRecoveryExpiry from @/lib/recovery-expiry")


def check_route_hunks() -> None:
    diff = git("diff", "-U0", merge_base(), "--", ROUTE)
    removed = [l[1:] for l in diff.splitlines() if l.startswith("-") and not l.startswith("---")]
    added = [l[1:].strip() for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++")]
    need(removed == [], f"route.ts diff removes no line (additions only, keeps the merge with the abuse-controls branch trivial): {removed[:3]}")
    stray = [l for l in added if l and not l.startswith("//") and l not in ROUTE_ADDED_ALLOWED]
    need(stray == [], f"route.ts diff adds only the pinned lines; stray: {stray[:3]}")
    hunks = [l for l in diff.splitlines() if l.startswith("@@")]
    need(len(hunks) <= 5, f"route.ts diff has at most 5 hunks (import, input type, guard, reserve arg, mint arg); found {len(hunks)}")
    comments = [l for l in added if l.startswith("//")]
    need(all(("anchor:" in l) or len(l) < 200 for l in comments), "comments stay short")


def check_pure_module() -> None:
    text = read(EXPIRY)
    code = code_only(text)
    need(not re.search(r"^\s*import\s", code, re.M), "lib/recovery-expiry.ts has no imports (pure; no Sanity, no Firestore, no node:crypto)")
    for banned in ("process.env", "fetch(", "console.", "new Date()", "Date.now(", "setTimeout", "Math.random"):
        need(banned not in code, f"lib/recovery-expiry.ts must not use {banned} (time is injected, nothing is logged, nothing is read)")
    need(not re.search(r"\b2027\b|\b2026\b|2028|'20\d\d-", code), "no literal show date in lib/recovery-expiry.ts (the end date comes from the show record)")
    need("180" not in code and "RECOVERY_TOKEN_DEFAULT_TTL_MS" not in code, "lib/recovery-expiry.ts has no 180-day fallback")
    for name in ("computeRecoveryExpiry", "resolveRecoveryExpiry", "RecoveryExpiryError"):
        need(re.search(rf"export (function|class) {name}\b", text) is not None, f"exports {name}")
    need("RECOVERY_DAYS_AFTER_SHOW_END = 7" in text, "named constant RECOVERY_DAYS_AFTER_SHOW_END = 7")


def check_token_additive() -> None:
    base = merge_base()
    new = read(TOKEN)
    old = git("show", f"{base}:{TOKEN}")
    marker = "export function verifyRecoveryToken("
    need(old[old.index(marker):] == new[new.index(marker):], "verifyRecoveryToken and everything after it is byte-identical to origin/main")
    need("export const RECOVERY_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 180;" in new, "the legacy constant stays exported unchanged (F6 checks and the typecheck fixture import it)")
    need("expiresAt?: Date;" in new, "MintRecoveryTokenInput gains optional expiresAt?: Date")
    need("// anchor: rt-explicit-guard" in new, "guard anchor present")
    need("Number.isFinite(expiresAtEpochMs)" in anchored(new, "rt-explicit-guard") and "expiresAtEpochMs <= input.now.getTime()" in anchored(new, "rt-explicit-guard"), "explicit expiry must be finite and strictly after now")
    removed = [l[1:].strip() for l in git("diff", "-U0", base, "--", TOKEN).splitlines() if l.startswith("-") and not l.startswith("---")]
    allowed = {"const ttlMs = input.ttlMs ?? RECOVERY_TOKEN_DEFAULT_TTL_MS;", "const expiresAtEpochMs = input.now.getTime() + ttlMs;"}
    need(all(l in allowed or l.startswith(("*", "/*", "//")) for l in removed), f"recovery-token.ts removes only the two ttl lines (and doc comments); removed: {removed}")


def check_no_default_ttl() -> None:
    offenders: list[str] = []
    for top in ("app", "lib"):
        for path in sorted((ROOT / top).rglob("*")):
            if path.suffix not in (".ts", ".tsx") or not path.is_file():
                continue
            rel = path.relative_to(ROOT).as_posix()
            code = code_only(path.read_text(encoding="utf-8"))
            if rel != TOKEN and "RECOVERY_TOKEN_DEFAULT_TTL_MS" in code:
                offenders.append(f"{rel} references RECOVERY_TOKEN_DEFAULT_TTL_MS")
            if rel not in (TOKEN, ROUTE) and "mintRecoveryToken" in code:
                offenders.append(f"{rel} references mintRecoveryToken (the checkout route is the only minter; aliases and re-exports would evade the call scan)")
            if rel != TOKEN:
                for call in re.finditer(r"mintRecoveryToken\(\{(.*?)\}\)", code, re.S):
                    if "expiresAt:" not in call.group(1) or "ttlMs" in call.group(1):
                        offenders.append(f"{rel} mints without an explicit expiresAt (or with ttlMs)")
    need(not offenders, "; ".join(offenders))


def check_no_new_copy() -> None:
    diff = git("diff", "-U0", merge_base(), "--", EXPIRY, TOKEN, ROUTE, "docs")
    literals = [m for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++") and not l.strip().startswith(("+//", "+ *", "+/*")) for m in re.findall(r"'([^'\n]{12,})'", l)]
    allowed = {EXISTING_COPY, "[tickets/checkout] Cannot set the recovery link expiry.", "@/lib/recovery-expiry", "recovery token expiresAt must be a valid instant after now"}
    new_literals = [m for m in literals if m not in allowed and not m.startswith(("@/", "./", "node:"))]
    need(not new_literals, f"no new user-facing string literals; found {new_literals[:3]}")
    for path in (EXPIRY,):
        need(not re.search(r"<[A-Za-z]", code_only(read(path))), f"{path} contains no JSX")


def check_hunk_list() -> None:
    stray = [n for n in changed_files() if n not in ALLOWED_FILES and not n.startswith(SPEC_DIR)]
    need(not stray, f"files outside the hunk list: {stray}")


def check_unchanged() -> None:
    changed = changed_files()
    touched = [n for n in changed if any(n == u or n.startswith(u.rstrip("/") + "/") for u in UNCHANGED)]
    need(not touched, f"frozen files touched: {touched}")


def check_no_writes() -> None:
    for rel in (EXPIRY,):
        code = code_only(read(rel))
        for banned in (".set(", ".update(", ".delete(", ".create(", "firebase-admin", "getFirestore", "sanity", "client.fetch"):
            need(banned not in code, f"{rel} must not contain {banned}")
    diff = git("diff", "-U0", merge_base(), "--", ROUTE)
    added = "\n".join(l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
    for banned in (".set(", ".update(", ".delete(", "transaction.", "client.fetch", "getFirestore"):
        need(banned not in added, f"route.ts additions must not contain {banned} (no new write, no new Sanity read)")


CHECKS = {
    "route-wiring": check_route_wiring,
    "route-hunks": check_route_hunks,
    "pure-module": check_pure_module,
    "token-additive": check_token_additive,
    "no-default-ttl": check_no_default_ttl,
    "no-new-copy": check_no_new_copy,
    "hunk-list": check_hunk_list,
    "unchanged": check_unchanged,
    "no-writes": check_no_writes,
}


def main() -> int:
    global ROOT
    args = sys.argv[1:]
    if "--root" in args:
        at = args.index("--root")
        ROOT = Path(args[at + 1]).resolve()
        del args[at:at + 2]
    if len(args) != 1 or args[0] not in CHECKS:
        print(f"usage: check_wiring.py <{'|'.join(CHECKS)}> [--root DIR]", file=sys.stderr)
        return 2
    CHECKS[args[0]]()
    print(f"ok: {args[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
