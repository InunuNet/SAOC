#!/usr/bin/env python3
"""Mutation proof for sec-abuse-controls. Frozen by @architect; @dev never edits this.

For each mutation: confirm the paired check passes unmutated, apply the edit, confirm the check
now FAILS, restore the file byte-for-byte. A mutation that cannot be applied (anchor or text
missing) or that survives (check still passes) fails this run. Run from the repository root,
after the implementation exists.

Anchor convention: the implementation puts `// anchor: <id>` on the line directly above the
decision line named in spec.md section "Anchors"; the mutation edits that next line only.
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
SPEC = ".agent/memory/project/specs/sec-abuse-controls/goldens"
SANDBOX = ROOT / ".tmp/sandbox/sec-abuse-mutations"


def golden(name: str) -> list[str]:
    return ["pnpm", "exec", "tsx", f"{SPEC}/{name}.golden.ts"]


def wiring(name: str) -> list[str]:
    return ["python3", f"{SPEC}/check_wiring.py", name]


LIMITER, HOLDS, WEBHOOK = "lib/abuse-limiter.ts", "lib/checkout-holds.ts", "lib/webhook-body.ts"
RESERVATION, CHECKOUT = "lib/checkout-reservation.ts", "app/api/tickets/checkout/route.ts"

# (id, file, mode, anchor-or-None, old, new, check)
MUTATIONS = [
    ("M01", LIMITER, "anchor", "limiter-deny", " > input.maxAttempts", " >= input.maxAttempts", golden("abuse-limiter")),
    ("M02", LIMITER, "anchor", "limiter-window", "< input.windowMs", "< input.windowMs * 1000", golden("abuse-limiter")),
    ("M03", LIMITER, "anchor", "ipv6-prefix", "slice(0, 4)", "slice(0, 8)", golden("abuse-limiter")),
    ("M04", LIMITER, "anchor", "limiter-hash", "createHmac('sha256', secret)", "createHmac('sha256', 'fixed')", golden("abuse-limiter")),
    ("M05", HOLDS, "anchor", "held-expired", "> nowMs", ">= nowMs", golden("checkout-holds")),
    ("M06", HOLDS, "anchor", "budget-actor-total", "> limits.actorMaxHeldSeats", "> limits.actorMaxHeldSeats + 1", golden("checkout-holds")),
    ("M07", HOLDS, "anchor", "budget-buyer-total", "> limits.buyerMaxHeldSeats", "> limits.buyerMaxHeldSeats + 1", golden("checkout-holds")),
    ("M08", HOLDS, "anchor", "budget-actor-type", "> limits.actorMaxHeldPerType", "> limits.actorMaxHeldPerType + 1", golden("checkout-holds")),
    ("M09", WEBHOOK, "anchor", "webhook-declared", "> maxBytes", "> maxBytes * 1000", golden("webhook-body")),
    ("M10", WEBHOOK, "anchor", "webhook-stream", "> maxBytes", "> maxBytes * 1000", golden("webhook-body")),
    ("M11", RESERVATION, "anchor", "reservation-actor-stamp", "?? null", "?? undefined", golden("reservation-actor")),
    ("M12", CHECKOUT, "first", None, "consumeAbuseLimit(", "consumeAbuseLimitX(", wiring("checkout-order")),
    ("M13", CHECKOUT, "first", None, "'clientKey'", "'clientKeyX'", wiring("checkout-order")),
    ("M14", "lib/tickets-notification.ts", "first", None, "readCappedBody(", "readCappedBodyX(", wiring("webhook-order")),
    ("M15", "lib/vendor-stand-payment-notification.ts", "first", None, "readCappedBody(", "readCappedBodyX(", wiring("webhook-order")),
    ("M16", "app/api/vendors/apply/route.ts", "append", None, "", "\n// mutation\n", wiring("lanes")),
    ("M17", "lib/orders.ts", "append", None, "", "\n// mutation\n", wiring("unchanged")),
    ("M18", "app/api/contact/route.ts", "append", None, "", "\nimport { createAttemptStore } from '@/lib/newsletter-rate-store';\n", wiring("no-memory-limiter")),
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
    SANDBOX.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    for mutation_id, rel, mode, anchor, old, new, check in MUTATIONS:
        path = ROOT / rel
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
                print(f"{mutation_id}: killed")
        finally:
            path.write_bytes(original)
            if path.read_bytes() != backup.read_bytes():
                failures.append(f"{mutation_id}: RESTORE FAILED for {rel}")
    shutil.rmtree(SANDBOX, ignore_errors=True)
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"all {len(MUTATIONS)} mutations killed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
