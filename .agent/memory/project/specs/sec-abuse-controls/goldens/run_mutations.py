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
SEATS = "lib/seat-holds.ts"
CLIENT_IP, BUYER_EMAIL = "lib/client-ip.ts", "lib/buyer-email.ts"
APPCHECK, APPCHECK_CLIENT = "lib/app-check.ts", "lib/app-check-client.ts"
RESERVATION, CHECKOUT = "lib/checkout-reservation.ts", "app/api/tickets/checkout/route.ts"

# (id, file, mode, anchor-or-None, old, new, check)
MUTATIONS = [
    ("M01", LIMITER, "anchor", "limiter-deny", " > input.maxAttempts", " >= input.maxAttempts", golden("abuse-limiter")),
    ("M02", LIMITER, "anchor", "limiter-window", "< input.windowMs", "< input.windowMs * 1000", golden("abuse-limiter")),
    ("M03", LIMITER, "anchor", "ipv6-prefix", "slice(0, 4)", "slice(0, 8)", golden("abuse-limiter")),
    ("M04", LIMITER, "anchor", "limiter-hash", "createHmac('sha256', secret)", "createHmac('sha256', 'fixed')", golden("abuse-limiter")),
    ("M05", SEATS, "anchor", "held-expired", "> nowMs", ">= nowMs", golden("seat-holds")),
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
    ("M19", "lib/data/tickets.ts", "first", None, "from '@/lib/seat-holds'", "from '@/lib/seat-holdsX'", wiring("seat-ledger")),
    ("M20", "lib/abuse-limiter.ts", "append", None, "", "\n// isOzowSandboxTestModeEnabled\n", wiring("sandbox-independent")),
    ("M21", APPCHECK, "anchor", "appcheck-flag", "!OFF_VALUES.has(", "OFF_VALUES.has(", golden("app-check")),
    ("M22", APPCHECK, "anchor", "appcheck-replay", "alreadyConsumed", "alreadyConsumed && false", golden("app-check")),
    ("M23", APPCHECK, "first", None, "consume: true", "consume: false", wiring("appcheck-scope")),
    ("M24", APPCHECK_CLIENT, "anchor", "client-gate", "!siteKey", "false", golden("app-check-client")),
    ("M25", "lib/tickets-notification.ts", "append", None, "", "\n// requireCheckoutAppCheck\n", wiring("appcheck-scope")),
    ("M26", "lib/abuse-limiter.ts", "append", None, "", "\nconst leftmost = headers.get('x-forwarded-for')?.split(',')[0];\n", wiring("xff-trusted-hop")),
    ("M27", "components/tickets/useTicketCart.ts", "append", None, "", "\nimport 'firebase/app-check';\n", wiring("client-gated")),
    ("M28", ".next/static/chunks/zz-mutation.js", "create", None, "", "firebaseappcheck.googleapis.com", wiring("bundle-flag-off")),
    ("M29", "lib/provisional-figures.ts", "append", None, "", "\nconst reuse = { slug: 'adult' };\n", wiring("retired-slugs")),
    ("M30", "app/ticket-fixtures/buy/page.tsx", "append", None, "", "\nconst pool = { capacityPool: \"exhibitor\" };\n", wiring("retired-slugs")),
    ("M31", "next.config.ts", "first", None, "process.env.NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY ?? ''", "process.env.NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY", wiring("flag-off-inlining")),
    ("M32", "components/tickets/useTicketCart.ts", "append", None, "", "\nimport { getCheckoutAppCheckToken } from '@/lib/app-check-client';\n", wiring("flag-off-inlining")),
    ("M33", "app/api/newsletter/subscribe/route.ts", "first", None, "consumeAbuseLimit(", "consumeAbuseLimitX(", wiring("newsletter-limited")),
    ("M34", ".agent/memory/project/specs/footer-newsletter-subscribe/checks/check-subscribe-handler.mjs", "append", None, "", "\n// edit\n", wiring("newsletter-checks-reviewed")),
    ("M35", WEBHOOK, "anchor", "webhook-declared-cancel", "await request.body?.cancel();", "", golden("webhook-body")),
    ("M36", SEATS, "anchor", "held-timestamp", "instanceof Timestamp", "instanceof Object", golden("seat-holds")),
    ("M37", LIMITER, "anchor", "limiter-tx-read", "await transaction.get(ref)", "await db.runTransaction((other) => other.get(ref)).then(async (stale) => { await new Promise<void>((r) => setImmediate(r)); return stale; })", golden("abuse-limiter")),
    ("M38", CLIENT_IP, "anchor", "xff-min-hops", "< 2", "< 1", golden("abuse-limiter")),
    ("M39", BUYER_EMAIL, "anchor", "buyer-plus-strip", "indexOf('+')", "indexOf('\\u0001')", golden("buyer-email")),
    ("M40", BUYER_EMAIL, "anchor", "buyer-gmail-dots", "'.'", "'\\u0001'", golden("buyer-email")),
    ("M41", CHECKOUT, "first", None, "abuseKeyStamp('checkout-buyer', buyerIdentity)", "abuseKeyStamp('checkout-buyer', lineItems[0].attendeeEmail)", wiring("buyer-normalised")),
    ("M42", LIMITER, "first", None, "trustedClientIpFromForwardedFor(", "clientIpFromForwardedFor(", wiring("client-ip-helper")),
    ("M43", BUYER_EMAIL, "anchor", "buyer-pair-actor", "[actorKey, ", "['', ", golden("buyer-email")),
    ("M44", BUYER_EMAIL, "anchor", "buyer-pair-actor", "[actorKey, ", "['', ", golden("abuse-limiter")),
    ("M45", CHECKOUT, "first", None, "buyerPairKey(", "normalizeBuyerEmail(", wiring("buyer-normalised")),
    ("M46", CHECKOUT, "append", None, "", "\nconst leaked = { email: buyerIdentity };\n", wiring("buyer-normalised")),
    ("M47", "lib/orders.ts", "append", None, "", "\nimport { normalizeBuyerEmail } from './buyer-email';\n", wiring("buyer-normalised")),
    ("M48", LIMITER, "anchor", "stamp-hash", "hashAbuseKey(secret, scope, key)", "key", golden("abuse-limiter")),
    ("M49", LIMITER, "anchor", "limiter-doc-id", "${keyHash}", "${input.key}", golden("abuse-limiter")),
    ("M50", LIMITER, "anchor", "ipv4-mapped", "'ffff'", "'fffe'", golden("abuse-limiter")),
    ("M51", CHECKOUT, "first", None, ".where('clientKey', '==', input.actor.clientKey).where('status', '==', RESERVED_STATUS)", ".where('clientKey', '==', input.actor.clientKey).where('status', '==', 'paid')", wiring("hold-budget-status")),
    ("M52", CHECKOUT, "first", None, ".where('buyerKey', '==', input.actor.buyerKey).where('status', '==', RESERVED_STATUS)", ".where('buyerKey', '==', input.actor.buyerKey).where('status', '==', 'paid')", wiring("hold-budget-status")),
    ("M53", APPCHECK_CLIENT, "anchor", "load-memo-clear", "cached = null", "void 0", golden("app-check-client")),
    ("M54", CHECKOUT, "first", None, "transaction.get(\n        tickets.where('clientKey', '==', input.actor.clientKey).where('status', '==', RESERVED_STATUS)\n      )", "tickets.where('clientKey', '==', input.actor.clientKey).where('status', '==', RESERVED_STATUS).get()", wiring("hold-budget-status")),
    ("M55", CHECKOUT, "first", None, "transaction.get(\n        tickets.where('buyerKey', '==', input.actor.buyerKey).where('status', '==', RESERVED_STATUS)\n      )", "tickets.where('buyerKey', '==', input.actor.buyerKey).where('status', '==', RESERVED_STATUS).get()", wiring("hold-budget-status")),
    ("M56", APPCHECK_CLIENT, "first", None, "memoizeSuccessfulLoad(loadBuildSource)", "(() => loadBuildSource())", wiring("client-load-recovery")),
    ("M57", LIMITER, "anchor", "limiter-derive", "createHmac('sha256', base).update(SECRET_DOMAIN_LABEL)", "createHmac('sha256', '').update(base + SECRET_DOMAIN_LABEL)", golden("abuse-limiter")),
    ("M58", LIMITER, "anchor", "limiter-derive", "createHmac('sha256', base).update(SECRET_DOMAIN_LABEL)", "createHmac('sha256', SECRET_DOMAIN_LABEL).update(base)", golden("abuse-limiter")),
    ("M59", LIMITER, "anchor", "limiter-log", "scope: input.scope,", "scope: input.scope, secretLeak: deriveSecret(),", golden("abuse-limiter")),
    ("M60", LIMITER, "anchor", "limiter-doc-scope", "scope: input.scope,", "scope: input.scope, note: undefined,", golden("abuse-limiter")),
    ("M61", "components/tickets/appCheckHeader.ts", "anchor", "appcheck-header-fallback", "return {};", "throw new Error('skip the request');", golden("appcheck-header")),
    ("M62", "components/tickets/useTicketCart.ts", "first", None, "appCheckHeaders(", "appCheckHeadersX(", wiring("client-gated")),
    ("M63", CHECKOUT, "first", None, "heldByActorSnapshot.docs.map((doc) => doc.data())", "[]", golden("checkout-route")),
    ("M64", CHECKOUT, "first", None, "heldByBuyerSnapshot.docs.map((doc) => doc.data())", "[]", golden("checkout-route")),
    ("M65", CHECKOUT, "first", None, "if (!holdBudget.ok)", "if (false)", golden("checkout-route")),
    ("M66", CHECKOUT, "first", None, "if (!actorLimit.allowed)", "if (false)", golden("checkout-route")),
    ("M67", CHECKOUT, "first", None, "if (!buyerLimit.allowed)", "if (false)", golden("checkout-route")),
    ("M68", CHECKOUT, "first", None, "return limiterUnavailable(error);", "actorLimit = { allowed: true };", golden("checkout-route")),
    ("M69", CHECKOUT, "first", None, "if (!appCheck.ok) {", "if (false) {", golden("checkout-route")),
    ("M70", CHECKOUT, "first", None, "transaction.get(\n        tickets.where('clientKey', '==', input.actor.clientKey).where('status', '==', RESERVED_STATUS)\n      )", "tickets.where('clientKey', '==', input.actor.clientKey).where('status', '==', RESERVED_STATUS).get()", golden("checkout-route")),
    ("M71", "app/api/contact/route.ts", "first", None, "if (!limit.allowed)", "if (false)", golden("routes-limited")),
    ("M72", "app/api/newsletter/subscribe/route.ts", "first", None, "if (!limit.allowed)", "if (false)", golden("routes-limited")),
    ("M73", "app/api/newsletter/unsubscribe/route.ts", "first", None, "if (!limit.allowed)", "if (false)", golden("routes-limited")),
    ("M74", "app/api/tickets/status/route.ts", "first", None, "if (!limit.allowed)", "if (false)", golden("routes-limited")),
    ("M75", "app/api/tickets/pdf/route.ts", "first", None, "if (!limit.allowed)", "if (false)", golden("routes-limited")),
    ("M76", "app/api/contact/route.ts", "first", None, "key: clientActorKey(request.headers.get('x-forwarded-for')),", "key: 'constant',", golden("routes-limited")),
    ("M77", "app/api/newsletter/subscribe/route.ts", "first", None, "key: clientActorKey(request.headers.get('x-forwarded-for')),", "key: 'constant',", golden("routes-limited")),
    ("M78", "app/api/newsletter/unsubscribe/route.ts", "first", None, "key: clientActorKey(request.headers.get('x-forwarded-for')),", "key: 'constant',", golden("routes-limited")),
    ("M79", "app/api/tickets/status/route.ts", "first", None, "key: clientActorKey(request.headers.get('x-forwarded-for')),", "key: 'constant',", golden("routes-limited")),
    ("M80", "app/api/tickets/pdf/route.ts", "first", None, "key: clientActorKey(request.headers.get('x-forwarded-for')),", "key: 'constant',", golden("routes-limited")),
    ("M81", "lib/tickets-notification.ts", "first", None, "if (!capped.ok)", "if (false)", golden("webhook-handlers")),
    ("M82", "lib/vendor-stand-payment-notification.ts", "first", None, "if (!capped.ok)", "if (false)", golden("webhook-handlers")),
    ("M83", "lib/tickets-notification.ts", "first", None, "await readCappedBody(request)", "{ ok: true as const, text: await request.text() }", golden("webhook-handlers")),
    ("M84", "lib/vendor-stand-payment-notification.ts", "first", None, "await readCappedBody(request)", "{ ok: true as const, text: await request.text() }", golden("webhook-handlers")),
    ("M85", "lib/data/tickets.ts", "first", None, "stillHoldsSeat(data, Date.now())", "true", golden("ledger-counts")),
    ("M86", "lib/data/tickets.ts", "last", None, "stillHoldsSeat(data, Date.now())", "true", golden("ledger-counts")),
    ("M87", "firestore.indexes.json", "first", None, '"fieldPath": "expireAt"', '"fieldPath": "expiresAt"', wiring("ttl-policy")),
    ("M88", "firestore.indexes.json", "first", None, '"ttl": true', '"ttl": false', wiring("ttl-policy")),
    ("M18", "app/api/contact/route.ts", "append", None, "", "\nimport { createAttemptStore } from '@/lib/newsletter-rate-store';\n", wiring("no-memory-limiter")),
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
            if passes(check):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(new, encoding="utf-8")
                try:
                    if passes(check):
                        failures.append(f"{mutation_id}: SURVIVED (created {rel})")
                    else:
                        print(f"{mutation_id}: killed")
                finally:
                    path.unlink(missing_ok=True)
            else:
                failures.append(f"{mutation_id}: baseline check already fails")
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
    shutil.rmtree(SANDBOX, ignore_errors=True)
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"all {len(MUTATIONS)} mutations killed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
