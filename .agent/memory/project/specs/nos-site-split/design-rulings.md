# NOS site split: design rulings (NOS Design, 2026-10-23)

> Relayed verbatim by SAOC from NOS Design's message (source copy: NOS Design workspace `.tmp/sandbox/nos-site-split/design-rulings.md`).

Scope: structure only. Every token, label, file and string named below already exists in the SAOC repo (components/chrome/*, components/nos-chrome/*, branding/National Show 2027/, design/design_handoff_saoc/). Where no source exists, the item is marked COPY GAP and has no invented interim text.
Heuristics: impeccable critique (consistency, wayfinding, recognition over recall), craft-floor (44px targets, 16px controls, visible focus).

## 0. Ground rules for both sites
- R0.1 No new tokens. NOS chrome uses the existing --nc-* tokens in nos-chrome.css. SAOC chrome uses colors_and_type.css. Admin keeps its own tokens.
- R0.2 One link rule. A link between the two sites opens in the same tab with no ↗, because the visitor stays with the same organisation. ↗ plus a sr-only new-tab cue is only for genuinely external sites (WOSA), as r65 already rules.
- R0.3 / on nos.saoc.co.za is today's /national-show hub, unchanged. All NOS hrefs lose the /national-show prefix. Redirecting old URLs is the architect's job.
- R0.4 One logo per surface. Brad's double-logo ruling from 2026-10-22 applies, so neither header carries the other site's logo.

## 1. NOS header
- R1.1 Lockup: keep the current one, /images/nos/nos-full-colour-horizontal-1200.png, built from the supplied NOS-2027-logo-full-colour-horizontal.png. Keep the 448px box (390px below 700px) and the same alt text. It links to / on NOS.
- R1.2 Menu. With no SAOC menu to sit inside, the Layout 4 mega's groups become the top row. Labels, leaf order and descriptors come from nav-config.ts, verbatim:
  1. Visit ▾ About the show · What to expect · Plan your visit · FAQ
  2. Programme ▾ Programme · Workshops · Symposium · WOSA Conference · Conference registration
  3. Exhibit & trade ▾ South African exhibitors · International guests · Exhibitor entry guide · Exhibitors and vendors
  4. Show sponsors (plain link; the label comes from the "The show" group)
  5. Past shows (plain link; withheld in public until there is content, as r64 / #45 already does)
  6. Contact: SAOC's /contact on the SAOC host. SAOC organises the show, so this is the show contact. It's a plain link at the end, like SAOC's Header action link.
  - The dropdowns reuse today's click-only nh-mega panel (each one-column group as a simple list panel). Keep hover-free behaviour, Esc to close and focus return. Drop the "The show" lead block and the Tickets feature rail, because both now live on the top row.
- R1.3 Tickets CTA: keep today's nh-cta ("Tickets", royal fill, 44px, uppercase 13px) at the far right, linking to /tickets on NOS. It is the site's one primary action and is visible at every width, including next to the burger.
- R1.4 Mobile: keep today's panel (nd-*) and breakpoint (1260px; re-measure once it renders, because six items may fit lower). In the panel the three groups are disclosure sections in the order above, followed by Show sponsors, Past shows and Contact. After a rule at the end of the panel comes the SAOC credit line from R2.3, as text only: the org name, linking to the SAOC site.
- R1.5 No SAOC utility bar on NOS. "Join a society" and info@ belong to SAOC. The SAOC credit lives in the footer and in the panel line above.

## 2. NOS footer
Keep today's nf footer on royal, with the shared FOOTER_LAYOUT 4-column grid and FOOTER_RHYTHM rows. Only the column contents change:
- R2.1 Column 1, brand: the supplied gold vertical lockup, as today. It links to / on NOS. Move the REG/NPO line out of this column, because it is SAOC's registration (see R2.3).
- R2.2 Column 2, "Explore": a NOS list with labels from nav-config: Tickets · Programme · Plan your visit · Exhibitors and vendors · Show sponsors · FAQ. The heading stays FOOTER_HEADINGS.explore.
- R2.3 Column 3, the SAOC credit. It replaces "Partners", which are SAOC's partners and stay on SAOC. It is a single link block to the SAOC home and contains:
  - a small label line in nf-head style (mono, uppercase). Its wording is a COPY GAP for Brad. The only source is his decision phrase, "the governing body that organises the show". Recommendation: the words "Organised by". Nothing ships until Brad gives the wording.
  - the SAOC mark: a supplied design_handoff_saoc/assets/saoc-logo-*-paper.png variant (the light variant for the royal ground; I'll choose between flat and ink by eye at render), about 48px tall, never recoloured or cropped.
  - FOOTER_ORG_NAME ("South African Orchid Council") in nf-text.
  - FOOTER_REG beneath it, moved here from column 1.
  - The whole block is one link with a 44px minimum target and a visible focus ring. Its accessible name is the org name.
- R2.4 Column 4, "Stay in touch": FOOTER_BULLETIN + NewsletterSignup with the list chooser (R4), then the WOSA link as today (still external, ↗ per R0.2).
- R2.5 Bottom bar: keep the copyright as it is (© {year} South African Orchid Council. All rights reserved.). SAOC is the legal owner, so this is correct.
- R2.6 Legal links, ruling: mirror Privacy, Terms and Refunds on NOS. Render the same content source on the NOS host so a buyer mid-checkout reads them without leaving the show site (wayfinding, context continuity). Refunds especially, because tickets now live on NOS. The architect chooses the canonical URLs. Constitution links out to SAOC (it's SAOC governance, not show content). Media kit links to the NOS media kit (members only, per Brad). Order: Privacy · Terms · Refunds · Media kit · Constitution.

## 3. SAOC header and footer
- R3.1 Header: replace the National Show mega with a plain link item, label "National Show" (existing), pointing to the NOS home. It stays in the same slot (after Events, before Sponsors) and gets no ↗ (R0.2). Delete the lead block, the three columns and the Tickets rail from the SAOC NAV.
- R3.2 Utility bar: the ghost pill "19th National Show · Sep 2027" (handoff, header section) links to the NOS home. Keep it as it is; it's already the right signpost.
- R3.3 Mobile menu: "National Show" becomes one plain row linking to NOS. No disclosure.
- R3.4 Footer: FOOTER_NAV "National Show" points to the NOS home. Legal links stay as they are, apart from Media kit, which is the SAOC media kit (members only).
- R3.5 Home: no new card. Retarget what the handoff already has: the hero CTA "19th National Show, 2027", the "Four ways into SAOC" show card, and both CTAs in the next-show band all point to NOS. The countdown and meta stay.
- R3.6 Site search on SAOC: show results link to the NOS host or are dropped. That's the architect's call; there are no dead /national-show results either way.
- R3.7 Split footer-data.ts into SAOC and NOS link lists, keeping one shared file for layout, rhythm, bulletin, REG and copyright, so the two skins still can't drift apart.

## 4. Newsletter list chooser (both footers)
- R4.1 Put a fieldset under the email field, before Subscribe. It holds two native checkboxes, labelled from the existing NEWSLETTER_COPY.adminSourceSaoc ("SAOC") and adminSourceNos ("National Orchid Show").
- R4.2 The site's own list comes first and is pre-checked: NOS footer = National Orchid Show ☑, SAOC ☐; SAOC footer = SAOC ☑, National Orchid Show ☐.
- R4.3 Each row is at least 44px with a 16px label and the whole row clickable. Colour them with accent-color from the skin (--nc-gold on royal; SAOC brass on sage), and keep the visible focus ring. The two options sit inline and wrap to stacked below about 360px.
- R4.4 Legend: COPY GAP. Use a visually hidden legend until Brad gives wording, because the field still needs an accessible group name. Interim sr-only text: the existing FOOTER_HEADINGS.touch ("Stay in touch").
- R4.5 Both unchecked: block the submit, put an inline error under the group (aria-describedby, the same TicketFieldAlert-style treatment as the email error), and keep focus on the first checkbox. The error text is a COPY GAP (NEWSLETTER_COPY has no string for it).
- R4.6 The success message names nothing new. It reuses NEWSLETTER_COPY.success.

## 5. Admin
- R5.1 The admin chrome stays exactly as PR #35/#36 shipped it: SAOC frame, "Admin" label, sidebar, pill and drawer. It's neutral and shared. There's no NOS skin in admin.
- R5.2 Serve one admin origin, the SAOC host, so there's one sign-in and one cookie. That's an architect call; the design is unaffected.
- R5.3 Links in ticket emails, PDFs and confirmations that point to show pages must use the NOS host. The shells stay as I approved them on 2026-10-22.

## 6. What I'll check once it renders
- NOS header at 1280, 1440 and 2056@2, plus the 390 panel: six top items plus the CTA with no wrap. Re-measure the breakpoint.
- The NOS footer credit block's contrast on royal, plus a by-eye choice of the SAOC paper variant.
- The chooser at 390, keyboard only, and the both-unchecked error.
- Every cross-site link resolves to the right host. No /national-show link left on SAOC.

## Decisions for Brad (via SAOC)
1. The credit label wording (R2.3). Recommendation: "Organised by".
2. The newsletter chooser legend and the none-selected error (R4.4, R4.5).
