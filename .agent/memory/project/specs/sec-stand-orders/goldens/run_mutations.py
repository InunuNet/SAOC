#!/usr/bin/env python3
"""Mutation proof for sec-stand-orders. Frozen by @architect; @dev never edits it.

Each mutation breaks one anchored (or uniquely identified) line in a source file, runs the check
that is meant to kill it, and requires that check to FAIL. Files are restored byte for byte, also
on failure. A baseline run of every check must pass first. Local files only: no network, no
Firestore, no credentials (the goldens are pure, the wiring checks read text and `git diff`).

Modes: anchor (the line after `// anchor: <name>`), first / last (str.replace on the first or last
occurrence), append (add text to the end of an existing file), create (add a new file).
Run: python3 .agent/memory/project/specs/sec-stand-orders/goldens/run_mutations.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
SPEC = ".agent/memory/project/specs/sec-stand-orders/goldens"
SANDBOX = ROOT / ".tmp/sandbox/sec-stand-orders-mutations"


def golden(name: str) -> list[str]:
    return ["pnpm", "exec", "tsx", f"{SPEC}/{name}.golden.ts"]


def wiring(name: str) -> list[str]:
    return ["python3", f"{SPEC}/check_wiring.py", name]


PAID = "lib/vendor-stand-order-paid.ts"
LINK = "lib/vendor-stand-payment-link.ts"
TOKEN = "lib/vendor-stand-payment-token.ts"
NOTIFY = "lib/vendor-stand-payment-notification.ts"
INITIATE = "app/api/vendors/stand-payment/initiate/route.ts"
RESEND = "app/api/admin/vendors/[id]/resend-payment-link/route.ts"
REVIEW = "app/api/admin/vendors/[id]/review/route.ts"
REVOKE = "app/api/admin/vendors/[id]/revoke-payment-link/route.ts"
ADMIN_LIST = "app/admin/(shell)/vendors/page.tsx"
ADMIN_DETAIL = "app/admin/(shell)/vendors/[id]/page.tsx"
PAY_PAGE = "app/(nos)/national-show/vendors/payment/page.tsx"
STATUS_PAGE = "app/(nos)/national-show/vendors/payment/status/page.tsx"
LABELS = "lib/vendor-stand-payment-labels.ts"
TABLE = "components/admin/VendorReviewTable.tsx"
STAMP = "const leakedStamp = { issuedInTestMode: false };\n"

PAID_G = golden("stand-order-paid")
LINK_G = golden("stand-payment-link")

# (id, file, mode, anchor, old, new, killing check)
MUTATIONS = [
    # --- counts-as-paid rule (stand-order-paid.golden.ts)
    ("P01", PAID, "anchor", "paid-live-rule", "=== false", "!== true", PAID_G),
    ("P02", PAID, "anchor", "paid-live-rule", "!options.liveMode ||", "true ||", PAID_G),
    ("P03", PAID, "anchor", "paid-live-rule", "!options.liveMode ||", "false ||", PAID_G),
    ("P04", PAID, "anchor", "paid-status", "!== 'paid'", "!== 'pending'", PAID_G),
    ("P05", PAID, "anchor", "own-key", "Object.hasOwn(order, key)", "(key in order)", PAID_G),
    ("P06", PAID, "anchor", "array-guard", "|| Array.isArray(order)", "", PAID_G),
    ("P07", PAID, "anchor", "effective-test-paid", "'test-paid'", "'paid'", PAID_G),
    ("P08", PAID, "anchor", "settlement-return", "sendNotices: counts", "sendNotices: true", PAID_G),
    ("P09", PAID, "anchor", "settlement-return", "paymentReceived: counts", "paymentReceived: true", PAID_G),
    ("P10", PAID, "anchor", "office-trim", "by.trim()", "by", PAID_G),
    ("P11", PAID, "anchor", "office-fallback", "standOrderCountsAsPaid(standOrder, options)", "true", PAID_G),
    ("P12", PAID, "anchor", "office-flag", "!== true", "=== false", PAID_G),
    # --- link record, revocation, initiate decision, numbers (stand-payment-link.golden.ts)
    ("L01", LINK, "anchor", "link-legacy", "r === undefined || r === null", "false", LINK_G),
    ("L02", LINK, "anchor", "link-legacy", "legacy: true", "legacy: false", LINK_G),
    ("L03", LINK, "anchor", "link-revoked", "rec.revokedAt !== null &&", "false &&", LINK_G),
    ("L04", LINK, "anchor", "link-nonce", "rec.nonce !== input.tokenNonce", "false", LINK_G),
    ("L05", LINK, "anchor", "link-expiry", ">=", ">", LINK_G),
    ("L06", LINK, "anchor", "link-malformed", "rec.nonce === '' ||", "", LINK_G),
    ("L07", LINK, "anchor", "initiate-window", "elapsed <", "elapsed <=", LINK_G),
    ("L08", LINK, "anchor", "initiate-window", "elapsed >= -MAX_CLOCK_SKEW_MS", "true", LINK_G),
    ("L09", LINK, "anchor", "initiate-paid", "liveMode: input.liveMode", "liveMode: false", LINK_G),
    ("L10", LINK, "anchor", "initiate-hold", "isPendingPaymentHoldActive(order.gatewayPending, input.now)", "false", LINK_G),
    ("L11", LINK, "anchor", "limits-constant", "ipRequests: 12", "ipRequests: 120", LINK_G),
    ("L12", LINK, "anchor", "limits-constant", "tokenRequests: 6", "tokenRequests: 60", LINK_G),
    ("L13", LINK, "anchor", "attempt-window", "= 30;", "= 300;", LINK_G),
    ("L14", LINK, "anchor", "record-revoked-null", "revokedAt: null", "revokedAt: undefined", LINK_G),
    ("L15", LINK, "anchor", "revocation-legacy", "nonce: input.freshNonce", "nonce: ''", LINK_G),
    ("L16", LINK, "anchor", "limits-constant", "Object.freeze(", "(", LINK_G),
    # --- token (nonce, TTL cap)
    ("T01", TOKEN, "anchor", "token-ttl-cap", "Math.min(requested, VENDOR_STAND_PAYMENT_TOKEN_MAX_TTL_MS)", "requested", LINK_G),
    ("T02", TOKEN, "anchor", "token-ttl-valid", "|| requested <= 0", "", LINK_G),
    ("T03", TOKEN, "anchor", "token-nonce-verify", "nonce: payload.n", "nonce: ''", LINK_G),
    # --- stamp at initiate
    ("S01", INITIATE, "anchor", "stand-stamp", "isIssuanceTestMode({ ozowSandboxTestMode: ozowSandboxTestModeEnabled })", "false", wiring("stamp-at-initiate")),
    ("S02", INITIATE, "anchor", "stand-stamp", "ozowSandboxTestMode: ozowSandboxTestModeEnabled", "ozowSandboxTestMode: false", wiring("stamp-at-initiate")),
    ("S03", "types/index.ts", "first", None, "  failedAt: Date | null;\n  issuedInTestMode?: boolean;", "  failedAt: Date | null;", wiring("stamp-at-initiate")),
    ("S04", INITIATE, "append", None, "", "\nconst readsBody = (body: { testMode?: boolean }) => body.testMode;\n", wiring("stamp-at-initiate")),
    ("S05", INITIATE, "append", None, "", "\n" + STAMP, wiring("no-literal-stamp")),
    ("S06", PAY_PAGE, "append", None, "", "\n" + STAMP, wiring("no-literal-stamp")),
    # --- settlement
    ("N01", NOTIFY, "anchor", "stand-settlement-decision", "decideStandSettlement(", "((o: unknown, p: unknown) => ({ paymentReceived: true, sendNotices: true }))(", wiring("settlement")),
    ("N02", NOTIFY, "first", None, "if (settlement.paymentReceived) {", "if (true) {", wiring("settlement")),
    ("N03", NOTIFY, "first", None, "deps.liveMode ?? !isTicketingTestMode()", "deps.liveMode ?? false", wiring("settlement")),
    ("N04", NOTIFY, "first", None, "status: 'paid',", "status: 'paid',\n          issuedInTestMode: false,", wiring("settlement")),
    ("N05", NOTIFY, "first", None, "liveMode?: boolean", "liveMode_?: boolean", wiring("settlement-deps")),
    ("N06", NOTIFY, "first", None, "paymentProvider.confirmNotification(notification);", "paymentProvider.confirmNotification(notification);\n      await paymentProvider.confirmNotification(notification);", wiring("settlement")),
    ("N07", NOTIFY, "first", None, "settlement.sendNotices", "settlement.paymentReceived", wiring("settlement")),
    # --- initiate: limiter, link gate, decision, copy
    ("I01", INITIATE, "anchor", "stand-ip-limit", "clientActorKey(", "String(", wiring("initiate-order")),
    ("I02", INITIATE, "anchor", "stand-link-gate", "decideStandLinkUse(", "((o: unknown) => ({ ok: true }))(", wiring("initiate-order")),
    ("I03", INITIATE, "anchor", "stand-link-gate", "verification.nonce", "''", wiring("initiate-order")),
    ("I04", INITIATE, "anchor", "stand-token-limit", "vendorSubmissionId", "'shared'", wiring("initiate-order")),
    ("I05", INITIATE, "first", None, "consumeAbuseLimit({", "(async (_: unknown) => ({ allowed: true as const }))({", wiring("initiate-order")),
    ("I06", INITIATE, "first", None, "decideStandInitiate(", "((o: unknown) => ({ ok: true }))(", wiring("initiate-order")),
    ("I07", INITIATE, "last", None, "decideStandInitiate(", "((o: unknown) => ({ ok: true }))(", wiring("initiate-order")),
    ("I08", INITIATE, "first", None, "'Retry-After'", "'X-Retry'", wiring("initiate-order")),
    ("I09", INITIATE, "first", None, "Too many attempts. Please try again later.", "Slow down.", wiring("initiate-order")),
    ("I10", INITIATE, "anchor", "stand-limiter-fail-closed", "status: 503", "status: 200", wiring("initiate-order")),
    ("I11", INITIATE, "first", None, "if (!linkDecision.ok) {\n    return genericTokenRefusal();\n  }", "if (!linkDecision.ok) {\n    console.error('x');\n  }", wiring("initiate-order")),
    ("I12", INITIATE, "append", None, "", "\nconst rawPaid = (o: { status?: string }) => o.status === 'paid';\n", wiring("views-fail-closed")),
    # --- link records, copy-only resend, revoke
    ("R01", RESEND, "first", None, "buildStandPaymentLinkRecord(", "Object.assign(", wiring("link-writers")),
    ("R02", RESEND, "append", None, "", "\nimport { sendVendorStandPaymentNoticeEmail } from '@/lib/vendor-stand-payment-notice';\n", wiring("link-writers")),
    ("R03", RESEND, "first", None, "standOrderCountsAsPaid(", "Boolean(", wiring("views-fail-closed")),
    ("R04", RESEND, "first", None, "if (!hasCapability(", "if (false && !hasCapability(", wiring("revoke-route")),
    ("R05", REVIEW, "first", None, "buildStandPaymentLinkRecord(", "Object.assign(", wiring("link-writers")),
    ("R06", REVIEW, "first", None, "if (!hasCapability(", "if (false && !hasCapability(", wiring("revoke-route")),
    ("R07", REVOKE, "first", None, "if (!hasCapability(", "if (false && !hasCapability(", wiring("revoke-route")),
    ("R08", REVOKE, "first", None, "if (!session.ok)", "if (false)", wiring("revoke-route")),
    ("R09", REVOKE, "first", None, "buildStandPaymentLinkRevocation(", "Object.assign(", wiring("revoke-route")),
    ("R10", REVOKE, "append", None, "", "\nexport async function GET() {\n  return new Response('x');\n}\n", wiring("revoke-route")),
    ("R11", REVOKE, "append", None, "", "\nimport { sendVendorStandPaymentNoticeEmail } from '@/lib/vendor-stand-payment-notice';\n", wiring("revoke-route")),
    ("R12", REVOKE, "first", None, "randomBytes(16)", "Buffer.alloc(0)", wiring("revoke-route")),
    # --- admin and vendor views fail closed
    ("V01", ADMIN_LIST, "first", None, "effectiveStandPaymentStatus(", "String(", wiring("views-fail-closed")),
    ("V02", ADMIN_LIST, "first", None, "vendorOfficePaymentReceived(", "Boolean(", wiring("views-fail-closed")),
    ("V03", ADMIN_DETAIL, "first", None, "effectiveStandPaymentStatus(", "String(", wiring("views-fail-closed")),
    ("V04", ADMIN_DETAIL, "first", None, "vendorOfficePaymentReceived(", "Boolean(", wiring("views-fail-closed")),
    ("V05", PAY_PAGE, "first", None, "standOrderCountsAsPaid(", "Boolean(", wiring("views-fail-closed")),
    ("V06", STATUS_PAGE, "first", None, "standOrderCountsAsPaid(", "Boolean(", wiring("views-fail-closed")),
    ("V07", PAY_PAGE, "append", None, "", "\nconst rawPaid = (o: { status?: string }) => o.status === 'paid';\n", wiring("views-fail-closed")),
    ("V08", LABELS, "first", None, "// awaiting committee copy", "", wiring("views-fail-closed")),
    ("V09", TABLE, "first", None, "'test-paid': 'neutral'", "'test-paid': 'approved'", wiring("views-fail-closed")),
    ("V10", TABLE, "first", None, "standPaymentStatus !== 'paid'", "standPaymentStatus !== 'test-paid'", wiring("views-fail-closed")),
    ("V11", ADMIN_LIST, "first", None, "isTicketingTestMode()", "false", wiring("views-fail-closed")),
    ("V12", PAY_PAGE, "first", None, "decideStandLinkUse(", "((o: unknown) => ({ ok: true }))(", wiring("views-fail-closed")),
    # --- copy, backfill, scope, frozen files
    ("C01", STATUS_PAGE, "append", None, "", "\nconst note = 'This stand was confirmed as paid today';\n", wiring("no-new-copy")),
    ("C02", ADMIN_LIST, "append", None, "", "\nconst note = 'Revoke this payment link for the vendor';\n", wiring("no-new-copy")),
    ("B01", "scripts/backfill-stand-orders.ts", "create", None, "", "export const backfill = true;\n", wiring("no-backfill")),
    ("B02", "lib/extra-stand-helper.ts", "create", None, "", "export const extra = 1;\n", wiring("hunk-list")),
    ("B03", "components/admin/VendorPaymentLinkControl.tsx", "append", None, "", "\n// extra\n", wiring("hunk-list")),
    ("U01", "lib/ticket-issuance-mode.ts", "append", None, "", "\n// touched\n", wiring("unchanged")),
    ("U02", "lib/payments/sandbox-mode.ts", "append", None, "", "\n// touched\n", wiring("unchanged")),
    ("U03", "app/api/admin/vendors/[id]/payment/route.ts", "append", None, "", "\n// touched\n", wiring("unchanged")),
    ("U04", "lib/ticketing-test-mode.ts", "first", None, "const TICKETING_PAYMENTS_LIVE = false;", "const TICKETING_PAYMENTS_LIVE = true;", wiring("unchanged")),
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
    SANDBOX.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    for mutation_id, rel, mode, anchor, old, new, check in MUTATIONS:
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
    print(f"all {len(MUTATIONS)} mutations killed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
