# SAOC Website — Launch Checklist

**Owner:** Brad (InunuNet)  
**Status:** Code complete. Awaiting Brad's accounts + DNS actions.

Use this as your sequential checklist from "code done" to "site live at saoc.co.za."

---

## 1. Prerequisites — Accounts

| Account | Status | Notes |
|---------|--------|-------|
| Firebase (InunuNet) | Existing | Blaze plan required for App Hosting |
| Sanity CMS | Existing | Project ID `26yfbug4`, dataset `production` |
| Resend (email) | Required | Sign up at resend.com; verify saoc.co.za domain |
| Domain registrar | Required | Transfer saoc.co.za away from current registrar |
| Stripe SA | Phase D2/D4 only | Required for ticketing buy flow — not needed for launch |

---

## 2. Environment Variables

### 2a. Local dev (`.env.local`)

Copy `.env.local.example` → `.env.local` and fill in all values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=          # Firebase console → Project Settings → Web app
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_ADMIN_PROJECT_ID=             # Service account JSON
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=            # Paste the full quoted string with literal \n chars

RESEND_API_KEY=re_...                  # Resend dashboard → API Keys
RESEND_FROM_ADDRESS=SAOC <noreply@saoc.co.za>

NEXT_PUBLIC_SANITY_PROJECT_ID=26yfbug4
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_READ_TOKEN=                 # Sanity → API → Tokens → viewer token
SANITY_API_TOKEN=                      # Sanity → API → Tokens → editor token (for seed script)
SANITY_WEBHOOK_SECRET=                 # Any random string ≥32 chars
SANITY_REVALIDATE_SECRET=              # Any random string ≥32 chars
```

### 2b. Firebase App Hosting secrets (production)

Server-only secrets go into Google Secret Manager, not `apphosting.yaml` (never commit secrets).

In the Firebase console → App Hosting → your backend → Environment:

| Secret name (SM) | Value |
|-----------------|-------|
| `FIREBASE_ADMIN_CLIENT_EMAIL` | From service account JSON |
| `FIREBASE_ADMIN_PRIVATE_KEY` | From service account JSON |
| `RESEND_API_KEY` | From Resend dashboard |
| `SANITY_API_READ_TOKEN` | Viewer token from Sanity |
| `SANITY_WEBHOOK_SECRET` | Same random string used in `.env.local` |
| `SANITY_REVALIDATE_SECRET` | Same random string used in `.env.local` |

Then update `apphosting.yaml` to reference them — add under `env:`:

```yaml
  - variable: FIREBASE_ADMIN_PROJECT_ID
    value: "your-project-id"   # safe to inline — not a secret
    availability:
      - RUNTIME
  - variable: FIREBASE_ADMIN_CLIENT_EMAIL
    secret: FIREBASE_ADMIN_CLIENT_EMAIL
    availability:
      - RUNTIME
  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: FIREBASE_ADMIN_PRIVATE_KEY
    availability:
      - RUNTIME
  - variable: RESEND_API_KEY
    secret: RESEND_API_KEY
    availability:
      - RUNTIME
  - variable: RESEND_FROM_ADDRESS
    value: "SAOC <noreply@saoc.co.za>"
    availability:
      - RUNTIME
  - variable: SANITY_API_READ_TOKEN
    secret: SANITY_API_READ_TOKEN
    availability:
      - BUILD
      - RUNTIME
  - variable: SANITY_WEBHOOK_SECRET
    secret: SANITY_WEBHOOK_SECRET
    availability:
      - RUNTIME
  - variable: SANITY_REVALIDATE_SECRET
    secret: SANITY_REVALIDATE_SECRET
    availability:
      - RUNTIME
```

---

## 3. Seed the Sanity CMS

The seed script populates all 21 societies, board members, events, shows, partners, and provinces.

```bash
# With .env.local filled in (SANITY_API_TOKEN must be the editor/write token):
pnpm seed
```

Expected output: upserted messages for each record. Safe to re-run — it uses `createOrReplace`.

After seeding, open `/studio` locally (or at your Firebase App Hosting URL) to verify data appears.

---

## 4. Configure Sanity Webhook (ISR Revalidation)

In Sanity → API → Webhooks → create new:

- **URL:** `https://saoc.co.za/api/sanity-revalidate`
- **Dataset:** `production`
- **Trigger on:** Create, Update, Delete
- **HTTP method:** POST
- **Secret:** same value as `SANITY_WEBHOOK_SECRET` in `.env.local`

This triggers Next.js ISR revalidation whenever Sanity content changes.

---

## 5. Firebase App Hosting — Connect Repository

1. Go to Firebase console → App Hosting → Create backend
2. Connect to GitHub repo `InunuNet/SAOC`
3. Branch: `main` (auto-deploy on push)
4. Region: `europe-west4` (Netherlands — closest to SA with App Hosting GA; see `documents/hosting-research-2026-06-13.md`)
5. Set backend environment secrets (step 2b above)
6. Wait for initial build to complete

---

## 6. DNS Cutover

### 6a. Transfer domain

Transfer `saoc.co.za` to your chosen registrar (Cloudflare Registrar recommended — free management, good DNS editor).

### 6b. Point to Firebase App Hosting

After App Hosting backend is created, Firebase will provide a custom domain setup flow:

1. Firebase console → App Hosting → your backend → Custom domains → Add domain
2. Enter `saoc.co.za` and `www.saoc.co.za`
3. Firebase provides the required DNS records (A/CNAME values — unique to your backend)
4. Add them at your registrar

### 6c. Email DNS records

Follow `docs/email-dns-setup.md` in full — SPF, DKIM, and DMARC are required before the contact form can send from `@saoc.co.za`.

Summary of what to add:
- **SPF:** TXT record on `saoc.co.za`
- **DKIM:** TXT record on `resend._domainkey.saoc.co.za` (Resend provides the value)
- **DMARC:** TXT record on `_dmarc.saoc.co.za`

---

## 7. Post-Launch Verification Checklist

Run these checks once the site is live at `saoc.co.za`:

### Pages
- [ ] `/` — Home page loads, hero section and featured content visible
- [ ] `/about` — About SAOC page loads
- [ ] `/societies` — All 21 societies listed
- [ ] `/societies/[any-slug]` — Individual society page loads
- [ ] `/events` — Events calendar loads
- [ ] `/national-show` — National Show page loads
- [ ] `/judging` — Judging page loads
- [ ] `/contact` — Contact form renders
- [ ] `/sponsors` — Sponsors page loads
- [ ] `/studio` — Sanity Studio loads (admin access only)

### Functional
- [ ] Submit contact form → Resend delivers email to `info@saoc.co.za`
- [ ] Edit a society in `/studio` → page revalidates within 60 seconds
- [ ] Check browser console for errors on each main page

### Performance
- [ ] Run Lighthouse on `/` — target 90+ Performance, 100 Accessibility
- [ ] Verify Google Search Console shows no crawl errors (set up GSC if not already)
- [ ] Submit sitemap to Google: `https://search.google.com/search-console` → Sitemaps → add `https://saoc.co.za/sitemap.xml`

---

## 8. Secretary Handover

Before handing over CMS access to the SAOC secretary:

1. Create a Sanity user account for them (Sanity → Settings → Members → Invite)
2. Assign role: `Editor` (can publish; cannot delete document types)
3. Walk through `docs/secretary-cms-guide.md` with them
4. Test: have them add a test event, confirm it appears on the site

---

## 9. Phase D (Ticketing) — When Ready

Phase D2 (Stripe SA payment gateway) and D4 (ticket buy flow) are implemented but need a live Stripe SA account:

1. Sign up at stripe.com/nz (Stripe SA is under NZ/AU entity)
2. Complete business verification with SAOC non-profit documentation
3. Add Stripe keys to Secret Manager: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
4. Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `apphosting.yaml` env (safe to inline)
5. Enable the buy-flow pages (currently behind a feature flag — ask InunuNet)

---

## Blocked Items (Not Required for Launch)

| Item | Blocker | Notes |
|------|---------|-------|
| Ticketing (D2/D4) | Stripe SA account | See Phase D above |
| National Show Archive page | Design handoff | Scaffold in place |
| Upcoming Show page | Date/venue confirmation | Scaffold in place |
| Header/Footer components | Design handoff | Generic layout in place |
