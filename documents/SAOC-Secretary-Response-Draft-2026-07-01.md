DRAFT — for Brad's review before sending from brad@inunu.net
(Reconstructed 2026-07-01. Source facts: SAOC_Website_Proposal_28-05-2026.docx,
Inunu - Additional info request.docx, project backlog/build state as of 2026-06-30.)

---

Subject: RE: Additional information request — SAOC Website & Ticketing Proposal

Dear Lee-Ann,

Thank you for these questions — they're exactly the right things to check before a Council decision, and I'm glad to clarify each one.

**Website security**

The site is built on Next.js and hosted on Google Firebase App Hosting rather than a traditional server, which removes most of the attack surface a platform like WordPress carries (no server OS to patch, no plugin ecosystem to exploit). Specifically:

- Administrator access to the content editor (Sanity Studio) is via Google account sign-in — there's no separate admin password to be guessed or leaked, and access is granted per email address, so it can be revoked instantly if a committee member changes.
- All visitor and ticket-purchaser data is stored in Firestore, and the browser never talks to the database directly at all — every read and write goes through our own server-side code, using credentials that only exist on the server. There's no public API surface for that data to be reached from outside our application.
- The whole site is served over HTTPS by default; there's no unencrypted path for any data in transit.
- Security updates: because there are no third-party plugins, the only components requiring updates are the framework and a handful of well-maintained libraries (Next.js, the CMS SDK, the payment and email SDKs), which we review and upgrade deliberately rather than being forced into constant reactive patching. The hosting platform itself (Firebase App Hosting) is managed by Google — OS-level and infrastructure patching is handled on their side, not ours.
- Malware/brute-force/data breach protection: there's no admin login form exposed to the public internet to brute-force (that's Google's own OAuth login), no file-upload or plugin surface for malware to hide in, and all form submissions are validated and sanitised server-side before they ever reach the database. Firebase's global infrastructure also provides DDoS mitigation as standard.
- Spam: unlike WordPress, the site has no comment sections, forums, or other open public-submission areas that spam bots typically target — the only public input point is the contact form, and all submissions are validated server-side before they ever reach the database.

**Ticketing and payment security**

- Card and payment details never touch our servers or Firestore at all. The checkout hands off to the payment gateway's own secure hosted payment page, and only a transaction reference and status (paid/pending/refunded) come back to us for record-keeping.
- Because of that, the site itself carries no PCI-DSS scope beyond the lowest tier (typically SAQ-A for a hosted checkout like this) — full card-data compliance sits with the gateway, which is independently certified PCI DSS Level 1, not with the Council.
- To answer directly: no payment information is stored on the website. It is handled entirely by the payment gateway.
- On the gateway itself: Yoco has confirmed they are temporarily not activating new online payment accounts (waitlisted, no ETA as of our last check). Given that, we recommend **PayFast** as the gateway for the 2027 Show — it's a well-established South African provider, supports both card and Instant EFT, has no monthly or setup fees (3.2% + R2.00 per card transaction, 2.0% on Instant EFT), and drops into the same checkout architecture we've already built. One thing worth flagging early: PayFast requires FICA verification for a non-profit account before it can go live — proof of registration (NPO/PBO/Section 21 documentation), proof of physical address, and a bank-issued proof of account — so it's worth the Council starting to gather those documents in parallel with the evaluation.
- On the two alternatives you named: **Paystack** and **Owzo** could also be integrated — we haven't done the same documentation-verified deep dive on either yet that we have on PayFast, so we'd want to do that groundwork before committing either way, but neither is a blocker if the Council has a preference or an existing relationship with one of them.

**Refunds and cancellations**

The ticket admin dashboard gives administrators a full view of every sale, with status tracking (reserved / paid / cancelled / checked-in). Actioning a refund itself — moving money back to a customer's card — has to happen through the payment gateway's own merchant dashboard, which is standard practice for any card-processing setup (it's the gateway that holds the funds and the compliance obligation, not the website). Administrators can initiate full or partial refunds there, both full and partial amounts are supported. Reflecting that refund status back into our own ticket dashboard isn't automatic out of the box — it requires us to build a small integration against the gateway's refund records, which is a modest, well-defined piece of work rather than a gap in the platform. If the Council would prefer refunds to be triggerable from inside our admin dashboard directly (rather than the gateway's), that's a small additional scope item we can quote.

**Ticketing platform costs**

Splitting the fixed R12,375 ex VAT Phase 1 price by engineering effort:

| Component | Approx. cost (ex VAT) | Approx. hours |
|---|---|---|
| Website foundation — design, 8 pages, CMS, admin training, committee/Secretary review cycles | ~R7,425 | ~9 hrs |
| Ticketing platform — payment integration, tiered ticket types, checkout, capacity tracking, confirmation emails, admin dashboard, door check-in tool, pre-show dry run | ~R4,950 | ~6 hrs |

Compared to a third-party platform like Quicket: their published fee structure charges organisers roughly 4.9% ex VAT per paid ticket (2.4% commission, reduced to 2% for registered non-profits, plus 2.5% payment processing), on top of a R7.50 per-ticket booking fee usually passed on to the buyer — every show, indefinitely — and the attendee/sales data lives on their platform rather than the Council's own systems. As an illustration only (not a National Show projection): on 500 paid tickets at R120 each, that ongoing organiser cut alone would be roughly R2,940 ex VAT per show, recurring every three years. Our approach is the reverse — a single once-off development cost of roughly R4,950, after which the only ongoing cost is the payment gateway's own transaction fee (2–3.2%, no separate platform fee at all), and the Council owns the ticketing system outright for the 2027 Show and every National Show after it, at no repeat licensing cost. On that illustrative volume, Quicket's fees alone would repay our build cost in around two shows and keep recurring after that.

**Future membership platform**

The list below reflects our current thinking on what a membership platform could include, based on the functionality you listed — it is indicative, not a firm scope. Before this phase is quoted or built, we'd want a proper scoping session with the Council/committee to confirm what's actually needed, rather than building against our own assumptions. With that caveat:

| Requirement | Likely included, pending committee scoping |
|---|---|
| Online membership applications | Yes — public application form, reviewed and approved by an administrator |
| Member login | Yes — Firebase Authentication, already scaffolded in the current build, would be wired to a member-facing login |
| Online renewals | Yes |
| Recurring payments | Yes — PayFast (our recommended gateway) supports subscription billing and tokenised card-on-file charging, a good fit for annual membership renewals |
| Society allocation | Yes — each member's profile links to their affiliated society, using the society records already in the system |
| Member profile management | Yes — self-service profile editing once logged in |
| Committee administration | Yes — an admin view for reviewing applications, managing member records and payment status |
| Member communications | Yes — segmented email communications to members via the same email system already used for ticketing confirmations |

**Journal archive**

To be clear, this is a future feature idea and is not in scope for the initial phase of this project. It refers to digitising back issues of the Council's existing "Orchids South Africa" yearbook so members could browse and search past editions online, rather than them only existing as physical or scattered PDF copies. To answer the specific questions: searchability (by year, edition, and keyword) and PDF downloads of each yearbook are both things we'd expect to build in, since they're the main point of digitising an archive at all. Whether access is member-only or open to the public is a genuine open question and entirely the Council's call — we'd suggest defaulting to member-only as a membership benefit unless the Council prefers otherwise. All of this would be confirmed in a proper scoping discussion before any specific approach is committed to.

**Judges platform**

Like the membership platform and journal archive above, this is a future feature idea and is not in scope for the initial phase — but it's something we've kept in mind while structuring the site, so it can be scaffolded in later without rework. It's worth separating two distinct things your question touches on:

- **An awards/winners gallery** — a public-facing record of grand champions, category winners and photographs from each National Show. This is a natural extension of data the current site already models (each show record can store its winners and gallery images) and is closer to a content feature than a platform build.
- **A judges' platform proper** — secure login for accredited judges, training and reference resources, examination material, structured grading and certification records, and document management. This is a distinct, more academic system (judge accreditation and training, not public-facing awards) and would need its own scoping discussion with the Council before it's designed or costed.

We wouldn't want to conflate the two — a public awards gallery and a judges' training/certification system serve different audiences and have very different scope.

**Content management**

The CMS (Sanity Studio) is a structured, form-based editor — the Secretary fills in named fields (a title, a date, a description, an image) rather than working with a visual page builder or raw HTML. That's a deliberate difference from WordPress: because the page layout and design are fixed in the code rather than editable by the user, it isn't possible to accidentally break a page's structure while updating its content — one of the most common WordPress support headaches. There's also no plugin ecosystem to install, licence, or keep patched, which removes an entire category of ongoing WordPress maintenance and risk.

Training and documentation are provided: a written step-by-step guide (covering login, every content type on the site, image upload guidance, and troubleshooting) plus a live walkthrough session with the Secretary and any other designated administrators.

**Future scalability**

Next.js and React form the most widely used modern web stack today, with one of the largest developer communities and job markets of any web framework — this is not a niche or proprietary choice. Because the build has no plugin dependency chain (unlike WordPress, which accumulates plugin-version debt over years), its only dependencies are the framework itself and a small number of independently upgradable libraries. The full source code sits in version control with complete history, so any competent web developer — not just Inunu Net — can read, understand and extend it. Yes: another developer would be able to maintain and extend this website if the Council ever needed that.

**Ownership**

On project completion, the Council owns everything outright:

- **Source code** — held in a GitHub repository, which can be transferred to a Council-controlled GitHub account at completion or on request.
- **Hosting** — the Firebase project can be set up under (or transferred to) a Google account the Council controls, so there is no dependency on Inunu Net's own Google account for ownership purposes.
- **Domain** — the Council remains the registered owner of saoc.co.za; the registrant details stay the Council's throughout. As set out in our proposal, we'd ask for the domain to be moved to Inunu Net's domains.co.za account so we can control the name server records directly — this lets us make DNS or emergency changes immediately without waiting on a third party. Ownership doesn't change, only who can action name server changes day-to-day. If the Council would prefer to keep the domain at its current registrar, that's not a deal-breaker — we'd just need whoever manages it there to be responsive when name server changes are needed.
- **Two separate hosting accounts** — it's worth clarifying that "hosting" here actually means two distinct things: a cPanel account with Inunu Net, used for the domain's email addresses/accounts and for managing DNS records; and a separate Google Firebase project, which hosts the website itself and its database (Firestore). The Council should be aware of both, not just one.
- **Google accounts, Firebase project, analytics** — recommend these are created under a Google account the Council itself controls from the outset (we can set this up together at kick-off), precisely so ownership is unambiguous from day one rather than needing a later handover. One practical note: although we expect the site's traffic to stay within Firebase's free-tier limits, Firebase App Hosting requires the project to be on Google's "Blaze" (pay-as-you-go) plan, which means a payment method must be added to the account even though we don't expect any actual charges at current traffic levels.
- No licensing fees, no vendor lock-in — all code, content, and design assets belong to the Council.

**Support**

30 days of post-launch support (bug fixes and minor adjustments) are included in the Phase 1 price. Beyond that, the monthly hosting fee already includes light ongoing assistance — things like creating email addresses, checking issues, and small requests — so day-to-day contact with us isn't something the Council needs to worry will incur a cost. Larger, ad hoc changes and new work are billed at our standard hourly rate as needed, with no retainer or subscription requirement — the Council only pays for substantial work it actually asks for.

**Non-renewal of annual costs**

There are no premium plugin licences in this build (that's a WordPress-specific cost that doesn't apply here) — the only recurring costs are domain renewal (R172.50/year) and web hosting and email (R185.15/month), both billed by Inunu Net. It's worth being clear that the monthly hosting fee covers more than just email — it includes management of the domain's DNS and name server records, which is what determines how saoc.co.za resolves and where it points, including to the website itself. If the Council chose not to renew:

- **Domain non-renewal** — saoc.co.za would eventually lapse and risk being lost to another registrant altogether, taking the website and all @saoc.co.za email addresses down with it.
- **Hosting non-renewal** — DNS and name server management, and @saoc.co.za email, would need to be handed over to and actively managed by another provider. Because DNS is what points the domain at the website, this isn't limited to email service stopping — without it being properly managed somewhere, saoc.co.za may stop resolving to the site at all.
- **Historical data** — ticket sales and other records live in the Council-owned Firebase project, independent of the domain/hosting fee, so that underlying data isn't lost by a hosting lapse — but the site being reachable at saoc.co.za depends on DNS being actively managed by someone.
- **Membership records and journal archive** — neither exists yet in Phase 1 (both are the future-phase ideas discussed above), so there's nothing to lose today. If and when either is built, we'd design them the same way — living in the Council-owned Firebase project, independent of the Inunu Net hosting/domain fee — for exactly the same reason.

Thank you again for the thorough questions — please let me know if any of the Council members would like a short call to talk through any of this before the evaluation concludes.

Kind regards,
Brad-Lee Dauth
Director · Inunu Net Technologies
brad@inunu.net · +27 82 456 5424

---

REVIEWER NOTES (delete before sending):
- Ticketing cost split (R7,425 / R4,950, 60/40 website-heavy) is an engineering estimate for this letter, not a contractual line-item split — reasoning: website foundation absorbs committee/Secretary review cycles, ticketing is scoped engineering.
- Payment gateway recommendation is PayFast (Yoco confirmed waitlisted), now verified against PayFast's actual developer docs (developers.payfast.co.za, payfast.io/fees, payfast.io/features/merchant-refund, support.payfast.help). Internal build currently has a Stripe-shaped ticket schema (`stripePaymentIntentId` field) from earlier D2/D4 exploration — this is an internal implementation detail only, doesn't need to be mentioned to the client, but flag if you want the actual integration switched to match this letter before the Council signs off.
- Quicket comparison now uses real sourced figures (help.quicket.com — 4.9%/4.5% NPO organiser fee, R7.50 booking fee, no monthly/setup fees). The 500-tickets-at-R120 example is illustrative only, not a real National Show projection — we don't have actual planned ticket volumes/prices yet. Swap in real numbers once pricing is confirmed, or soften "as an illustration only" if you'd rather not include a hypothetical figure at all.
- Firestore claim verified directly (2026-07-01): no firestore.rules file exists in the repo, so wording was changed to describe the actual mechanism instead — every Firestore access goes through the server-side Admin SDK, the browser has no client-side Firestore code path at all. Consider adding an actual firestore.rules file as defense-in-depth even though it's not currently load-bearing for security (not required before sending this letter, but worth a backlog item).
- Ownership section recommends Council create its own Google account/Firebase project at kick-off — flag if that changes your kick-off plan.
