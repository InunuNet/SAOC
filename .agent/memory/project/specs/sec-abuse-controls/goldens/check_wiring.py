#!/usr/bin/env python3
"""Static wiring checks for sec-abuse-controls. Frozen by @architect; @dev never edits this.

Usage: python3 check_wiring.py <check>   (exit 0 = pass, 1 = fail, message on stderr)
Run from the repository root (the contract gate does).
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
CHECKOUT = "app/api/tickets/checkout/route.ts"
TICKETS_NOTIFY = "lib/tickets-notification.ts"
VENDOR_NOTIFY = "lib/vendor-stand-payment-notification.ts"
# Call sites that live in SHARED lanes: they must be off the in-memory limiter after this change.
OUR_SCOPE_CALLERS = [
    "app/api/contact/route.ts",
    "app/api/newsletter/subscribe/route.ts",
    "app/api/newsletter/unsubscribe/route.ts",
    "lib/newsletter-handler.ts",
    "app/api/tickets/status/route.ts",
    "app/api/tickets/pdf/route.ts",
    CHECKOUT,
]
# SAOC-lane trees this change must not touch (hand-off items instead).
SAOC_LANE_PREFIXES = [
    "app/api/vendors/", "app/api/events/", "app/api/sponsors/", "app/api/admin/", "app/admin/",
    "components/admin/", "sanity/", "lib/vendor-", "lib/sponsor-", "lib/event-", "lib/supporter-",
]
# Vendor-prefixed but a SHARED webhook file (SEC-17 scope), explicitly allowed.
SAOC_LANE_ALLOW = {VENDOR_NOTIFY}
UNCHANGED = [
    "app/api/admin/reconcile-orders/route.ts", "lib/reconciliation.ts", "lib/orders.ts",
    "lib/payments", "lib/payfast.ts", "lib/ozow.ts", "proxy.ts", "lib/tickets-constants.ts",
    "lib/data/pool-remaining.ts", "lib/data/admission-availability.ts", "apphosting.yaml",
]
# Tokens that mean "reads or alters the Ozow sandbox test mode". F3 must neither depend on nor change it.
SANDBOX_TOKENS = ("ozowSandboxTestMode", "isOzowSandboxTestModeEnabled", "OZOW_IS_TEST", "ozow-sandbox")


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        fail(f"missing file {rel}")
    return path.read_text(encoding="utf-8")


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    sys.exit(1)


def first(text: str, needle: str, rel: str, start: int = 0) -> int:
    index = text.find(needle, start)
    if index < 0:
        fail(f"{rel}: expected `{needle}`")
    return index


def check_checkout_order() -> None:
    text = read(CHECKOUT)
    limit1 = first(text, "consumeAbuseLimit(", CHECKOUT)
    if limit1 > first(text, "request.json()", CHECKOUT):
        fail("per-IP consumeAbuseLimit must run before request.json()")
    if limit1 > first(text, "resolveActiveGateway(", CHECKOUT):
        fail("per-IP consumeAbuseLimit must run before any Sanity/gateway work")
    parse = first(text, "parseLineItems(body.lineItems)", CHECKOUT)
    limit2 = first(text, "consumeAbuseLimit(", CHECKOUT, limit1 + 1)
    if not (parse < limit2 < first(text, "resolveActiveGateway(", CHECKOUT)):
        fail("per-buyer consumeAbuseLimit must sit between parseLineItems and resolveActiveGateway")
    first(text, "AbuseLimiterUnavailableError", CHECKOUT)
    reserve = first(text, "async function reserveTicket", CHECKOUT)
    replay = first(text, "kind: 'replayed'", CHECKOUT, reserve)
    budget = first(text, "evaluateHoldBudget(", CHECKOUT, reserve)
    write = first(text, "writeMultiReservationPair(", CHECKOUT, reserve)
    if not (replay < budget < write):
        fail("evaluateHoldBudget must run after the idempotent-replay branch and before writeMultiReservationPair")
    if "transaction.get(" not in text[reserve:budget] or "'clientKey'" not in text[reserve:budget]:
        fail("held seats must be read inside the reservation transaction by clientKey")
    first(text, "buyerKey", CHECKOUT, reserve)
    if not re.search(r"buildMultiReservationDocs\(\{[^}]*actor", text[reserve:], re.S):
        fail("buildMultiReservationDocs must be passed the actor stamp")


def check_no_memory_limiter() -> None:
    for rel in OUR_SCOPE_CALLERS:
        text = read(rel)
        for banned in ("createAttemptStore", "scopeAttemptsToRequest", "newsletter-rate-store"):
            if banned in text:
                fail(f"{rel} still uses the per-instance limiter ({banned})")
    for rel in OUR_SCOPE_CALLERS:
        if rel in ("lib/newsletter-handler.ts",):
            continue
        if "consumeAbuseLimit" not in read(rel):
            fail(f"{rel} does not call consumeAbuseLimit")


def check_webhook_order() -> None:
    for rel in (TICKETS_NOTIFY, VENDOR_NOTIFY):
        text = read(rel)
        if "request.text()" in text:
            fail(f"{rel} still buffers request.text()")
        capped = first(text, "readCappedBody(", rel)
        if capped > first(text, "verifyNotification(", rel):
            fail(f"{rel}: readCappedBody must run before verifyNotification")
        first(text, "413", rel)


def check_limiter_lazy() -> None:
    text = read("lib/abuse-limiter.ts")
    if re.search(r"^import[^;]*from\s+['\"]firebase-admin", text, re.M):
        fail("lib/abuse-limiter.ts must import firebase-admin lazily (dynamic import)")
    first(text, "import('firebase-admin", "lib/abuse-limiter.ts")


def check_ttl_policy() -> None:
    text = read("firestore.indexes.json")
    if not re.search(r'"collectionGroup"\s*:\s*"abuseLimits"', text) or '"ttl": true' not in text:
        fail('firestore.indexes.json needs an abuseLimits fieldOverride with "ttl": true on expireAt')
    if "expireAt" not in text:
        fail("firestore.indexes.json: the TTL field must be expireAt")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, cwd=ROOT, check=True).stdout


def check_lanes() -> None:
    names = [n for n in git("diff", "--name-only", "origin/main").splitlines() if n]
    names += [n for n in git("ls-files", "--others", "--exclude-standard").splitlines() if n]
    spec = ".agent/memory/project/specs/sec-abuse-controls/"
    for name in names:
        if name.startswith(spec) or name in SAOC_LANE_ALLOW:
            continue
        for prefix in SAOC_LANE_PREFIXES:
            if name.startswith(prefix):
                fail(f"{name} is in a SAOC lane; list it as a hand-off instead")


def check_unchanged() -> None:
    changed = git("diff", "--name-only", "origin/main", "--", *UNCHANGED).strip()
    if changed:
        fail("must not change: " + ", ".join(changed.splitlines()))


def check_seat_ledger() -> None:
    holds = read("lib/seat-holds.ts")
    if re.search(r"^import[^;]*from\s+['\"]firebase-admin", holds, re.M):
        fail("lib/seat-holds.ts must be pure (no firebase-admin import)")
    for banned in ("reconciliation", "Scheduler", "RECONCILIATION_CRON_SECRET"):
        if banned in holds:
            fail(f"lib/seat-holds.ts must not depend on the reconcile job ({banned})")
    ledger = read("lib/data/tickets.ts")
    if re.search(r"function\s+stillHoldsSeat", ledger):
        fail("lib/data/tickets.ts must not keep a private copy of the expiry rule")
    if not re.search(r"from\s+['\"]@/lib/seat-holds['\"]", ledger) or ledger.count("stillHoldsSeat(") < 2:
        fail("both ledger functions in lib/data/tickets.ts must use stillHoldsSeat from lib/seat-holds")
    budget = read("lib/checkout-holds.ts")
    if not re.search(r"from\s+['\"](@/lib/|\./)seat-holds['\"]", budget):
        fail("lib/checkout-holds.ts must reuse the seat-holds expiry rule, not re-implement it")


def check_sandbox_independent() -> None:
    added = []
    for line in git("diff", "-U0", "origin/main", "--", ".", ":(exclude).agent", ":(exclude)docs", ":(exclude)CLAUDE.md").splitlines():
        if line.startswith("+") and not line.startswith("+++"):
            added.append(line)
    for name in git("ls-files", "--others", "--exclude-standard").splitlines():
        if name and name.endswith((".ts", ".tsx", ".json", ".yaml")) and not name.startswith((".agent/", "docs/")):
            added.extend((ROOT / name).read_text(encoding="utf-8", errors="replace").splitlines())
    for line in added:
        for token in SANDBOX_TOKENS:
            if token in line:
                fail(f"F3 must not touch Ozow sandbox mode ({token}): {line.strip()[:120]}")


CHECKS = {
    "checkout-order": check_checkout_order,
    "no-memory-limiter": check_no_memory_limiter,
    "webhook-order": check_webhook_order,
    "limiter-lazy": check_limiter_lazy,
    "ttl-policy": check_ttl_policy,
    "lanes": check_lanes,
    "unchanged": check_unchanged,
    "seat-ledger": check_seat_ledger,
    "sandbox-independent": check_sandbox_independent,
}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in CHECKS:
        print("usage: check_wiring.py <" + "|".join(CHECKS) + ">", file=sys.stderr)
        sys.exit(2)
    CHECKS[sys.argv[1]]()
    print(f"PASS: {sys.argv[1]}")
