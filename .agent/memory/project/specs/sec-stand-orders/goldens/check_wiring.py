#!/usr/bin/env python3
"""Static wiring checks for sec-stand-orders (mission nos-security-tiered-access, F5).

Frozen by @architect; @dev implements against it and never edits it.
Usage: check_wiring.py <check> [--root DIR]     (exit 0 pass, 1 fail, 2 usage)
Reads source text and `git diff` only. No network, no Firestore, no secrets, writes nothing.
Anchors: a comment `// anchor: <name>` marks the ONE statement on the next line that a mutation
(run_mutations.py) breaks; the pinned token on that line is listed in spec.md "Anchor table".
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]

INITIATE = "app/api/vendors/stand-payment/initiate/route.ts"
NOTIFY = "lib/vendor-stand-payment-notification.ts"
RESEND = "app/api/admin/vendors/[id]/resend-payment-link/route.ts"
REVIEW = "app/api/admin/vendors/[id]/review/route.ts"
REVOKE = "app/api/admin/vendors/[id]/revoke-payment-link/route.ts"
PAID = "lib/vendor-stand-order-paid.ts"
LINK = "lib/vendor-stand-payment-link.ts"
TOKEN = "lib/vendor-stand-payment-token.ts"
LABELS = "lib/vendor-stand-payment-labels.ts"
ADMIN_LIST = "app/admin/(shell)/vendors/page.tsx"
ADMIN_DETAIL = "app/admin/(shell)/vendors/[id]/page.tsx"
PAY_PAGE = "app/(nos)/national-show/vendors/payment/page.tsx"
STATUS_PAGE = "app/(nos)/national-show/vendors/payment/status/page.tsx"
TABLE = "components/admin/VendorReviewTable.tsx"

CACHE_EXPECTATIONS = ".agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/cache-header-expectations.json"
SPEC_DIR = ".agent/memory/project/specs/sec-stand-orders/"

# The hunk list cleared by SAOC (spec.md "Hunk list"). Anything else in the diff fails `hunk-list`.
ALLOWED_FILES = {
    PAID, LINK, TOKEN, NOTIFY, LABELS, "types/index.ts", INITIATE, RESEND, REVIEW, REVOKE,
    ADMIN_LIST, ADMIN_DETAIL, TABLE, "components/admin/VendorSubmissionDetail.tsx", PAY_PAGE, STATUS_PAGE,
    "docs/vendor-stand-payment-settlement.md", "docs/stand-order-test-mode.md",
    "contracts/checks/live-write-guard/writers-registry.json", CACHE_EXPECTATIONS,
}

# Frozen: byte-identical to the merge base (F5 neither touches nor re-derives these).
UNCHANGED = [
    "lib/ticket-issuance-mode.ts", "lib/ticketing-test-mode.ts", "lib/payments", "lib/checkin.ts",
    "lib/checkin-test-ticket-guard.ts", "lib/vendor-stand-order-amount.ts", "lib/vendor-stand-orders.ts",
    "lib/vendor-payment.ts", "lib/vendor-listing.ts", "lib/admin-auth.ts",
    "app/api/admin/vendors/[id]/payment/route.ts", "app/api/admin/vendors/[id]/publish-listing/route.ts",
    "app/api/vendors/stand-payment/payfast-itn/route.ts", "app/api/vendors/stand-payment/ozow-itn/route.ts",
    "firestore.rules", "firestore.indexes.json", "apphosting.yaml", "package.json", "lib/abuse-limiter.ts",
    "lib/client-ip.ts",
]

# New user-facing strings allowed by name (spec.md D8: a stopgap label awaiting committee copy).
COPY_ALLOWLIST = {"Test paid"}
TOO_MANY = "Too many attempts. Please try again later."


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        fail(f"{rel} is missing")
    return path.read_text(encoding="utf-8")


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    sys.exit(1)


def need(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def index_of(text: str, needle: str, what: str, start: int = 0) -> int:
    position = text.find(needle, start)
    need(position >= 0, f"{what}: {needle!r} not found")
    return position


def anchor_line(text: str, name: str, rel: str) -> tuple[int, str]:
    marker = f"// anchor: {name}"
    position = text.find(marker)
    need(position >= 0, f"{rel}: anchor {name!r} missing")
    need(text.count(marker) == 1, f"{rel}: anchor {name!r} appears more than once")
    after = text[position + len(marker):].split("\n")
    need(len(after) >= 2, f"{rel}: anchor {name!r} has no statement after it")
    return position, after[1]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=False).stdout


def merge_base() -> str:
    """origin/main merge-base; WIRING_BASE overrides it (reproducible reruns, local validation)."""
    base = os.environ.get("WIRING_BASE", "").strip() or git("merge-base", "HEAD", "origin/main").strip()
    need(bool(base), "cannot resolve merge-base with origin/main")
    return base


def changed_files() -> set[str]:
    base = merge_base()
    names = set(git("diff", "--name-only", base).split("\n")) | set(git("ls-files", "--others", "--exclude-standard").split("\n"))
    return {n for n in names if n}


# ---------------------------------------------------------------------------------- checks


def check_dependency_f3() -> None:
    text = read("lib/abuse-limiter.ts")
    for name in ("consumeAbuseLimit", "clientActorKey", "AbuseLimiterUnavailableError"):
        need(re.search(rf"export (async )?(function|class) {name}\b", text) is not None, f"lib/abuse-limiter.ts must export {name} (F3 must be merged before F5 dev)")


def check_stamp_at_initiate() -> None:
    text = read(INITIATE)
    need("from '@/lib/ticket-issuance-mode'" in text, "initiate must import isIssuanceTestMode from @/lib/ticket-issuance-mode")
    position, line = anchor_line(text, "stand-stamp", INITIATE)
    need("isIssuanceTestMode({ ozowSandboxTestMode: ozowSandboxTestModeEnabled })" in line, "stand-stamp line must call isIssuanceTestMode({ ozowSandboxTestMode: ozowSandboxTestModeEnabled })")
    need(len(re.findall(r"isOzowSandboxTestModeEnabled\(\)", text)) == 1, "the Ozow toggle is read exactly once, and that value feeds both the amount override and the stamp")
    read_at = index_of(text, "await isOzowSandboxTestModeEnabled()", "toggle read")
    need(read_at < position < index_of(text, "db.runTransaction", "transaction"), "the stamp is computed after the toggle read and before the transaction")
    tx = text[index_of(text, "transaction.set(standOrderRef, {", "stand order write"):]
    tx = tx[: tx.index("});")]
    need(re.search(r"\n\s+issuedInTestMode,?\n", tx) is not None or "issuedInTestMode:" in tx, "the stand order document written at initiate carries issuedInTestMode")
    need("body.issuedInTestMode" not in text and "body.testMode" not in text, "the stamp is never read from the request body")
    types_text = read("types/index.ts")
    block = types_text[index_of(types_text, "export interface VendorStandOrder {", "VendorStandOrder type"):]
    block = block[: block.index("\n}\n")]
    need(re.search(r"issuedInTestMode\?: boolean;", block) is not None, "VendorStandOrder declares issuedInTestMode?: boolean (optional: legacy documents have none)")


def check_no_literal_stamp() -> None:
    offenders = []
    for base in ("app", "lib", "components"):
        for path in (ROOT / base).rglob("*"):
            if path.suffix not in {".ts", ".tsx"} or not path.is_file():
                continue
            rel = path.relative_to(ROOT).as_posix()
            if rel in {"lib/checkin-test-ticket-guard.ts", PAID, LINK}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            if "VENDOR_STAND_ORDERS_COLLECTION" not in text and "vendorStandOrders" not in text:
                continue
            if re.search(r"issuedInTestMode\s*:\s*(true|false)\b", text):
                offenders.append(rel)
    need(not offenders, f"a literal issuedInTestMode value is written for stand orders in: {offenders} (only isIssuanceTestMode() may produce it; never backfill to false)")


def check_settlement() -> None:
    text = read(NOTIFY)
    need("decideStandSettlement" in text and "from '@/lib/vendor-stand-order-paid'" in text, "settlement imports decideStandSettlement")
    need("deps.liveMode ?? !isTicketingTestMode()" in text.replace("\n", " ").replace("  ", " ") or "liveMode ?? !isTicketingTestMode()" in text, "liveMode defaults to !isTicketingTestMode() and is injectable through deps")
    position, line = anchor_line(text, "stand-settlement-decision", NOTIFY)
    need("decideStandSettlement(" in line, "stand-settlement-decision line calls decideStandSettlement")
    paid_tx = text[text.index("transaction.update(standOrderRef, {\n          status: 'paid',"):]
    need("paidAt: now" in paid_tx[:300] and "gatewayPaymentId" in paid_tx[:300], "the status:'paid' write (paidAt, gatewayPaymentId) stays unconditional: money moved, settlement never hides it")
    need(len(re.findall(r"paymentReceived\s*:\s*true", text)) <= 1, "paymentReceived:true is written at most once")
    need(re.search(r"if \(settlement\.paymentReceived\)\s*\{[^}]*paymentReceived: true", text, re.S) is not None, "paymentReceived:true is written only inside `if (settlement.paymentReceived)` (never overwrites an office-recorded true with false)")
    notice_at = text.find("paidNotice = {")
    need(notice_at > 0, "paidNotice assignment still present")
    window = text[position:notice_at]
    need("settlement.sendNotices" in window, "paidNotice is assigned only when settlement.sendNotices (no receipt or admin notice for a test payment once live)")
    for body in re.findall(r"transaction\.update\(standOrderRef, \{(.*?)\}\);", text, re.S):
        need("issuedInTestMode" not in body, "settlement never writes issuedInTestMode (provenance is never relabelled)")
    need(sum(1 for line in text.split("\n") if ".confirmNotification(" in line and not line.strip().startswith(("//", "*", "/*"))) == 1, "confirmNotification still runs exactly once")
    need(text.count("vendorStandOrderAmountMatches(") >= 4, "the amount guards (pre-read, paid tx, pending, pending tx) remain")
    need("Paid stand order was issued in test mode" in text or "not counted as paid" in text, "a suppressed settlement logs why (vendorSubmissionId only)")


def check_initiate_order() -> None:
    text = read(INITIATE)
    ip_at, ip_line = anchor_line(text, "stand-ip-limit", INITIATE)
    need("clientActorKey(request.headers.get('x-forwarded-for'))" in ip_line, "stand-ip-limit line derives the actor with clientActorKey(request.headers.get('x-forwarded-for'))")
    need(ip_at < index_of(text, "await request.json()", "body parse"), "the per-actor limit runs before the body is parsed")
    need("STAND_PAYMENT_LIMITS.ipRequests" in text and "STAND_PAYMENT_LIMITS.ipWindowMs" in text, "per-actor limit uses STAND_PAYMENT_LIMITS")
    verify_at = index_of(text, "verifyVendorStandPaymentToken(", "token verify")
    sub_at = index_of(text, "submissionRef.get()", "submission read")
    gate_at, gate_line = anchor_line(text, "stand-link-gate", INITIATE)
    tok_at, tok_line = anchor_line(text, "stand-token-limit", INITIATE)
    order_read = index_of(text, "standOrderRef.get()", "stand order read")
    need(ip_at < verify_at < sub_at < gate_at < tok_at < order_read, "order is: actor limit, verify, submission read, link gate, per-submission limit, stand order read")
    need("decideStandLinkUse(" in gate_line and "verification.nonce" in gate_line and "standPaymentLink" in gate_line, "link gate passes verification.nonce and the submission's standPaymentLink record")
    need(re.search(r"key:\s*vendorSubmissionId\b", tok_line) is not None, "stand-token-limit line keys the limit on key: vendorSubmissionId")
    need("STAND_PAYMENT_LIMITS.tokenRequests" in text and "STAND_PAYMENT_LIMITS.tokenWindowMs" in text, "per-submission limit uses STAND_PAYMENT_LIMITS")
    need(re.search(r"if \(!linkDecision\.ok\)\s*\{?\s*return genericTokenRefusal\(\)", text) is not None, "a superseded, revoked, expired or malformed link gets the existing generic 403 (This payment link is no longer valid.)")
    first_decide = index_of(text, "decideStandInitiate(", "pre-transaction decision")
    need(order_read < first_decide < index_of(text, "db.runTransaction", "transaction"), "the initiate decision runs after the stand order read and before the transaction")
    tx_body = text[text.index("db.runTransaction"):]
    need("decideStandInitiate(" in tx_body, "the transaction re-runs decideStandInitiate on the transactional read")
    need(re.search(r"data\(\)\?\.status === 'paid'", text) is None, "no raw status === 'paid' check remains in initiate")
    for needle in ("ALREADY_PAID_MESSAGE", "PENDING_NOTICE_BODY"):
        need(text.count(needle) >= 3, f"{needle} is reused for the decision reasons (existing copy)")
    need("AbuseLimiterUnavailableError" in text and "Retry-After" in text, "limiter outage is handled and 429 carries Retry-After")
    _, closed = anchor_line(text, "stand-limiter-fail-closed", INITIATE)
    need(re.search(r"status: 5\d\d", closed) is not None, "a limiter outage refuses the request with a 5xx (fail closed), never allows it")
    need(f"'{TOO_MANY}'" in text, "429 copy is the existing checkout string, verbatim")
    need(text.count("consumeAbuseLimit(") == 2, "exactly two limiter calls (actor, submission)")


def check_link_writers() -> None:
    resend = read(RESEND)
    need("buildStandPaymentLinkRecord(" in resend and "nonce" in resend, "resend records the new link (buildStandPaymentLinkRecord) from the minted nonce, superseding every earlier link")
    need(resend.index("buildStandPaymentLinkRecord(") < resend.index("NextResponse.json({ success: true, paymentUrl })"), "the record is written before the paymentUrl is returned")
    need(re.search(r"standPaymentLink", resend) is not None and ".update(" in resend, "resend persists standPaymentLink with update (never a full-document set)")
    for forbidden in ("deliverConfirmationEmailAfterCommit", "sendVendor", "@/lib/email", "from 'resend'"):
        need(forbidden not in resend, f"resend stays copy-only (#150): found {forbidden!r}")
    need("standOrderCountsAsPaid(" in resend or "decideStandInitiate(" in resend, "resend's already-paid refusal uses the counts-as-paid rule")
    review = read(REVIEW)
    need("buildStandPaymentLinkRecord(" in review, "approval records the link it emails")
    need(review.index("buildStandPaymentLinkRecord(") < review.index("sendVendorStandPaymentNoticeEmail({"), "the record is written before the email is sent")
    token = read(TOKEN)
    need("VENDOR_STAND_PAYMENT_TOKEN_MAX_TTL_MS" in token, "token module caps ttl")


def check_revoke_route() -> None:
    text = read(REVOKE)
    need(re.findall(r"export async function (\w+)", text) == ["POST"], "revoke route exports POST only")
    need(re.search(r"if \(!session\.ok\)", text) is not None, "revoke refuses when the session is not ok")
    need(re.search(r"if \(!hasCapability\(", text) is not None, "revoke refuses when the capability check fails")
    session_at = index_of(text, "getAdminSession()", "admin session")
    cap_at = index_of(text, "hasCapability(", "capability check")
    need("'review-vendor-applications'" in text[cap_at: cap_at + 200], "revoke needs the review-vendor-applications capability (no new capability)")
    db_at = index_of(text, "getFirestore(", "firestore")
    need(session_at < cap_at < db_at, "session, then capability, then any Firestore access")
    need("status = session.reason === 'no-session' || session.reason === 'invalid-session' ? 401 : 403" in text.replace("\n", " ").replace("    ", " ") or "401" in text and "403" in text, "401 for no/invalid session, 403 otherwise, as the resend route")
    need("buildStandPaymentLinkRevocation(" in text and re.search(r"freshNonce:\s*randomBytes\(\d+\)\.toString\('hex'\)", text) is not None, "revocation uses buildStandPaymentLinkRevocation with freshNonce: randomBytes(n).toString('hex') (kills legacy links too)")
    for forbidden in ("deliverConfirmationEmailAfterCommit", "sendVendor", "@/lib/email", "from 'resend'"):
        need(forbidden not in text, f"revoke sends nothing: found {forbidden!r}")
    need(".update(" in text and ".set(" not in text, "revoke writes with update on the submission, never a full set")
    for rel in (RESEND, REVIEW):
        gate = read(rel)
        need("getAdminSession()" in gate and re.search(r"if \(!hasCapability\(", gate) is not None and re.search(r"if \(!session\.ok\)", gate) is not None, f"{rel} keeps its admin gate")


def check_views_fail_closed() -> None:
    for rel in (ADMIN_LIST, ADMIN_DETAIL):
        text = read(rel)
        need("effectiveStandPaymentStatus(" in text, f"{rel} derives the stand status with effectiveStandPaymentStatus")
        need("vendorOfficePaymentReceived(" in text, f"{rel} derives paymentReceived with vendorOfficePaymentReceived")
    need("STAND_ORDER_STATUSES.find" not in read(ADMIN_DETAIL), "the detail page no longer trusts the raw stored status")
    need("as VendorStandOrderStatus" not in read(ADMIN_LIST), "the list page no longer casts the raw stored status")
    for rel in (ADMIN_LIST, ADMIN_DETAIL, PAY_PAGE, STATUS_PAGE, RESEND, INITIATE):
        need("!isTicketingTestMode()" in read(rel), f"{rel} derives liveMode as !isTicketingTestMode()")
    for rel in (PAY_PAGE, STATUS_PAGE, RESEND):
        text = read(rel)
        need("standOrderCountsAsPaid(" in text or "decideStandInitiate(" in text, f"{rel} uses the counts-as-paid rule")
    pay = read(PAY_PAGE)
    need("decideStandLinkUse(" in pay and "verification.nonce" in pay, "the vendor payment page applies the same link gate as initiate (a revoked or superseded link shows the existing fallback)")
    offenders = []
    for base in ("app", "lib", "components"):
        for path in (ROOT / base).rglob("*"):
            if path.suffix not in {".ts", ".tsx"} or not path.is_file():
                continue
            rel = path.relative_to(ROOT).as_posix()
            if rel in {PAID, NOTIFY}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            if "VENDOR_STAND_ORDERS_COLLECTION" not in text and "vendorStandOrders" not in text:
                continue
            lines = text.split("\n")
            for number, line in enumerate(lines):
                if re.search(r"status\s*[!=]==\s*'paid'", line) and "standOrderCountsAsPaid(" not in line + (lines[number + 1] if number + 1 < len(lines) else ""):
                    offenders.append(f"{rel}:{number + 1}")
    need(not offenders, f"raw status === 'paid' on a stand order in: {offenders}; use standOrderCountsAsPaid / effectiveStandPaymentStatus")
    labels = read(LABELS)
    need(re.search(r"'test-paid':\s*'Test paid',?\s*//\s*awaiting committee copy", labels) is not None, "'test-paid' label is the stopgap with an `// awaiting committee copy` marker (spec D8)")
    table = read(TABLE)
    need("'test-paid': 'neutral'" in table, "test-paid pill reuses the existing neutral tone (no new colour)")
    need("standPaymentStatus !== 'paid'" in table, "the payment-link control stays visible for test-paid (only a real paid hides it)")


def added_lines() -> list[tuple[str, str]]:
    base = merge_base()
    out: list[tuple[str, str]] = []
    current = ""
    for raw in git("diff", "-U0", base, "--", "app", "components", "lib").split("\n"):
        if raw.startswith("+++ b/"):
            current = raw[6:]
        elif raw.startswith("+") and not raw.startswith("+++"):
            out.append((current, raw[1:]))
    for rel in git("ls-files", "--others", "--exclude-standard", "--", "app", "components", "lib").split("\n"):
        if rel:
            for line in (ROOT / rel).read_text(encoding="utf-8", errors="ignore").split("\n"):
                out.append((rel, line))
    return out


def check_no_new_copy() -> None:
    base = merge_base()
    literal = re.compile(r"'([^'\n]{12,})'|\"([^\"\n]{12,})\"|`([^`\n]{12,})`")
    found = []
    for rel, line in added_lines():
        stripped = line.strip()
        if stripped.startswith(("//", "*", "/*", "import ")) or "console." in line or "anchor:" in line:
            continue
        if rel in {PAID, LINK} or "Error(" in line:
            continue
        for match in literal.finditer(line):
            text = next(group for group in match.groups() if group)
            if text.count(" ") < 2 or re.fullmatch(r"[A-Z][A-Za-z0-9 ,.'’!?:;()\-—/]+", text) is None:
                continue
            if text in COPY_ALLOWLIST:
                continue
            present = subprocess.run(["git", "grep", "-F", "-q", "--", text, base, "--", "app", "components", "lib"], cwd=ROOT, capture_output=True).returncode == 0
            if not present:
                found.append(f"{rel}: {text!r}")
    need(not found, "new user-facing copy (docs/rules/no-invention.md): " + "; ".join(found))


def check_no_backfill() -> None:
    names = changed_files()
    need(not any(n.startswith("scripts/") for n in names), "F5 adds no script under scripts/ (NOS Site never writes prod data; any backfill is a SAOC hand-off note)")
    for rel, line in added_lines():
        need("backfill" not in line.lower() or line.strip().startswith(("//", "*")), f"{rel}: code mentioning backfill: {line.strip()!r}")


def check_hunk_list() -> None:
    extra = sorted(n for n in changed_files() if n not in ALLOWED_FILES and not n.startswith(SPEC_DIR))
    need(not extra, f"files outside the SAOC-cleared hunk list: {extra}")


def check_unchanged() -> None:
    base = merge_base()
    for rel in UNCHANGED:
        need(subprocess.run(["git", "diff", "--quiet", base, "--", rel], cwd=ROOT).returncode == 0, f"{rel} must be unchanged")
    need("const TICKETING_PAYMENTS_LIVE = false;" in read("lib/ticketing-test-mode.ts"), "F5 does not launch payments")


def check_settlement_deps_shape() -> None:
    text = read(NOTIFY)
    block = text[index_of(text, "export interface VendorStandPaymentNotificationDeps {", "deps interface"):]
    block = block[: block.index("}")]
    need("db?:" in block and "liveMode?: boolean" in block, "deps keeps db? and adds liveMode?: boolean")


def check_cache_probe_entries() -> None:
    import json

    data = json.loads(read(CACHE_EXPECTATIONS))
    dynamic = data["routes"]["dynamic"]
    # Observed on a local production build in launched mode (2026-10-29): the token URL is
    # per-request (no-store). The /tickets/recover entry belongs to nos-order-recovery, see spec.md D9.
    for path, status in (("/vendors/payment?token=bogus", 200),):
        hits = [r for r in dynamic if r.get("host") == "nos" and r.get("path") == path]
        need(len(hits) == 1, f"routes.dynamic needs exactly one nos entry for {path}")
        need(hits[0].get("status") == status, f"{path} must record the observed status {status}")
    for route in data["routes"]["isr"] + data["routes"]["static"]:
        need("token=" not in route.get("path", ""), "a token URL is never classed isr or static")
    existing = [r for r in dynamic if r.get("path") == "/tickets/no-such-ticket-f4"]
    need(len(existing) == 1 and existing[0].get("status") == 404, "the existing f4 entry is untouched")


CHECKS = {
    "dependency-f3": check_dependency_f3,
    "stamp-at-initiate": check_stamp_at_initiate,
    "no-literal-stamp": check_no_literal_stamp,
    "settlement": check_settlement,
    "settlement-deps": check_settlement_deps_shape,
    "initiate-order": check_initiate_order,
    "link-writers": check_link_writers,
    "revoke-route": check_revoke_route,
    "views-fail-closed": check_views_fail_closed,
    "no-new-copy": check_no_new_copy,
    "no-backfill": check_no_backfill,
    "cache-probe-entries": check_cache_probe_entries,
    "hunk-list": check_hunk_list,
    "unchanged": check_unchanged,
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
