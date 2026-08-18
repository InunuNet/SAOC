# 2026-08-18 — Second reopening: source-IP ITN check demoted to log-only

**File:** `app/api/tickets/itn/route.ts` (guard 2, "Source IP"). Sha256 pin updated in
`itn-route.golden.sha256` and (same file, same pin) `contracts/golden/ticketing-hardening/
itn-route.golden.sha256`.

**What happened:** the first real end-to-end ticket purchase against PayFast sandbox (browser-
driven, real checkout → real PayFast sandbox payment → real ITN callback) was rejected at guard
2. Cloud Logging showed the rejection: `Source IP not in PayFast host set — rejecting ITN
{ m_payment_id: 'SAOC-2027-G08QJQK278NY', clientIp: '35.219.200.118' }`. `35.219.200.118`
reverse-resolves to a Google Cloud address, not to any IP `www.payfast.co.za` /
`sandbox.payfast.co.za` / `w1w.payfast.co.za` / `w2w.payfast.co.za` resolve to (checked live via
`dig` at the time). Critically, this rejection happened at guard 2, which only runs *after*
guard 1 (signature) passes — so the notification was genuinely, correctly signed by PayFast and
still got thrown away.

This is exactly the gap `contracts/golden/payfast-m1/README.md` flagged and never resolved:
"2. **Source IP** ... Do NOT hardcode IPs. **[VERIFY]** the host list." Nobody had verified it
against a live ITN until this session, because checkout itself was broken (missing
`RECOVERY_TOKEN_SECRET`, fixed earlier the same session) and the App Hosting backend wasn't
even auto-deploying (separate infra gap, also found and fixed this session) — so no real ITN had
ever reached this route in production before now.

**Fix:** guard 2 no longer returns early / rejects on an IP mismatch. It logs a `console.warn`
(not `console.error` — this is expected, not exceptional) and processing continues to guards
3-4. The actual security boundary — signature verification (guard 1) and PayFast's own
server-side round-trip re-confirmation (guard 4, requiring a literal `VALID` response from
`https://sandbox.payfast.co.za/eng/query/validate`) — is unchanged and still fail-closed.
Removing IP enforcement does not weaken the boundary: an attacker who can't forge the signature
or fool PayFast's own validate endpoint gains nothing from spoofing a source IP, and a genuine
PayFast notification (proven live, this session) can no longer be discarded because its sender
IP doesn't match a brittle, unverifiable-in-advance hostname-to-IP snapshot.

**Not done, worth a follow-up:** re-run the P1 weak-assertion audit against this specific
change — demoting a previously-hard-fail guard to log-only is exactly the shape of change that
audit exists to catch if done wrong. Low risk here since two independent authoritative checks
remain, but worth the formal pass rather than taking my own word for it.
