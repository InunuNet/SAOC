#!/usr/bin/env python3
"""Mutation proof for nos-recovery-ttl. Frozen by @architect; @dev never edits it.

Each mutation breaks one line in a source file, runs the check meant to kill it, and requires that check to
FAIL. Files are restored byte for byte, also on failure. A baseline run of the killing check must pass first.
Local files only: no network, no Firestore. Modes: first / last (str.replace), anchor (the line after
`// anchor: <name>`), append.
Run: python3 .agent/memory/project/specs/nos-recovery-ttl/goldens/run_mutations.py [ID ...]
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
SPEC = ".agent/memory/project/specs/nos-recovery-ttl/goldens"
SANDBOX = ROOT / ".tmp/sandbox/nos-recovery-ttl-mutations"


def golden(name: str) -> list[str]:
    return ["pnpm", "exec", "tsx", f"{SPEC}/{name}.golden.ts"]


def wiring(name: str) -> list[str]:
    return ["python3", f"{SPEC}/check_wiring.py", name]


EXP = "lib/recovery-expiry.ts"
TOK = "lib/recovery-token.ts"
RT = "app/api/tickets/checkout/route.ts"
EX_G = golden("recovery-expiry")
MINT_G = golden("recovery-mint")
SITE_G = golden("checkout-mint-site")

# id, file, mode, anchor, old, new, killing check
MUTATIONS: list[tuple] = [
    # --- lib/recovery-expiry.ts (effect: recovery-expiry.golden.ts)
    ("E01", EXP, "first", None, "RECOVERY_DAYS_AFTER_SHOW_END = 7", "RECOVERY_DAYS_AFTER_SHOW_END = 6", EX_G),
    ("E02", EXP, "first", None, "RECOVERY_DAYS_AFTER_SHOW_END + 1", "RECOVERY_DAYS_AFTER_SHOW_END", EX_G),  # start-of-day+7: cuts the buyer short
    ("E03", EXP, "first", None, "RECOVERY_DAYS_AFTER_SHOW_END + 1", "RECOVERY_DAYS_AFTER_SHOW_END + 2", EX_G),
    ("E04", EXP, "first", None, "SAST_OFFSET_MS = 2 * 60 * 60 * 1000", "SAST_OFFSET_MS = 0", EX_G),  # UTC calendar day
    ("E05", EXP, "first", None, "SAST_OFFSET_MS = 2 * 60 * 60 * 1000", "SAST_OFFSET_MS = 3 * 60 * 60 * 1000", EX_G),
    ("E06", EXP, "first", None, "endSast.getUTCFullYear(), endSast.getUTCMonth(), endSast.getUTCDate()", "endSast.getFullYear(), endSast.getMonth(), endSast.getDate()", EX_G),  # server-zone dependent (killed under TZ runs)
    ("E07", EXP, "first", None, "input.now.getTime() >= expiresAtMs", "input.now.getTime() > expiresAtMs", EX_G),
    ("E08", EXP, "first", None, "if (input.showEnd === null || input.showEnd === undefined) throw new RecoveryExpiryError('no-active-show');", "if (input.showEnd === null || input.showEnd === undefined) return new Date(input.now.getTime() + 180 * 86400000);", EX_G),
    ("E09", EXP, "first", None, "Number.isNaN(input.showEnd.getTime())) throw new RecoveryExpiryError('invalid-show-end');", "Number.isNaN(input.showEnd.getTime())) return new Date(input.now.getTime() + 180 * 86400000);", EX_G),
    ("E10", EXP, "first", None, "if (!Number.isFinite(expiresAtMs)) throw new RecoveryExpiryError('invalid-show-end');", "", EX_G),
    ("E11", EXP, "first", None, "if (!(input.now instanceof Date) || Number.isNaN(input.now.getTime())) throw new RecoveryExpiryError('invalid-now');", "", EX_G),
    ("E12", EXP, "first", None, "if (error instanceof RecoveryExpiryError) return { ok: false, code: error.code };\n    throw error;", "return { ok: false, code: 'no-active-show' };", EX_G),
    ("E13", EXP, "first", None, "return { ok: true, expiresAt: computeRecoveryExpiry(", "return { ok: true, expiresAt: input.now, extra: 1 as never, ignored: computeRecoveryExpiry(", EX_G),
    ("E14", EXP, "first", None, "showEnd: input.showWindow?.endDate", "showEnd: input.showWindow?.startDate", EX_G),
    ("E15", EXP, "first", None, "return new Date(expiresAtMs);", "return new Date(Math.min(expiresAtMs, input.now.getTime() + 180 * 86400000));", EX_G),
    ("E16", EXP, "append", None, "", "\nexport const leak = process.env.NODE_ENV;\n", wiring("pure-module")),
    ("E17", EXP, "append", None, "", "\nconst fallback = 180;\n", wiring("pure-module")),
    ("E18", EXP, "append", None, "", "\nconst showEnd2027 = '2027-09-26';\n", wiring("pure-module")),
    ("E19", EXP, "append", None, "", "\nconsole.error('x');\n", wiring("pure-module")),
    # --- lib/recovery-token.ts (effect: recovery-mint.golden.ts)
    ("T01", TOK, "first", None, "expiresAtEpochMs = input.expiresAt.getTime();", "expiresAtEpochMs = input.now.getTime() + (input.ttlMs ?? RECOVERY_TOKEN_DEFAULT_TTL_MS);", MINT_G),
    ("T02", TOK, "anchor", "rt-explicit-guard", "expiresAtEpochMs <= input.now.getTime()", "expiresAtEpochMs < input.now.getTime()", MINT_G),
    ("T03", TOK, "anchor", "rt-explicit-guard", "!Number.isFinite(expiresAtEpochMs) ||", "", MINT_G),
    ("T04", TOK, "first", None, "if (input.expiresAt !== undefined) {", "if (input.expiresAt !== undefined && input.ttlMs === undefined) {", MINT_G),
    ("T05", TOK, "first", None, "expiresAtEpochMs = input.now.getTime() + (input.ttlMs ?? RECOVERY_TOKEN_DEFAULT_TTL_MS);", "expiresAtEpochMs = input.now.getTime() + (input.ttlMs ?? 1);", MINT_G),
    ("T06", TOK, "first", None, "if (input.now.getTime() >= expiresAt.getTime())", "if (input.now.getTime() > expiresAt.getTime())", wiring("token-additive")),
    ("T07", TOK, "first", None, "export const RECOVERY_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 180;", "export const RECOVERY_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 90;", wiring("token-additive")),
    # --- app/api/tickets/checkout/route.ts (effect: checkout-mint-site.golden.ts, then wiring)
    ("R01", RT, "anchor", "rx-refuse", "if (!recoveryExpiry.ok)", "if (false)", SITE_G),
    ("R02", RT, "anchor", "rx-resolve", "showWindow, now: new Date()", "showWindow: showWindow ?? { startDate: new Date(), endDate: new Date(Date.now() + 86400000) }, now: new Date()", SITE_G),
    ("R03", RT, "anchor", "rx-resolve", "now: new Date()", "now: new Date(0)", SITE_G),
    ("R04", RT, "first", None, "console.error('[tickets/checkout] Cannot set the recovery link expiry.', { code: recoveryExpiry.code });", "console.error('[tickets/checkout] Cannot set the recovery link expiry.', recoveryExpiry);", wiring("route-wiring")),
    ("R05", RT, "first", None, "{ code: recoveryExpiry.code }", "{ code: recoveryExpiry.code, secret: process.env.RECOVERY_TOKEN_SECRET }", SITE_G),
    ("R06", RT, "first", None, "code: recoveryExpiry.code });\n    return NextResponse.json(\n      { error: 'Ticket recovery is not configured. Please try again later.' },\n      { status: 500 }", "code: recoveryExpiry.code });\n    return NextResponse.json(\n      { error: 'Ticket recovery is not configured. Please try again later.' },\n      { status: 503 }", SITE_G),
    ("R07", RT, "first", None, "        expiresAt: input.recoveryExpiresAt,\n", "        ttlMs: 180 * 86400000,\n", SITE_G),
    ("R08", RT, "first", None, "        expiresAt: input.recoveryExpiresAt,\n", "", SITE_G),
    ("R09", RT, "first", None, "      recoveryExpiresAt: recoveryExpiry.expiresAt,\n", "      recoveryExpiresAt: new Date(Date.now() + 180 * 86400000),\n", wiring("route-wiring")),
    ("R10", RT, "first", None, "'Ticket recovery is not configured. Please try again later.' },\n      { status: 500 }\n    );\n  }\n\n  // anchor: rx-resolve", "'Your recovery link could not be set.' },\n      { status: 500 }\n    );\n  }\n\n  // anchor: rx-resolve", wiring("route-hunks")),
    ("R11", RT, "first", None, "  // anchor: rx-resolve\n", "", wiring("route-wiring")),
    ("R12", RT, "append", None, "", "\nexport const unrelated = 1;\n", wiring("route-hunks")),
    ("R13", RT, "first", None, "const outcome", "const outcome", wiring("route-hunks")),  # placeholder replaced below
    ("R14", RT, "first", None, "  recoveryExpiresAt: Date;\n", "  recoveryExpiresAt?: Date;\n", wiring("route-wiring")),
    ("R15", RT, "first", None, "import { resolveRecoveryExpiry } from '@/lib/recovery-expiry';\n", "import { resolveRecoveryExpiry } from '@/lib/recovery-expiry';\nimport { client as sanityClient } from '@/sanity/lib/client';\n", wiring("route-hunks")),
    # --- scope
    ("S01", "lib/recovery-access.ts", "append", None, "", "\n// touched\n", wiring("unchanged")),
    ("S02", "lib/show-window-lookup.ts", "append", None, "", "\n// touched\n", wiring("unchanged")),
    ("S03", "lib/recovery-extra.ts", "create", None, "", "export const extra = 1;\n", wiring("hunk-list")),
    ("S04", "lib/vendor-photo-resume-token.ts", "append", None, "", "\nimport { mintRecoveryToken as m } from './recovery-token';\nexport const bad = m({ orderId: 'o', secret: 's', now: new Date() });\n", wiring("no-default-ttl")),
    ("S05", "lib/vendor-photo-resume-token.ts", "append", None, "", "\nimport { RECOVERY_TOKEN_DEFAULT_TTL_MS as D } from './recovery-token';\nexport const bad2 = D;\n", wiring("no-default-ttl")),
]
# R13: an extra, harmless-looking added line in route.ts must be rejected by the pinned-lines rule.
MUTATIONS = [m for m in MUTATIONS if m[0] != "R13"] + [
    ("R13", RT, "first", None, "  // anchor: rx-resolve\n", "  const unrelatedRecoveryNote = 'x';\n  // anchor: rx-resolve\n", wiring("route-hunks")),
]


def passes(command: list[str]) -> bool:
    return subprocess.run(command, cwd=ROOT, capture_output=True, text=True).returncode == 0


def mutate(text: str, mode: str, anchor: str | None, old: str, new: str) -> str | None:
    if mode == "append":
        return text + new
    if mode == "first":
        return text.replace(old, new, 1) if old in text else None
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
    wanted = {a for a in sys.argv[1:] if not a.startswith("--")}
    SANDBOX.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    killed = 0
    for mutation_id, rel, mode, anchor, old, new, check in MUTATIONS:
        if wanted and mutation_id not in wanted:
            continue
        path = ROOT / rel
        if mode == "create":
            if not passes(check):
                failures.append(f"{mutation_id}: baseline check already fails")
                continue
            path.write_text(new, encoding="utf-8")
            try:
                if passes(check):
                    failures.append(f"{mutation_id}: SURVIVED (created {rel})")
                else:
                    killed += 1
                    print(f"{mutation_id}: killed")
            finally:
                path.unlink(missing_ok=True)
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
    for leftover in SANDBOX.glob("*.bak"):
        leftover.unlink()
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"all {killed} mutations killed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
