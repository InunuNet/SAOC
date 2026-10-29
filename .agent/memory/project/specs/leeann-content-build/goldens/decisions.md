# leeann-content-build: architect decisions

Binding for @dev and @qa. "Default" means the change list's "until she answers we will" text, encoded exactly.

## Shape

1. Four contracts, two PRs (see README). Scope is enforced by `scope.mts m1|m2` against the allow-lists in `scope/`.
2. Nothing is invented (docs/rules/no-invention.md). Her words are published as written, typos included, until
   `typo-corrections.json` says otherwise. Where a document is silent, the page is silent.

## F1 legal and company pages (verbatim)

3. Source: `source/privacy-policy.txt`, `terms-and-conditions.txt`, `company-constitution.txt`. Struck-through
   text is excluded. Storage is the dev's choice but one source per document under `content/legal/`, rendered by one
   shared component under `components/legal/`, so Privacy and Terms (shared route, both hosts) cannot drift.
4. The one `<h1>` is her title line ("Privacy and Personal Information Policy", "Website Terms and Conditions"),
   followed by her second title line for Privacy. No lede, no "Draft pending legal review" box, no "Last updated: August 2026"
   footer (Terms carries her own "Last updated: 24/10/2026" line inside her text). The eyebrow ("Legal", "Governance") is chrome.
   Metadata description may keep its current sentence; it is not page copy.
5. Constitution: the page title stays "Constitution" (default for Q-D9) and her three paragraphs sit under it. Her
   registration number is published as she wrote it, "1978/0040408", although Terms writes "1978/004040/08"
   (the change list suggests the slash form; that edits her text, so it is held for her answer, see questions-for-leeann.md).
6. Defaults encoded: "OWZO" stays (Q-D4); the Terms links `https://no.saoc.co.za/refunds` and `/contact` stay as anchors with
   exactly those hrefs (Q-D5; the hand-over note names them); the Refunds page is untouched (Q-D10).
7. Removing the draft notice is a decision for the orchestrator to confirm with Brad: the notice disclosed that OUR draft was AI-written;
   her text replaces it. The unanswered question "who reviews Privacy, Terms and Refunds, and by when" (section E1) is separate.

## F2 ticket PDF and email

8. `lib/show-contact.ts` (new) is the single home of show contact constants: `SHOW_OFFICE_PHONE = '073 428 4398'` (her Contact
   document spacing), `SHOW_EMAIL_CONFIRMED = false`, `resolveShowQuestionsEmail(confirmed = SHOW_EMAIL_CONFIRMED)` returning
   `resolveReplyTo('nos')` when true and `resolveReplyTo('saoc')` when false. FD later adds `SHOW_ADDRESS_LINES` to the same file.
9. The Questions defect (`resolveReplyTo()` with no site, lib/ticket-pdf-data.ts, loaded and load-failure paths) is fixed by routing
   both through `resolveShowQuestionsEmail()`. With the constant false the ticket still prints info@saoc.co.za (Q-D11 default); flipping one
   constant prints show@saoc.co.za. The show address is NOT printed anywhere until Brad and Lee-Ann confirm the mailbox.
10. Dates (19c, 19d): `TICKET_PRODUCTS.symposium` when "Friday 24 September", meta "9am to 5pm"; `wosa` when "Saturday 25 September", meta
    "9am to 5pm"; `DATED_PRODUCT_KINDS` gains `'programme'`. Workshops and field trips stay on the pill (19e).
11. Organiser line (19i): not printed (Q-D12 default). Guarded by `fe.mts no-organiser`.
12. Parking (19f): `OrderConfirmationVisit.parking: string | null`, set by `buildOrderVisit` only from a confirmed parking block;
    `VisitDetails` adds a "Parking" row (text, else the existing pill). The value itself arrives with the Sanity edit (FA2 #3, #4).
    The PDF Parking cell already exists and must show her sentence in full.

## F3 FAQ, Plan Your Visit, What to Expect, Contact, About

13. FAQ storage stays Sanity (`showFaq` documents). Her document is 79 questions (numbers 1 to 67 and 75 to 86), not 86, in 12 sections.
    `showFaq.category` values become her 12 section ids (`goldens/faq/faq-docs.json`). Section titles, order and introductions live in
    `lib/data/faq-sections.ts` (`FAQ_SECTIONS`), read by `ShowFaqList` and the faq page, replacing both hard-coded category lists.
    A section with an introduction and no questions (section 10) still renders. Question numbers are not displayed; `order` carries her number.
14. `scripts/seed-show-faq.ts`: default is a dry run printing `{mode:'dry-run', documents, delete}`; only `--apply` writes (`createOrReplace`
    on `showFaq-q<N>`, then delete the 14 legacy ids). The coordinator applies it with backup and an `ifRevisionID` guard. FAQ answers are portable text,
    one block per paragraph, status `confirmed`, `active` true.
15. The faq page's wired rows: the venue row is removed (its `replaces:true` would overwrite her Q18 text and Q-D14 is open). The ticket-price list,
    which follows the answer and replaces nothing, moves to `showFaq-q10`.
16. Q15 is published as written, including "OWZO" (Q-D10 says publish the FAQ as written; Q-D4's "say nothing in the FAQ" is read as: make no
    correction or comment). Q75, 80, 81 and 86 keep her Gmail address; the Contact page prints no email (Q-D11, open).
17. About: her seven paragraphs replace the six hard-coded ones; her two title lines are not rendered (the hero is chrome and the naming is FB).
    The meta description stops using "2027 South African National Orchid Show".
18. What to Expect: the hard-coded narrative becomes her Section 3 text (seven paragraphs). Hours, admission, food, photography, accessibility remain
    Sanity-driven (FA). Her struck Section 1 lede stays in Sanity.
19. Plan Your Visit (the design call): her guide becomes a code-resident long-form component (`components/show/PlanYourVisitGuide.tsx`, copy in
    `content/plan-your-visit/`), in one `data-plan-guide` element, carrying her intro, seven sections and all 32 links. Reason: 32 links and about 150
    paragraphs do not fit the structured `airportRoutes`, `accommodation` and `attractions` fields, the page's current research-grade content is not hers, and code copy is
    checkable without a Sanity write. The page stops rendering those three structured blocks and the "Stay informed" call-to-action. The Getting there,
    Public transport, venue card and emergency blocks stay Sanity-driven (FA fills them from her Sections 1 and 2). No storage is restructured.
20. Contact: the page prints her address lines (`SHOW_ADDRESS_LINES`, verbatim), her phone as a `tel:` link with "Lee-Ann McCleland - Show co-ordinator", and
    no committee list (Q-D6) and no email (Q-D11). The two copy-gap placeholders in `lib/nos-contact-copy.ts` are not touched: she supplied neither.
    The address wording conflicts with the venue name in Sanity (Q-D14 is open); both are shown as she gave them, see questions-for-leeann.md.

## F4 stats, partners, vendors

21. Stats (H1): delete the figures 21, 18, 56 and 1990 as stat values, the labels "National Shows Hosted" and "Accredited Judges", the yearbook's 184 pages,
    ISSN and editor, "56 accredited judges" and the "21 affiliated societies" and "184-page" phrases in the six files. Removal only: no replacement wording is written.
    1968 stays. Sanity `homePage.missionText` and `judging.stats` are CMS content and out of scope.
22. Partners (H2): the home list in code is already WOSA-only; kept so. The two Sanity sponsor documents are FA.
23. Vendors (V1): `/national-show/vendors` is the one page. Remove the `sa-exhibitors` route and every nav, section-nav, index and manifest entry. Permanent
    redirect (the proxy's convention is 308; 301 also passes) from `/sa-exhibitors` on the NOS host and from `/national-show/sa-exhibitors` on both hosts to
    `https://nos.saoc.co.za/vendors`. The page intro becomes her v1.1 text (tagline plus four paragraphs, her capitalisation). The 20 "invited" names, her
    nursery-card planning notes and the registration-form text are not published (Q-D6). Retiring `showPage-04` is FA.
