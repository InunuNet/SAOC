#!/usr/bin/env python3
"""Mutation proof for nos-order-recovery. Frozen by @architect; @dev never edits it.

Each mutation breaks one anchored (or uniquely identified) line in a source file, runs the check that
is meant to kill it, and requires that check to FAIL. Files are restored byte for byte, also on failure.
A baseline run of the killing check must pass first. Local files only: no network, no Firestore.
Modes: anchor (the line after `// anchor: <name>`), first / last (str.replace), append, create.
Run: python3 .agent/memory/project/specs/nos-order-recovery/goldens/run_mutations.py [--heavy] [ID ...]
`--heavy` adds the mutations that need a production build (each one rebuilds, about two minutes, and runs
check-recover-live.mts; the gate env of contract.yaml must be exported); without it they are listed as SKIPPED, never counted as killed.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
SPEC = ".agent/memory/project/specs/nos-order-recovery/goldens"
SANDBOX = ROOT / ".tmp/sandbox/nos-order-recovery-mutations"


def golden(name: str) -> list[str]:
    return ["pnpm", "exec", "tsx", f"{SPEC}/{name}.golden.ts"]


def wiring(name: str) -> list[str]:
    return ["python3", f"{SPEC}/check_wiring.py", name]


ACCESS = "lib/recovery-access.ts"
PAGE = "app/(nos)/tickets/recover/page.tsx"
LIST = "components/tickets/ConfirmedTicketList.tsx"
CONFIRM = "app/(nos)/tickets/confirmation/page.tsx"
ORDERS = "lib/orders.ts"
CONFIG = "next.config.ts"
PROXY = "proxy.ts"
CACHE = ".agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/cache-header-expectations.json"
ACCESS_G = golden("recovery-access")
BIND_G = golden("confirmed-order-binding")
HEADERS_G = golden("recover-headers")
PROXY_G = golden("proxy-routing")
BUILD = "node scripts/checks/sanity-request-count.mjs --build"
# The live check runs the BUILT server, so a source mutation only counts after a rebuild. The server must not
# run in fixture-replay mode (the stub in the preload answers Sanity), hence env -u on the run, not the build.
LIVE = ["bash", "-c", f"{BUILD} > /dev/null 2>&1 && env -u SANITY_FIXTURE_MODE -u SANITY_FIXTURE_DIR pnpm exec tsx {SPEC}/check-recover-live.mts"]
HEAVY = {"L01", "L02"}

# (id, file, mode, anchor, old, new, killing check)
MUTATIONS = [
    # --- lib/recovery-access.ts (recovery-access.golden.ts)
    ("A01", ACCESS, "anchor", "ra-secret", "!input.secret", "false", ACCESS_G),
    ("A02", ACCESS, "anchor", "ra-input", " > RECOVERY_TOKEN_MAX_LENGTH", " > RECOVERY_TOKEN_MAX_LENGTH * 100", ACCESS_G),
    ("A03", ACCESS, "anchor", "ra-input", "typeof input.rawToken !== 'string'", "typeof input.rawToken !== 'object'", ACCESS_G),
    ("A04", ACCESS, "anchor", "ra-verify", "verifyRecoveryToken(", "((x: unknown) => ({ ok: true as const, orderId: 'order-A', expiresAt: new Date() }))(", ACCESS_G),
    ("A05", ACCESS, "anchor", "ra-verify-denied", "!verified.ok ||", "false ||", ACCESS_G),
    ("A06", ACCESS, "anchor", "ra-verify-denied", "verified.orderId.length === 0 ||", "", ACCESS_G),
    ("A07", ACCESS, "anchor", "ra-verify-denied", "|| verified.orderId.includes('/')", "", ACCESS_G),
    ("A08", ACCESS, "anchor", "ra-entitled", "record === null ||", "", ACCESS_G),
    ("A09", ACCESS, "anchor", "ra-entitled", "record.status !== 'paid' ||", "", ACCESS_G),
    ("A10", ACCESS, "anchor", "ra-entitled", "record.reference === '' ||", "", ACCESS_G),
    ("A11", ACCESS, "anchor", "ra-entitled", "|| record.recoveryToken === null", "", ACCESS_G),
    ("A12", ACCESS, "anchor", "ra-stored-match", "!tokensMatch(record.recoveryToken, input.rawToken)", "false", ACCESS_G),
    ("A13", ACCESS, "anchor", "ra-stored-match", "(record.recoveryToken, input.rawToken)", "(input.rawToken, input.rawToken)", ACCESS_G),
    ("A14", ACCESS, "anchor", "ra-denied-helper", "({ ok: false })", "({ ok: false, reason: 'denied' } as { ok: false })", ACCESS_G),
    ("A15", ACCESS, "anchor", "ra-success", "{ ok: true, orderId: verified.orderId }", "{ ok: true, orderId: verified.orderId, token: input.rawToken } as { ok: true; orderId: string }", ACCESS_G),
    ("A24", ACCESS, "anchor", "ra-success", "orderId: verified.orderId", "orderId: record.reference", ACCESS_G),
    ("A16", ACCESS, "anchor", "ra-default-match", "input.tokensMatch ?? constantTimeStringEqual", "input.tokensMatch ?? ((a: string, b: string) => a === b)", wiring("access-anchors")),
    ("A17", ACCESS, "anchor", "ra-load", "input.loadOrder(verified.orderId)", "input.loadOrder(input.rawToken)", ACCESS_G),
    ("A20", ACCESS, "anchor", "ra-shape", "RECOVERY_TOKEN_SHAPE.test(input.rawToken)", "true", ACCESS_G),
    ("A21", ACCESS, "anchor", "ra-shape", "!RECOVERY_TOKEN_SHAPE.test(input.rawToken)", "RECOVERY_TOKEN_SHAPE.test(input.rawToken)", ACCESS_G),
    ("A22", ACCESS, "first", None, "[0-9a-f]{64}$/", "[0-9a-f]{1,64}$/", wiring("access-anchors")),
    ("A23", ACCESS, "first", None, "RECOVERY_TOKEN_SHAPE = /^[A-Za-z0-9_-]+\\.", "RECOVERY_TOKEN_SHAPE = /^[A-Za-z0-9_-]*\\.", ACCESS_G),
    ("A25", ACCESS, "append", None, "", "\nconsole['error'](String(0));\n", wiring("no-logging")),
    ("A26", ACCESS, "append", None, "", "\nconst c = globalThis.console;\n", wiring("no-logging")),
    ("P19", PAGE, "append", None, "", "\nconsole[\"warn\"](String(0));\n", wiring("no-logging")),
    ("P20", PAGE, "append", None, "", "\nprocess.stderr.write(String(0));\n", wiring("no-logging")),
    ("O06", ORDERS, "append", None, "", "\nconst leak = (t: string) => console['error'](t);\n", wiring("no-logging")),
    ("O07", LIST, "append", None, "", "\nconst { log } = console;\n", wiring("no-logging")),
    ("A18", ACCESS, "append", None, "", "\nconsole.error('bad token');\n", wiring("no-logging")),
    ("A19", ACCESS, "first", None, "from './recovery-token'", "from '@/lib/recovery-token'", wiring("access-anchors")),
    # --- app/(nos)/tickets/recover/page.tsx (check_wiring page-wiring and friends)
    ("P01", PAGE, "first", None, "export const dynamic = 'force-dynamic';", "export const revalidate = 60;", wiring("page-wiring")),
    ("P02", PAGE, "first", None, "referrer: 'no-referrer'", "referrer: 'origin'", wiring("page-wiring")),
    ("P03", PAGE, "first", None, "index: false", "index: true", wiring("page-wiring")),
    ("P04", PAGE, "anchor", "recover-denied", "if (!access.ok)", "if (false)", wiring("page-wiring")),
    ("P05", PAGE, "anchor", "recover-order", "getConfirmedOrderByOrderId(access.orderId)", "getConfirmedOrderForDisplay(String(token))", wiring("page-wiring")),
    ("P15", PAGE, "anchor", "recover-order", "access.orderId", "String(token)", wiring("page-wiring")),
    ("P06", PAGE, "anchor", "recover-order-missing", "if (!confirmed)", "if (false)", wiring("page-wiring")),
    ("P07", PAGE, "append", None, "", "\nconsole.error(String(0));\n", wiring("no-logging")),
    ("P08", PAGE, "append", None, "", "\nconst why = (undefined as unknown as { reason: string }).reason;\n", wiring("page-wiring")),
    ("P09", PAGE, "append", None, "", "\nconst f = <form method=\"post\" />;\n", wiring("page-wiring")),
    ("P10", PAGE, "append", None, "", "\nexport async function generateStaticParams() { return []; }\n", wiring("page-wiring")),
    ("P11", PAGE, "first", None, "process.env.RECOVERY_TOKEN_SECRET", "'fixed-secret'", wiring("page-wiring")),
    ("P12", PAGE, "first", None, 'title="Tickets"', 'title="Your recovered tickets are here"', wiring("no-new-copy")),
    ("P16", PAGE, "first", None, "<ConfirmedTicketList", "<p>Resend</p><ConfirmedTicketList", wiring("no-new-copy")),
    ("P17", PAGE, "first", None, "<ConfirmedTicketList", "<a aria-label=\"Resend\" /><ConfirmedTicketList", wiring("no-new-copy")),
    ("P18", PAGE, "first", None, "<ConfirmedTicketList", "{'Resend'}<ConfirmedTicketList", wiring("no-new-copy")),
    ("O05", LIST, "first", None, "<DownloadTicketButton", "<span>Resend</span><DownloadTicketButton", wiring("no-new-copy")),
    ("P13", PAGE, "append", None, "", "\nimport { sendEmail } from '@/lib/email';\n", wiring("no-resend")),
    ("P14", "app/api/tickets/resend-my-tickets/route.ts", "create", None, "", "export const POST = 1;\n", wiring("no-resend")),
    # --- lib/orders.ts, components, confirmation page
    ("O01", ORDERS, "append", None, "", "\nconst w = (r: { set: (x: unknown) => void }) => r.set(1);\n", wiring("orders-addition")),
    ("O02", ORDERS, "first", None, "status: 'paid',", "status: 'paid ',", wiring("orders-addition")),
    ("C01", ORDERS, "anchor", "co-lookup", ".doc(orderId)", ".doc('order-B')", BIND_G),
    ("C03", ORDERS, "anchor", "co-paid", "order?.status !== 'paid'", "false", BIND_G),
    ("C04", ORDERS, "anchor", "co-positions", "'==', orderId)", "'==', 'order-B')", BIND_G),
    ("C06", ORDERS, "first", None, "export async function getConfirmedOrderByOrderId(", "export async function getConfirmedOrderByOrderId_(", BIND_G),
    ("O03", LIST, "first", None, "Booking ref:", "Reference:", wiring("extraction-verbatim")),
    ("O04", CONFIRM, "first", None, "<ConfirmedTicketList", "<div", wiring("extraction-verbatim")),
    # --- cache probe entry
    ("K01", CACHE, "first", None, '"path": "/tickets/recover?token=bogus", "status": 404', '"path": "/tickets/recover?token=bogus", "status": 200', wiring("cache-probe-entries")),
    ("K02", CACHE, "first", None, '"path": "/tickets/recover?token=bogus"', '"path": "/tickets/recover"', wiring("cache-probe-entries")),
    # --- next.config.ts headers (recover-headers.golden.ts)
    ("H01", CONFIG, "first", None, "value: 'no-referrer'", "value: 'origin'", HEADERS_G),
    ("H02", CONFIG, "first", None, "value: 'private, no-store, max-age=0'", "value: 'public, max-age=60'", HEADERS_G),
    ("H03", CONFIG, "first", None, "value: 'noindex, nofollow'", "value: 'index'", HEADERS_G),
    ("H04", CONFIG, "first", None, "source: '/tickets/recover'", "source: '/tickets/recoverx'", HEADERS_G),
    ("H05", CONFIG, "first", None, "(?!tickets/recover/?$)", "(?!tickets/recoverz/?$)", HEADERS_G),
    ("H06", CONFIG, "first", None, "'/:path((?!tickets/recover/?$).*)'", "'/:path*'", HEADERS_G),
    ("H07", CONFIG, "first", None, "'/:path((?!tickets/recover/?$).*)'", "'/:path((?!tickets/recover$).*)'", HEADERS_G),
    # --- proxy.ts is not edited; a regression there must break the emailed link (proxy-routing.golden.ts)
    ("X01", PROXY, "first", None, "const NOS_TOP_LEVEL_PREFIXES = ['/vsp', '/tickets'];", "const NOS_TOP_LEVEL_PREFIXES = ['/vsp'];", PROXY_G),
    ("X02", PROXY, "first", None, "const SHOW_PREFIXES = [NOS_INTERNAL_PREFIX, '/tickets', '/vsp'];", "const SHOW_PREFIXES = [NOS_INTERNAL_PREFIX, '/vsp'];", PROXY_G),
    ("X03", PROXY, "first", None, "if (isUnderAny(pathname, SHOW_PREFIXES)) return redirectTo(nosUrl(`${pathname}${search}`));", "if (isUnderAny(pathname, SHOW_PREFIXES)) return redirectTo(nosUrl(`${pathname}`));", PROXY_G),
    # --- live server (needs a build): the page must not let any token class diverge
    ("L01", PAGE, "anchor", "recover-denied", "if (!access.ok)", "if (!access.ok && String(token) !== 'abc')", LIVE),
    ("L02", ACCESS, "anchor", "ra-verify-denied", "!verified.ok ||", "false ||", LIVE),
    # --- frozen files
    ("U01", "lib/recovery-token.ts", "append", None, "", "\n// touched\n", wiring("unchanged")),
    ("U02", "lib/recovery-url.ts", "append", None, "", "\n// touched\n", wiring("unchanged")),
    ("U03", "app/(nos)/tickets/[slug]/page.tsx", "append", None, "", "\n// touched\n", wiring("unchanged")),
    ("B01", "lib/extra-recovery-helper.ts", "create", None, "", "export const extra = 1;\n", wiring("hunk-list")),
]


def passes(command: list[str]) -> bool:
    return subprocess.run(command, cwd=ROOT, capture_output=True, text=True).returncode == 0


def mutate(text: str, mode: str, anchor: str | None, old: str, new: str) -> str | None:
    if mode == "append":
        return text + new
    if mode == "first":
        return text.replace(old, new, 1) if old in text else None
    if mode == "last":
        index = text.rfind(old)
        return None if index < 0 else text[:index] + new + text[index + len(old):]
    lines = text.split("\n")
    for index, line in enumerate(lines[:-1]):
        if f"// anchor: {anchor}" in line:
            target = lines[index + 1]
            if old not in target:
                return None
            lines[index + 1] = target.replace(old, new, 1)
            return "\n".join(lines)
    return None


def main() -> int:
    args = sys.argv[1:]
    heavy = "--heavy" in args
    wanted = {a for a in args if not a.startswith("--")}
    SANDBOX.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    skipped: list[str] = []
    killed = 0
    for mutation_id, rel, mode, anchor, old, new, check in MUTATIONS:
        if wanted and mutation_id not in wanted:
            continue
        if mutation_id in HEAVY and not heavy:
            skipped.append(mutation_id)
            continue
        path = ROOT / rel
        if mode == "create":
            if not passes(check):
                failures.append(f"{mutation_id}: baseline check already fails")
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(new, encoding="utf-8")
            try:
                if passes(check):
                    failures.append(f"{mutation_id}: SURVIVED (created {rel})")
                else:
                    killed += 1
                    print(f"{mutation_id}: killed")
            finally:
                path.unlink(missing_ok=True)
                try:
                    path.parent.rmdir()
                except OSError:
                    pass
            continue
        if not path.is_file():
            failures.append(f"{mutation_id}: {rel} missing")
            continue
        original = path.read_bytes()
        backup = SANDBOX / f"{mutation_id}.bak"
        backup.write_bytes(original)
        try:
            if not passes(check):
                failures.append(f"{mutation_id}: baseline check already fails")
                continue
            mutated = mutate(original.decode("utf-8"), mode, anchor, old, new)
            if mutated is None:
                failures.append(f"{mutation_id}: NOT APPLIED ({mode} {anchor or old!r} in {rel})")
                continue
            path.write_bytes(mutated.encode("utf-8"))
            if passes(check):
                failures.append(f"{mutation_id}: SURVIVED ({rel}: {old!r} -> {new!r})")
            else:
                killed += 1
                print(f"{mutation_id}: killed")
        finally:
            path.write_bytes(original)
            if path.read_bytes() != backup.read_bytes():
                failures.append(f"{mutation_id}: RESTORE FAILED for {rel}")
    if heavy and any(m[0] in HEAVY for m in MUTATIONS if not wanted or m[0] in wanted):
        # leave .next built from the restored sources, not from the last mutant
        subprocess.run(["bash", "-c", f"{BUILD} > /dev/null 2>&1"], cwd=ROOT)
    for leftover in SANDBOX.glob("*.bak"):
        leftover.unlink()
    if skipped:
        print(f"SKIPPED (need --heavy, a build and a space-free path): {', '.join(skipped)}")
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"all {killed} run mutations killed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
