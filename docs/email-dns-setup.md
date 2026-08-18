# SAOC Email DNS Setup — Resend Two-Subdomain Scheme

**Status:** Partially deployed. Both subdomains configured in code; DNS records not yet created.

**Purpose:** Enable reliable delivery of transactional emails (ticket confirmations, contact/vendor form replies) via Resend using separate subdomains to isolate deliverability problems.

**Who does this:** The person with write access to the `saoc.co.za` DNS zone (hosted at `ns1.inunu.co.za` / `ns2.inunu.co.za`). Zone-editing access is not documented in this repo — confirm access separately before starting.

---

## Architecture: Why Two Subdomains?

The SAOC website sends two categories of email via Resend:

| Category | Subdomain | Sender Address | Usage |
|----------|-----------|-----------------|-------|
| Ticket confirmations | `tickets.saoc.co.za` | `RESEND_FROM_TICKETS` | Order confirmations, payment receipts |
| Contact/vendor forms | `forms.saoc.co.za` | `RESEND_FROM_FORMS` | Contact form replies, vendor submission acks |

**Why split them?** A deliverability problem with one category (e.g. one type of email accidentally marked as spam, damaging reputation) cannot poison the other. SPF/DKIM/DMARC failure on `tickets.saoc.co.za` will not prevent `forms.saoc.co.za` from reaching inboxes.

**Code reference:** `lib/email.ts` exports `sendEmail(to, from, subject, html)` where `from` is explicitly passed by the caller — no single hardcoded sender address.

---

## Current Status: What Is Done / What Remains

### ✅ Done
- Resend account created and configured
- `RESEND_API_KEY` provisioned and stored in Secret Manager (send-only)
- `RESEND_FROM_TICKETS` and `RESEND_FROM_FORMS` env vars wired in `apphosting.yaml`
- Nameserver migration complete: `saoc.co.za` now served by `ns1.inunu.co.za` / `ns2.inunu.co.za` (SOA serial 2026081804)

### ⚠️ Blocked
- **Neither subdomain is verified in Resend**
- **DNS records for both subdomains do not exist** in the served zone (confirmed authoritatively against ns1.inunu.co.za)
- As a result: ticket confirmation emails fail in production with `Resend send failed: The tickets.saoc.co.za domain is not verified.` (observed 2026-08-18 in Cloud Logging)
  - Note: The order is correctly marked `paid` — email failure is isolated and does not roll back the transaction. Consequence is silent non-delivery, not a broken payment flow.

---

## Remaining Work: Step-by-Step

### Step 1 — Add Both Subdomains in Resend Dashboard

1. Log in at [resend.com](https://resend.com) (Brad's account)
2. Go to **Domains → Add Domain**
3. Add `tickets.saoc.co.za`:
   - Select EU region (closest to South Africa)
   - Resend will generate SPF, DKIM, and DMARC record values — **copy each one**
4. Repeat for `forms.saoc.co.za`

**Critical:** The Resend API key in Secret Manager is send-only and cannot verify domains programmatically. You must manually add domains in the dashboard above.

### Step 2 — Capture Generated SPF/DKIM Values

Resend will show you three DNS records per subdomain:

- **SPF TXT record** — Name field + Value
- **DKIM TXT record** — Name field (`resend._domainkey.<subdomain>`) + Value (unique key)
- **DMARC TXT record** (optional) — Name field + Value

**Do not invent or use placeholder values.** Each domain's Resend account generates unique DKIM keys. Copy the exact values Resend displays.

### Step 3 — Add DNS Records to Zone

Log in to your `saoc.co.za` DNS zone manager (requires access to `ns1.inunu.co.za` zone; confirm you have this access).

For **each subdomain** (`tickets.saoc.co.za` and `forms.saoc.co.za`):

1. **SPF TXT record:**
   - Type: TXT
   - Name: (as shown by Resend, typically `tickets` or `forms` or the full subdomain)
   - Value: (from Resend — contains `include:resend.com` or similar)

2. **DKIM TXT record:**
   - Type: TXT
   - Name: (from Resend — typically `resend._domainkey.tickets` or `resend._domainkey.forms`)
   - Value: (long key string from Resend — copy exactly, character for character)

3. **DMARC TXT record** (recommended but optional):
   - Type: TXT
   - Name: `_dmarc.tickets` (or `_dmarc.forms`)
   - Value: `v=DMARC1; p=none; rua=mailto:brad@inunu.net` (monitoring mode; tighten after launch)

**Known trap:** The DNS panel may auto-append the zone name (e.g., `.saoc.co.za`) to the Name field. This creates double-dotted names like `resend._domainkey.tickets.saoc.co.za.saoc.co.za`, which are incorrect. Verify the final Name field does not have a duplicate trailing domain before saving.

### Step 4 — Verify in Resend

1. Go back to **Resend → Domains**
2. For each subdomain, click **Verify**
3. Resend checks DNS propagation automatically
4. Records should turn green within 5–30 minutes (DNS propagation time)

If records remain unverified after 1 hour:
- Double-check zone records match exactly what Resend shows (including case and spacing)
- Verify the Name field does not have a double-dotted suffix
- Run `dig resend._domainkey.tickets.saoc.co.za` against `ns1.inunu.co.za` to confirm your DNS panel wrote the record correctly

---

## Legacy Apex Domain (`saoc.co.za`)

**Note:** The apex domain `saoc.co.za` still carries legacy mail configuration from the old cPanel host:
- SPF TXT: `v=spf1 ip4:164.160.89.117 +a +mx ~all` (IP is from old host, now dead)
- MX: `0 saoc.co.za` (points to itself)

**Action:** This is a separate cleanup task. Do not include in the subdomain verification work. After subdomains are verified, consider whether to clean up the legacy records or keep them for backward compatibility.

---

## After Verification: Code Takes Over

Once both subdomains are verified in Resend, no further action is needed in code. The `lib/email.ts` implementation already references `RESEND_FROM_TICKETS` and `RESEND_FROM_FORMS`, which are wired in `apphosting.yaml`. The next ticket or contact form submission will send via the correct verified domain.

---

## Testing Deliverability

After domain verification:

1. **Live test:** Submit a contact form or place a ticket purchase on the live site. Check that the confirmation email arrives in the inbox (not spam).
2. **Mail tester:** Send a test email to [mail-tester.com](https://www.mail-tester.com), check the SPF/DKIM/DMARC score (aim for 9+/10).
3. **DMARC monitoring:** Aggregate DMARC reports will arrive at `brad@inunu.net` within 24 hours of the first verified email.

---

## Tightening DMARC (Post-Launch)

After live email traffic has run for 4+ weeks with no legitimate failures:

1. Change DMARC policy from `p=none` (monitor) → `p=quarantine` (failing emails go to spam)
2. After another 2 weeks with no issues, tighten to `p=reject` (failing emails bounced at source)

Final strict policy:
```
v=DMARC1; p=reject; rua=mailto:brad@inunu.net; pct=100
```

---

## Summary Checklist

- [ ] Confirm DNS zone-edit access to `ns1.inunu.co.za`
- [ ] Add `tickets.saoc.co.za` in Resend dashboard → capture SPF/DKIM/DMARC values
- [ ] Add `forms.saoc.co.za` in Resend dashboard → capture SPF/DKIM/DMARC values
- [ ] Write SPF TXT record for `tickets.saoc.co.za` to zone
- [ ] Write DKIM TXT record for `tickets.saoc.co.za` to zone
- [ ] Write DMARC TXT record for `tickets.saoc.co.za` to zone (if desired)
- [ ] Write SPF TXT record for `forms.saoc.co.za` to zone
- [ ] Write DKIM TXT record for `forms.saoc.co.za` to zone
- [ ] Write DMARC TXT record for `forms.saoc.co.za` to zone (if desired)
- [ ] Verify both domains in Resend — all records green
- [ ] Test ticket/contact form email delivery
- [ ] (Post-launch, after 4 weeks) Tighten DMARC policies to `p=quarantine`
- [ ] (Post-launch, after 6 weeks) Tighten DMARC policies to `p=reject`
