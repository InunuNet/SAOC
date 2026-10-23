# Sponsor enquiry form

Mission `sponsor-enquiry-form`, M1/F1. Brad (via SAOC): "Become a sponsor. That button needs to be a button to get the necessary information from the company or person who's interested in becoming a sponsor. It needs to be a form."

The single "Talk to us about sponsorship" button on each sponsors page (SAOC `/sponsors`, NOS `/sponsors`) sits in the page hero under the lede, in every state, and is a plain `href="#enquire"` anchor (NOS Design D4, Amendment 3; the NOS empty-state card keeps its message but has no button of its own, and the SAOC page's separate CTA block has no button) that jump to an inline section on the same page. There is no separate route and no host-routing change: each existing sponsors page renders `SponsorEnquirySection` for its own site, so a host serves only its own form by construction. `SponsorEnquiryFocus` adds smooth scroll (instant under `prefers-reduced-motion`), keeps `#enquire` in the URL and focuses the section heading; the anchor works without JavaScript.

## Flow

1. `components/sponsors/SponsorEnquiryForm.tsx` validates with the same rules as the API (`lib/sponsor-enquiry.ts`), then posts to `POST /api/sponsors/enquire`. On success the form is replaced in place by the thank-you and focus moves to its heading.
2. `app/api/sponsors/enquire/route.ts` derives the site from the Host (`siteForHost`), never from the body, and hands everything to the pure `lib/sponsor-enquiry-handler.ts`.
3. The handler order is: rate limit, honeypot, validate, write, then non-blocking notifications. A failed notification is logged (operation and exception type only) and never turns a stored enquiry into an error.

## Firestore: `sponsorEnquiries`

Auto id. Fields: `contactName`, `organisation` (or null), `email` (lowercased), `phone` (or null), `website` (or null), `level` (`gold` / `silver` / `bronze` / `conservation-partner` / `donor`, or null), `message`, `consent` (literal `true`), `source` (`saoc` or `nos`, from the Host), `status` (`new`), `submittedAt` (Timestamp). Optionals are coalesced to null, never undefined (docs/firestore-undefined-write-safety.md). `_hp` is never stored. Admin SDK only; there is no `firestore.rules` file and no index, because the feature runs no queries.

There is no admin listing page for `sponsorEnquiries`: enquiries are read in the Firebase console until one is requested.

## Spam and POPIA

`/api/contact` has neither consent nor a server-side spam control, so mirroring it would break spec 2.9. This form uses the newsletter pattern instead: a hidden `_hp` honeypot that the client sends and the server answers with a silent 201 and no write, and a per-IP rate limit of 5 attempts per hour (the sixth is a 429 with `Retry-After`, consumed before the honeypot and validation; the IP is the second-to-last `X-Forwarded-For` hop). A required consent checkbox must be the literal `true`, beside a link to `/privacy`. CAPTCHA is not added (open decision D1).

## Emails

Each is independently wrapped in `deliverConfirmationEmailAfterCommit`. The subjects are fixed and carry no user text.

- Acknowledgement to the submitter: `We received your sponsorship enquiry — SAOC` (`emails/SponsorEnquiryConfirmation.tsx`).
- Admin notice: `New sponsorship enquiry — SAOC` (`emails/SponsorEnquiryAdminNotice.tsx`), to the `ADMIN_EMAIL_ALLOWLIST` recipients.

Recipients: `lib/sponsor-enquiry-admin-notice.ts` imports `getAdminNotifyRecipients` from `lib/admin-notify-recipients.ts`, the neutral alias that landed with PR #57 (it re-exports `getVendorAdminNotifyRecipients`). That single import is the only place that depends on it.

## Copy gaps

All held in `lib/sponsor-enquiry-copy.ts`, each marked `PENDING-COMMITTEE-COPY`, to be sent to Lee-Ann. Unsourced prose renders on the beta preview only, marked; a public build omits it.

- G1 the section heading, "Sponsorship enquiry". A functional label, rendered always.
- G2 the introduction under the heading. No wording exists; the beta preview shows a bracketed stand-in with the marker, a public build shows nothing.
- G3 the POPIA consent label and its privacy-link text. Functional, so rendered in both modes; the marker is beta-only. Needs committee approval.
- G4 labels with no existing equivalent: "Organisation or company (optional)", "Phone number (optional)", "Sponsorship level (optional)".
- G6 the NOS success body. The SAOC string names the SAOC secretariat, so NOS has no wording yet; the beta preview shows a bracketed stand-in with the marker, a public build shows the heading alone.
- G5 the acknowledgement and admin email wording. An email cannot be beta-only, so it is always sent.

Reused verbatim from existing copy: the CTA label, "Name", "Email address", "Message", "Website (optional)", the thank-you heading and body, and the validation texts. The level select's empty first option is "Choose a level" (SAOC ruling, Amendment 4; value `""`, stored as null). The five levels are Lee-Ann's Website Development Specification V3, line 484; the level is optional.

## Open decisions

- D1 CAPTCHA: a provider is a Brad/INUNU decision.
- D2 Copy gaps G1 to G5 need committee wording.
- D3 `/api/contact` and the other public forms lack consent and rate limiting; out of scope.
- D4 resolved by Amendment 3: one hero CTA in every state and on both hosts.
