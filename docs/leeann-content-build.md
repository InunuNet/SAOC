# Lee-Ann's 24 Oct 2026 content (mission leeann-content-build)

Her documents are the source; her words are published as she wrote them, typos included, until she approves a
correction (`goldens/typo-corrections.json` in the spec folder). Nothing is invented
([`docs/rules/no-invention.md`](rules/no-invention.md)). Spec, decisions and checks:
`.agent/memory/project/specs/leeann-content-build/`.

## M1: legal pages, ticket PDF and email

- Privacy, Terms and the company documents (`/constitution`) render from one source per document in
  `content/legal/`, through the one renderer `components/legal/LegalBody.tsx`. Her title is the page's one h1;
  the old draft notice, ledes and dated footers are gone. Inline subset: `**bold**`, `<https://url>` and
  `<mailto:address>` (shown without the prefix).
- `lib/show-contact.ts` is the home of the show contact constants. `SHOW_EMAIL_CONFIRMED` is `false`: the
  ticket's Questions line keeps printing the SAOC address, and the show address is printed nowhere until Brad
  and Lee-Ann confirm the mailbox. Flip that one constant with their answer.
- The Symposium (Friday 24 September) and the WOSA Conference (Saturday 25 September), both 9am to 5pm, print on
  the ticket; workshops keep the "To be confirmed" pill. The order email has a Parking row, filled only from a
  confirmed parking block.

## M2: FAQ, Plan Your Visit, What to Expect, Contact, About, stats and vendors

- **FAQ.** Her 79 questions in 12 sections. Section order, titles and introductions live in
  `lib/data/faq-sections.ts` (`FAQ_SECTIONS`), read by `ShowFaqList`, the FAQ page and the `showFaq.category`
  list. A section with an introduction and no question (her section 10) still renders. The ticket-price list
  follows her Q10 answer; the venue row no longer replaces her Q18 text.
- **FAQ seed.** `pnpm exec tsx scripts/seed-show-faq.ts` is a dry run that prints
  `{mode, documents, delete}` and writes nothing. `--apply` backs up every `showFaq` document to
  `.tmp/sandbox/faq-backup/`, aborts if any document changed meanwhile, then writes the 79 documents
  (`createOrReplace` on `showFaq-q<N>`) and deletes the 14 legacy ids in one transaction. The coordinator
  applies it, with the schema deployed first.
- **Plan Your Visit.** Her guide is code-resident (`content/plan-your-visit/guide.ts`, rendered by
  `components/show/PlanYourVisitGuide.tsx` inside one `data-plan-guide` element, all her links, new tab with
  `noopener noreferrer`). The airport routes, accommodation and attractions blocks and the "Stay informed"
  band are no longer drawn; Getting there, Public transport, the venue card and the emergency block stay
  Sanity-driven.
- **About and What to Expect.** Her seven paragraphs each, in the page files. About's meta description uses her
  first sentence.
- **Contact.** Her address lines, her number as a `tel:` link and "Lee-Ann McCleland - Show co-ordinator"
  (`components/nos/ShowContactDetails.tsx`). No committee list and no email address (held questions Q-D6, Q-D11).
- **Stats.** The unsourced figures (21, 18, 56, 1990 as stat values, "National Shows Hosted", "Accredited
  Judges", the yearbook's page count, ISSN and editor, the "21 affiliated" and "184-page" phrases) are removed
  from the home, sponsors, media kit and judging pages. 1968 stays. The sponsors "Our reach" section is gone
  with its figures. Nothing replaces them.
- **Vendors.** `/national-show/vendors` is the one exhibitors page, with her v1.1 introduction. The
  `sa-exhibitors` route and its nav, section-nav, index and routes-manifest entries are removed; `proxy.ts`
  redirects `/sa-exhibitors` (NOS host) and `/national-show/sa-exhibitors` (both hosts) to the NOS `/vendors`
  with a 308.

## Known leftovers

- `scripts/generate-nos-route-manifest.ts` and some older contract checks still name `sa-exhibitors`; they were
  outside this change's file list.
- `MissionBlock` still carries its beta-only placeholder paragraph that mentions "21 societies" and "1990"
  (marked as placeholder, hidden in a public build). It is prose, not a stat value.
