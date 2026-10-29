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
    appcheck = first(text, "requireCheckoutAppCheck(", CHECKOUT)
    if not (limit1 < appcheck < first(text, "request.json()", CHECKOUT)):
        fail("requireCheckoutAppCheck must run after the per-IP limit and before request.json()")
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
    for statement in re.findall(r"^import[^;]*from\s+['\"]firebase-admin[^'\"]*['\"]", holds, re.M):
        if not re.fullmatch(r"import\s*\{\s*Timestamp\s*\}\s*from\s*['\"]firebase-admin/firestore['\"]", statement):
            fail("lib/seat-holds.ts may import only the Timestamp class from firebase-admin/firestore (no init, no app)")
    if not re.search(r"instanceof\s+Timestamp", holds):
        fail("lib/seat-holds.ts must release a seat only for a real Firestore Timestamp (instanceof Timestamp), never a duck-typed toMillis")
    if "toMillis" in holds and "instanceof" not in holds:
        fail("lib/seat-holds.ts must not duck-type toMillis")
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


# Retired ticketType slugs that still have live `reserved` tickets with no expiresAt (they hold a
# seat forever by design, lib/data/tickets.ts:29-31). Source: SAOC H7 count of 2026-10-29: 11
# legacy PayFast-era tickets with showId "nationalShow", ticketType "adult" x4 and "exhibitor" x7.
# A new active product (or capacityPool) reusing one of these slugs would inherit those phantom
# holds. Empty this tuple once SAOC confirms the purge of those documents.
RETIRED_SLUGS_WITH_LEGACY_HOLDS = ("adult", "exhibitor")
# Files that declare active ticket types, pools or fixtures. OLD_PLACEHOLDER_SLUGS lines (the
# cleanup list that names the retired slugs on purpose) are skipped.
TICKET_DECLARATION_FILES = [
    "lib/provisional-figures.ts", "lib/demo-ticket-type-seed-plan.ts", "lib/fictional-test-show-seed-plan.ts",
    "scripts/seed-ticketing.ts", "scripts/seed-qa-fixture-ticket-type.ts", "scripts/migrate-conference-workshop-tickets.ts",
    "sanity/schemas/documents/ticketType.ts", "scripts/seed-door-test-tickets.ts",
]
TICKET_DECLARATION_DIRS = ["app/ticket-fixtures"]
# Known existing use, tolerated until SAOC retargets the seeder (hand-off H12): the door QR test
# seeder writes a `reserved` fixture ticket of type "exhibitor". Exact (file, line) text only.
RETIRED_SLUG_EXEMPTIONS = {("scripts/seed-door-test-tickets.ts", "const TICKET_TYPE = 'exhibitor';")}


APP_CHECK_ALLOWED_USERS = {
    CHECKOUT, "lib/app-check.ts", "lib/app-check-client.ts", "components/tickets/useTicketCart.ts",
}
# Every path the proxy exempts (proxy.ts EXEMPT_PATHS) plus the notification libraries behind them.
NEVER_APP_CHECK = [
    "proxy.ts", TICKETS_NOTIFY, VENDOR_NOTIFY,
    "app/api/tickets/itn/route.ts", "app/api/tickets/ozow-itn/route.ts",
    "app/api/vendors/stand-payment/payfast-itn/route.ts", "app/api/vendors/stand-payment/ozow-itn/route.ts",
    "app/api/revalidate/route.ts", "app/api/admin/reconcile-orders/route.ts", "lib/reconciliation.ts",
]
APP_CHECK_TOKENS = re.compile(r"app-check|appcheck", re.I)
SOURCE_ROOTS = ["app", "lib", "components", "sanity", "proxy.ts"]


def source_files():
    for root in SOURCE_ROOTS:
        base = ROOT / root
        if base.is_file():
            yield base
        elif base.is_dir():
            for path in base.rglob("*"):
                if path.suffix in (".ts", ".tsx") and "node_modules" not in path.parts:
                    yield path


def check_appcheck_scope() -> None:
    for rel in NEVER_APP_CHECK:
        if APP_CHECK_TOKENS.search(read(rel)):
            fail(f"{rel}: server-to-server and exempt routes must never reference App Check")
    for path in source_files():
        rel = str(path.relative_to(ROOT))
        if rel in APP_CHECK_ALLOWED_USERS:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if "requireCheckoutAppCheck" in text or "@/lib/app-check" in text:
            fail(f"{rel}: App Check is for the checkout POST only")
    server = read("lib/app-check.ts")
    for needle in ("consume: true", "getAppCheck", "import('firebase-admin/app-check')"):
        first(server, needle, "lib/app-check.ts")
    if re.search(r"^import[^;]*from\s+['\"]firebase-admin", server, re.M):
        fail("lib/app-check.ts must import firebase-admin lazily")


def check_client_gated() -> None:
    for path in source_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        if re.search(r"""^\s*import\b[^;\n]*['"]firebase/app-check['"]""", text, re.M) or re.search(r"""require\(['"]firebase/app-check""", text):
            fail(f"{path.relative_to(ROOT)}: firebase/app-check may only be loaded with a dynamic import() behind the site-key gate")
    rel = "lib/app-check-client.ts"
    text = read(rel)
    first(text, "process.env.NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY", rel)
    if not re.search(r"BUILD_SITE_KEY\s*\?[^;]*import\('firebase/app-check'\)", text, re.S):
        fail("the dynamic import must sit inside a BUILD_SITE_KEY ? ... : undefined ternary so a flag-off build drops it")
    if not re.search(r"if \(!siteKey\) return null;", text):
        fail("getCheckoutAppCheckToken must return null before any load when the site key is unset")
    cart = read("components/tickets/useTicketCart.ts")
    token = first(cart, "getCheckoutAppCheckToken(", "components/tickets/useTicketCart.ts")
    if token > first(cart, "fetch('/api/tickets/checkout'", "components/tickets/useTicketCart.ts"):
        fail("the token must be fetched fresh before each checkout fetch")
    if not re.search(r"x-firebase-appcheck", cart, re.I):
        fail("useTicketCart must send the X-Firebase-AppCheck header")


def check_buyer_normalised() -> None:
    route = read("app/api/tickets/checkout/route.ts")
    if "normalizeBuyerEmail(" not in route or not re.search(r"from\s+['\"](@/lib/|\.\./\.\./\.\./\.\./lib/)buyer-email['\"]", route):
        fail("checkout route must derive the buyer identity with normalizeBuyerEmail from lib/buyer-email")
    if re.search(r"buyerEmail\s*=\s*[^;\n]*\.trim\(\)\.toLowerCase\(\)", route):
        fail("checkout route must not build the buyer identity from a bare trim/lowercase")
    uses = re.findall(r"abuseKeyStamp\('checkout-buyer',\s*(\w+)\)", route) + re.findall(r"key:\s*(buyerEmail|buyerKeySource|\w+),\s*\n\s*maxAttempts:\s*CHECKOUT_LIMITS\.buyerRequests", route)
    if len(set(uses)) != 1:
        fail(f"the request limit and the held-seat stamp must use one buyer identity variable, saw {sorted(set(uses))}")


def check_client_ip_helper() -> None:
    client_ip = read("lib/client-ip.ts")
    if "export function trustedClientIpFromForwardedFor" not in client_ip:
        fail("lib/client-ip.ts must export trustedClientIpFromForwardedFor (two or more hops required)")
    if "// anchor: xff-min-hops" not in client_ip:
        fail("lib/client-ip.ts must mark the minimum-hop guard with // anchor: xff-min-hops")
    limiter = read("lib/abuse-limiter.ts")
    if "trustedClientIpFromForwardedFor(" not in limiter or "clientIpFromForwardedFor(" in re.sub(r"trustedClientIpFromForwardedFor\(", "", limiter):
        fail("clientActorKey must use trustedClientIpFromForwardedFor, not the single-entry-tolerant helper")
    # The shared helper keeps its documented behaviour for every non-F3 caller.
    if "if (hops.length === 1) return hops[0] ?? null;" not in client_ip:
        fail("clientIpFromForwardedFor must be left unchanged for the existing SAOC-lane callers")


def check_xff_trusted_hop() -> None:
    files = set(OUR_SCOPE_CALLERS) | {"lib/abuse-limiter.ts", "lib/app-check.ts"}
    for rel in sorted(files):
        for number, line in enumerate(read(rel).splitlines(), 1):
            if re.search(r"x-forwarded-for", line, re.I) and "clientActorKey(" not in line and "clientIpFromForwardedFor(" not in line:
                fail(f"{rel}:{number}: x-forwarded-for may only be read through clientActorKey()")
            if re.search(r"forwarded[^\n]*split\(\s*['\"],['\"]\s*\)\s*\[\s*0\s*\]", line, re.I):
                fail(f"{rel}:{number}: the leftmost x-forwarded-for entry is client-supplied and must never be used")


# App Check specific shapes only. "recaptcha/enterprise.js" is NOT a marker: firebase/auth's own
# bundle (admin login chunk) legitimately carries recaptchaEnterpriseScript with that URL.
FLAG_OFF_BUNDLE_MARKERS = (
    "firebaseappcheck.googleapis.com", "getLimitedUseToken",
    "ReCaptchaEnterpriseProvider", "exchangeRecaptchaEnterpriseToken",
)


def check_bundle_flag_off() -> None:
    static = ROOT / ".next" / "static"
    if not static.is_dir():
        fail("no .next/static - run `pnpm build` (with NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY unset) first")
    for path in static.rglob("*"):
        if path.suffix not in (".js", ".css", ".html", ".json") or not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for marker in FLAG_OFF_BUNDLE_MARKERS:
            if marker in text:
                fail(f"flag-off build ships App Check/reCAPTCHA client code ({marker} in {path.relative_to(ROOT)})")


def check_retired_slugs() -> None:
    files = [ROOT / rel for rel in TICKET_DECLARATION_FILES]
    for directory in TICKET_DECLARATION_DIRS:
        base = ROOT / directory
        if base.is_dir():
            files.extend(p for p in base.rglob("*") if p.suffix in (".ts", ".tsx", ".json"))
    pattern = re.compile(r"""['"](%s)['"]""" % "|".join(re.escape(s) for s in RETIRED_SLUGS_WITH_LEGACY_HOLDS)) if RETIRED_SLUGS_WITH_LEGACY_HOLDS else None
    for path in files:
        if pattern is None or not path.is_file():
            continue
        rel = str(path.relative_to(ROOT))
        for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if "OLD_PLACEHOLDER_SLUGS" in line or (rel, line.strip()) in RETIRED_SLUG_EXEMPTIONS:
                continue
            if pattern.search(line):
                fail(f"{rel}:{number}: retired ticket slug {pattern.search(line).group(1)!r} (live phantom holds, SAOC H7 2026-10-29); pick another slug or capacityPool")


SITE_KEY_ENV = "NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY"
NEWSLETTER_ROUTES = {
    "app/api/newsletter/subscribe/route.ts": "newsletter-subscribe",
    "app/api/newsletter/unsubscribe/route.ts": "newsletter-unsubscribe",
}
# QA inputs edited by @dev (rate limiting moved out of the handler) and reviewed by @architect
# 2026-10-29: kept because they still prove the handler's behaviour and the limiting proof now lives
# in check_newsletter_limited(). Any further edit changes the hash and fails the gate.
REVIEWED_QA_INPUT_EDITS = {
    ".agent/memory/project/specs/footer-newsletter-subscribe/checks/check-subscribe-handler.mjs":
        "1d005c9a7470b71ed9d9618598e74338834e4ccae12fc6ea4b3d4eaa4729b892",
    ".agent/memory/project/specs/footer-newsletter-subscribe/checks/check-unsubscribe-handler.mjs":
        "c1af8f6ab912cc9c62ed91dca47998a0fd1e434312521b087c0204fdc2263459",
}


def check_flag_off_inlining() -> None:
    config = read("next.config.ts")
    if not re.search(r"env\s*:\s*\{[^}]*%s\s*:\s*process\.env\.%s\s*\?\?\s*''" % (SITE_KEY_ENV, SITE_KEY_ENV), config, re.S):
        fail(f"next.config.ts must inline {SITE_KEY_ENV} as `process.env.{SITE_KEY_ENV} ?? ''` so the flag-off ternary folds")
    allowed = re.compile(r"^\+\s*($|//|env\s*:\s*\{|\},?$|%s)" % SITE_KEY_ENV)
    for line in git("diff", "-U0", "origin/main", "--", "next.config.ts").splitlines():
        if line.startswith("+") and not line.startswith("+++") and not allowed.match(line):
            fail(f"next.config.ts: change beyond the App Check env inlining: {line.strip()[:100]}")
    cart = read("components/tickets/useTicketCart.ts")
    if not re.search(r"process\.env\.%s\s*\?\s*\(\)\s*=>\s*import\('@/lib/app-check-client'\)\s*:\s*undefined" % SITE_KEY_ENV, cart):
        fail("useTicketCart must gate `import('@/lib/app-check-client')` behind the build-time site key ternary")
    for path in source_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        if re.search(r"""^\s*import\b[^;\n]*['"]@/lib/app-check-client['"]""", text, re.M):
            fail(f"{path.relative_to(ROOT)}: lib/app-check-client may only be loaded with a dynamic import() behind the build-time key")


def check_newsletter_limited() -> None:
    for rel, scope in NEWSLETTER_ROUTES.items():
        text = read(rel)
        call = first(text, "consumeAbuseLimit(", rel)
        for later in ("request.json()", "initAdmin()", "runTransaction"):
            if later in text and call > text.index(later):
                fail(f"{rel}: consumeAbuseLimit must run before {later}")
        first(text, f"scope: '{scope}'", rel)
        first(text, "clientActorKey(request.headers.get('x-forwarded-for'))", rel)
        first(text, "NEWSLETTER_RATE_LIMIT_WINDOW_MS", rel)
        if "MAX_ATTEMPTS" not in text[call:call + 600]:
            fail(f"{rel}: the limiter call must use the existing NEWSLETTER_*_RATE_LIMIT_MAX_ATTEMPTS constant")
        for needle in ("429", "NEWSLETTER_COPY.rateLimited", "'Retry-After'", "AbuseLimiterUnavailableError"):
            first(text, needle, rel)


def check_newsletter_checks_reviewed() -> None:
    import hashlib
    for rel, digest in REVIEWED_QA_INPUT_EDITS.items():
        actual = hashlib.sha256(read(rel).encode("utf-8")).hexdigest()
        if actual != digest:
            fail(f"{rel}: QA input changed after architect review (sha256 {actual[:12]}...); only @architect may edit it")


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
    "appcheck-scope": check_appcheck_scope,
    "client-gated": check_client_gated,
    "xff-trusted-hop": check_xff_trusted_hop,
    "buyer-normalised": check_buyer_normalised,
    "client-ip-helper": check_client_ip_helper,
    "bundle-flag-off": check_bundle_flag_off,
    "retired-slugs": check_retired_slugs,
    "flag-off-inlining": check_flag_off_inlining,
    "newsletter-limited": check_newsletter_limited,
    "newsletter-checks-reviewed": check_newsletter_checks_reviewed,
}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in CHECKS:
        print("usage: check_wiring.py <" + "|".join(CHECKS) + ">", file=sys.stderr)
        sys.exit(2)
    CHECKS[sys.argv[1]]()
    print(f"PASS: {sys.argv[1]}")
