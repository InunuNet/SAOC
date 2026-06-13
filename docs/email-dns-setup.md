# SAOC Email DNS Setup — SPF, DKIM, DMARC

**Purpose:** Ensure transactional emails (ticket confirmations, contact form replies) sent from `saoc.co.za` are delivered reliably to Gmail, Outlook, and other major providers — and not marked as spam.

**Who does this:** The person who manages the `saoc.co.za` DNS zone (likely on cPanel via the registrar or hosting provider).

---

## Why This Matters

Without SPF, DKIM, and DMARC:
- Ticket confirmation emails land in spam folders
- Gmail shows "via resend.com" in the sender, which looks unprofessional
- Phishing protection is absent — anyone can spoof `@saoc.co.za`

With these records in place, emails from the SAOC website will arrive in the inbox with a clean `From: SAOC <noreply@saoc.co.za>` header.

---

## Email Sender: Resend

The SAOC website uses **Resend** (`resend.com`) to send transactional emails. Resend requires three DNS records: an SPF entry, a DKIM key, and optionally a DMARC record.

---

## Step 1 — Add the Resend Domain in Resend Dashboard

1. Log in at [resend.com](https://resend.com) (Brad's account)
2. Go to **Domains → Add Domain**
3. Enter `saoc.co.za` and select the region closest to South Africa (EU or US East are the current options; EU recommended)
4. Resend will show you three DNS records to add — copy each one

The three records will look similar to the examples below. **Use the exact values Resend shows** — they include a unique DKIM selector key.

---

## Step 2 — Add DNS Records

Log in to the DNS panel for `saoc.co.za` (cPanel → Zone Editor, or the registrar's DNS manager).

### SPF Record

Tells receiving servers that Resend is allowed to send mail for `saoc.co.za`.

| Type | Name | Value |
|------|------|-------|
| TXT | `saoc.co.za` (or `@`) | `v=spf1 include:amazonses.com ~all` |

> Resend sends via Amazon SES infrastructure — the SPF include will be `include:amazonses.com`. Confirm the exact value in the Resend dashboard.

**If `saoc.co.za` already has an SPF record** (e.g. from cPanel mail): you must merge them — DNS only allows one SPF record per domain. Example merged record:

```
v=spf1 include:amazonses.com include:your-existing-host.com ~all
```

### DKIM Record

A cryptographic signature proving the email genuinely came from Resend on behalf of `saoc.co.za`.

| Type | Name | Value |
|------|------|-------|
| TXT | `resend._domainkey.saoc.co.za` | (long key string from Resend — copy exactly) |

The name and key value are unique to your Resend account. Copy them exactly from the Resend dashboard.

### DMARC Record

Instructs receiving servers what to do if an email fails SPF or DKIM. Start in monitoring mode (`p=none`) and tighten later.

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc.saoc.co.za` | `v=DMARC1; p=none; rua=mailto:brad@inunu.net` |

This record:
- Does nothing to failing emails yet (`p=none` = monitor only)
- Sends aggregate DMARC reports to `brad@inunu.net`
- After 2–4 weeks of monitoring with no legitimate failures, tighten to `p=quarantine` then `p=reject`

---

## Step 3 — Verify in Resend

After adding all three records:

1. Go back to **Resend → Domains → saoc.co.za**
2. Click **Verify** (Resend checks DNS propagation automatically)
3. All three records should turn green within 5–30 minutes (DNS propagation time)

If records show as unverified after 1 hour, double-check for typos in the Name field — the trailing `.saoc.co.za` is sometimes added automatically by the DNS panel, creating double-dotted names like `resend._domainkey.saoc.co.za.saoc.co.za`. If so, remove the trailing domain from the Name field.

---

## Step 4 — Update the Resend API in the SAOC Website

Once the domain is verified in Resend, update the environment variable:

```
RESEND_FROM_ADDRESS=SAOC <noreply@saoc.co.za>
```

This variable is set in:
- **Local development:** `.env.local`
- **Production (Vercel/Firebase):** environment variable settings in the hosting dashboard

The contact form and ticket confirmation emails will then send from `noreply@saoc.co.za`.

---

## Tightening DMARC (After Launch)

After the site has been live for 4+ weeks with no legitimate email failures:

1. Change `p=none` → `p=quarantine` (failing emails go to spam instead of inbox)
2. After another 2 weeks with no issues, change to `p=reject` (failing emails are bounced)

Final strict record:

```
v=DMARC1; p=reject; rua=mailto:brad@inunu.net; pct=100
```

---

## Testing

After DNS propagates, test by:

1. Using the contact form on the live site — check the confirmation email arrives in the inbox (not spam)
2. Running a mail test at [mail-tester.com](https://www.mail-tester.com) — send a test email to the address shown, check the score (aim for 9+/10)
3. Checking DMARC reports arrive at `brad@inunu.net` within 24 hours

---

## Summary Checklist

- [ ] Add `saoc.co.za` domain in Resend dashboard
- [ ] Add SPF TXT record to DNS (merge with existing SPF if present)
- [ ] Add DKIM TXT record to DNS (from Resend dashboard)
- [ ] Add DMARC TXT record to DNS (`p=none` to start)
- [ ] Verify domain in Resend — all three records green
- [ ] Update `RESEND_FROM_ADDRESS` env var in production
- [ ] Test contact form email delivery
- [ ] Tighten DMARC to `p=quarantine` after 4 weeks
- [ ] Tighten DMARC to `p=reject` after a further 2 weeks
