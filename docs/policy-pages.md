# Policy Pages — Privacy, Terms, and Refunds

**Created:** 2026-08-19  
**Status:** Live (contract F1 shipped)  
**Requirement:** Payment gateway merchant account approval

---

## Why These Pages Exist

A payment gateway merchant account requires the live site to publish three legally-reviewable pages before granting approval. Without a merchant account, no ticket sales can proceed. This feature adds `/privacy`, `/terms`, and `/refunds` as publicly reviewable endpoints that gateway providers examine during due diligence.

The requirement is common across South African payment providers — it is not provider-specific. Ozow confirmed this on a trial application (2026-08-19) and validated the final pages.

---

## What Each Page Covers

### Privacy Policy (`/privacy`)

**Source:** AI-drafted; ready for SAOC legal review.

Discloses:

- **Personal information collected** — contact form (name, email, message); ticket checkout (name, email, phone, country, province, town); vendor applications (business details, regulatory numbers)
- **Recipients** — the payment gateway (provider-neutral wording; currently PayFast sandbox); Resend (email delivery); Firebase and Google Cloud (Firestore, Auth, Cloud Storage)
- **Retention** — held as long as needed for the stated purpose and to meet legal/accounting/record-keeping obligations
- **Cookies/analytics** — none currently in use
- **POPIA rights** — acknowledges South African access/correction/deletion rights
- **Information Officer** — lists `secretary@saoc.co.za` as the contact (see "Open questions" below)
- **Information Regulator complaint route** — links to inforegulator.org.za

**Critical fact checked:** The privacy policy **no longer contains the false claim** that data "is not shared with third parties." That claim was removed, and third-party recipients are now explicitly named.

### Terms of Use (`/terms`)

**Source:** Existing site-use sections retained; new ticket-conditions section added.

Retains unchanged:

- Use of this site (lawful purposes only)
- Content ownership (SAOC and member societies, no republishing without permission)

Adds:

- **Conditions of sale — tickets and admission** — sets out ticket purchase terms:
  - Tickets are a contract for admission; issued to named attendee; may be checked against ID at the door
  - **18+ restriction:** Sunset Cocktails explicitly restricted to 18+ with age-check at door
  - **Limited capacity caveat:** Workshops and field trips have capacity limits; overbooking handled per activity listing
  - Refunds governed by `/refunds` policy

### Refund & Cancellation Policy (`/refunds`)

**Source:** Structurally complete; content on figures intentionally omitted.

Covers:

- **Refund scenarios** — where approved, issued to original payment method
- **Cancellation** — SAOC-initiated cancellations notify ticket holders; refund windows/conditions pending council confirmation
- **Exceptional circumstances** — medical/bereavement requests handled case-by-case
- **How to request** — links to contact form with cross-references to Terms and Privacy

**Deliberately omitted:**

- **No refund windows** — e.g., "refund within 14 days"
- **No percentages** — e.g., "80% refund if cancelled 7+ days before"
- **No specific deadlines** — e.g., "refund cutoff 3 days before the event"

SAOC has not yet decided these terms; the contract forbids inventing them. Contract assertion POLICY-10 actively blocks any digit+unit pattern (`\d+ (day|week|%) etc.`) to prevent accidental fabrication.

---

## Two Deliberate Gaps

### Gap 1: Draft-Pending-Legal-Review Notice

All three pages carry a visible (not hidden/sr-only) box stating: _"Draft pending legal review. This page has been drafted with AI assistance and has not yet been reviewed by a qualified legal professional. It does not constitute legal advice and should not be relied upon as SAOC's final policy until formal review is complete."_

These are **drafts for the council to have professionally reviewed, not settled legal text**. The notice discloses that:

- They were AI-drafted (full transparency)
- They are not legal advice
- They require council-supplied legal review before being final

This is transparent and honest, and meets the gateway requirement that pages exist and be reviewable — it does not claim they are final policy.

### Gap 2: Refund Figures Not Supplied

The refund page deliberately contains **no figures whatsoever** — no days, percentages, or deadlines. This is correct:

- The council decides refund terms (timelines, conditions, amounts)
- Publishing figures on their behalf would be making up policy
- Inventing a commitment about people's money is unacceptable

**What must happen to close this gap:**

1. SAOC council decides refund policy (e.g., "full refund up to 30 days before; 50% after")
2. Provide those terms to the developer
3. Update `/refunds` with the agreed figures
4. Re-run the contract gate (`POLICY-10`) to confirm the page still carries no fabricated figures (it will pass when the figures are real council decisions)

The contract gate will continue to enforce that no numbers appear on the page until real numbers are supplied. Until then, the page correctly says "pending council confirmation."

---

## Open Question: Information Officer Designation

The privacy policy names `secretary@saoc.co.za` as Information Officer — this follows project convention (also used in `app/layout.tsx` JSON-LD and the constitution page).

**However, under POPIA:**

- The Information Officer defaults to the head of the organisation
- Must be formally designated
- Must be registered with the Information Regulator

The repo contains no evidence that SAOC has designated an Information Officer or registered them. This is **an open question for the council**, not an oversight:

- Is the secretary the designated Information Officer, or should it be the chair/CEO?
- Has that person been registered with the Information Regulator?

**Related fact:** `info@saoc.co.za` is the project's established authorised single inbox (`docs/email-reply-to.md:18`) where all contact-form and transactional-email replies land. It is NOT the same as the POPIA Information Officer contact, though they could route to the same person.

Until the council confirms the designation, `secretary@saoc.co.za` remains the best available contact for data-subject requests and represents the pre-existing project convention. This should be revisited and formalised before the site goes live.

---

## How to Maintain

### When the Council Supplies Real Refund Terms

1. Receive the council's refund policy in writing (e.g., email, board minutes)
2. Note the agreed windows, percentages, and cancellation deadlines
3. Edit `app/(marketing)/refunds/page.tsx`:
   - Add the figures to the "Refund scenarios" and "Cancellation" sections
   - Keep the "Terms pending confirmation" section (update or remove as needed)
4. Run the contract gate to verify it passes:
   ```bash
   pnpm contracts run policy-pages
   ```
   (POLICY-10 will pass because the figures now come from council decisions, not fabrication)
5. Commit with a message like: `chore(policy-pages): add council-approved refund terms`

### When the Council Arranges Legal Review

1. Provide all three page URLs to SAOC's legal counsel
2. Collect their feedback (markup/comments on the prose, addition of council-specific terms)
3. Update the pages with approved changes
4. Remove or update the "Draft pending legal review" notice once counsel approves
5. Commit with: `chore(policy-pages): apply legal counsel review; remove draft notice`

### If the Information Officer Designation Changes

Update the email address on `/privacy` to reflect the council's formal designation. This is a one-line change in `app/(marketing)/privacy/page.tsx`.

### Content Updates (Providing Gateway Providers Are Satisfied)

The three pages can be edited like any other static content — no rebuild needed. Changes publish immediately via next-cache revalidation. Test on `dev` before propagating to production.

---

## Footer Links

The footer (component `Footer.tsx`, visible on all marketing pages) now includes three new legal links in the bottom bar:

| Link | Destination |
|------|-------------|
| Privacy | `/privacy` |
| Terms | `/terms` |
| Refunds | `/refunds` |

Plus existing links:
| Link | Destination |
|------|-------------|
| Constitution | `/constitution` |
| Media kit | `/media-kit` |

The footer is a shared layout component (`app/(marketing)/layout.tsx`) so these links appear site-wide on all public marketing pages.

---

## Contract & Verification

**Contract:** `contracts/contract-policy-pages.yaml`

**Key Assertions:**

| ID | What it checks |
|----|----------------|
| POLICY-01 to 03 | Footer links to all three pages from multiple routes (site-wide proof) |
| POLICY-04 to 06 | Draft-pending-legal-review notice present and visible on all three pages |
| POLICY-07 | `/privacy` no longer false; third-party recipients named |
| POLICY-08 | `/terms` ticket conditions present (18+, limited capacity) |
| POLICY-09 | `/refunds` structurally complete with pending-confirmation disclosure |
| POLICY-10 | `/refunds` contains NO fabricated figures (digit+unit enforcement) |
| POLICY-11 | Footer not restructured (pre-existing links preserved) |
| POLICY-12 | `/terms` pre-existing sections retained (not replaced) |

**Run verification:**

```bash
pnpm contracts run policy-pages
# or to test after manual changes:
pnpm dev  # in one terminal
# in another:
pnpm contracts run policy-pages --target=policy-pages
```

All 14 assertions must pass before a change is considered complete.
