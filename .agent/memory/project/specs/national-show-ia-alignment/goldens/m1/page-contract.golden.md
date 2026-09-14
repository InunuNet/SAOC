# Golden — the contract every /national-show page template honours

We build these pages ourselves (scope reversal, 2026-09-09). This file is still written as
a contract rather than as internal notes, for one reason: the placeholder gate has to hold
against a developer who was not in this conversation. Being the author of both sides is not
a reason to leave the seam undefined — it is the reason the seam has to be enforced by the
compiler and the gate instead of by memory.

## The five rules

**1. Fetch through the loader, never through GROQ.**

```
import { loadShowPage } from '@/lib/data/show-pages';
const page = await loadShowPage('04-south-african-exhibitors');
```

`loadShowPage` throws when more than one document shares a `pageKey`, and returns `null`
when none does. It is the only supported read path for `showPage`. A direct GROQ query
against `showPage` from anywhere under `app/` fails assertion A16.

**2. Render section prose only through `ShowPageProse`.**

```
import { ShowPageProse } from '@/components/nos/ShowPageProse';
{page.sections.map((s) => <ShowPageProse key={s.sectionKey} section={s} />)}
```

`section.body` is a branded `GatedProse` value, not portable text. Passing it to
`PortableText` is a type error, deliberately. `ShowPageProse` emits the placeholder notice
and the copy in one expression; there is no prop that suppresses the notice.

**3. Render the page-level notice from `page.pageProvenance`.**

When it is not `'council-supplied'`, render `page.notice` near the top of the page, above
the fold, before any body copy. `page.notice` is `{ label, text } | null` and is already
resolved — a template never reads a provenance value and maps it to wording. When it is
`null`, render nothing.

Both levels, not either: the page-level notice is for the visitor arriving, the per-section
notice is for the editor working through one block at a time.

**4. Notice wording is content, not code.** It comes from the `showPageSettings` singleton
so the council can reword it in Studio without a developer. Never hardcode the sentence in
a template.

**5. SEO fields are per-document.** `page.seoTitle`, `page.seoDescription`, `page.seoImage`
(spec §2.4), falling back to `page.title` and `page.summary` when unset.

## The types

```
// lib/data/show-pages.ts
export type Provenance = 'council-supplied' | 'research' | 'placeholder-ai';
export type ShowPageNotice = { label: string; text: string };
export type GatedProse = { readonly __gated: unique symbol };  // opaque

export type ShowPageSection = {
  sectionKey: string;
  heading: string | null;
  kind: 'prose' | 'entityList' | 'programme';
  body: GatedProse;
  notice: ShowPageNotice | null;
};

export type ShowPage = {
  pageKey: string;
  specNumber: number;
  title: string;
  summary: string | null;
  sections: ShowPageSection[];
  pageProvenance: Provenance;
  notice: ShowPageNotice | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImage: SanityImage | null;
};

export async function loadShowPage(pageKey: string): Promise<ShowPage | null>;
export async function loadAllShowPages(): Promise<ShowPage[]>;  // sorted by specNumber
```

## Page-template shape

Every page under `app/(marketing)/national-show/**` that carries council-editable copy is a
Server Component following the same shape. Structure and layout vary; these four lines do
not.

```
export default async function Page() {
  const page = await loadShowPage('15-sponsors');
  if (!page) notFound();
  // ... render page.notice when non-null, then page.sections through ShowPageProse
}
```

`loadShowPage` returning `null` is a **404, not an empty page**. A route whose document has
not been seeded must not render a bare shell — an empty page reads as a finished page with
nothing to say, which is exactly the silent failure this mission exists to prevent.

## The pageKey registry

17 documents. Spec entry 14 has none — it is a link to `/societies`, per Lee-Ann. Routes
and the reasoning behind them are in `route-map.golden.md`.

| specNumber | pageKey | route |
|---|---|---|
| 1 | `01-national-show-landing` | `/national-show` |
| 2 | `02-about-the-national-show` | `/national-show/about` |
| 3 | `03-what-to-expect` | `/national-show/what-to-expect` |
| 4 | `04-south-african-exhibitors` | `/national-show/sa-exhibitors` |
| 5 | `05-international-guests-and-exhibitors` | `/national-show/international-guests` |
| 6 | `06-saoc-symposium` | `/national-show/symposium` |
| 7 | `07-wosa-conference` | `/national-show/wosa` |
| 8 | `08-judging-and-awards` | `/national-show/judging-and-awards` |
| 9 | `09-plant-exhibition-and-sales` | `/national-show/plant-exhibition` |
| 10 | `10-plant-sales` | `/national-show/plant-sales` |
| 11 | `11-programme` | `/national-show/programme` |
| 12 | `12-workshops` | `/national-show/workshops` |
| 13 | `13-booking-tickets` | `/national-show/tickets` |
| 15 | `15-sponsors` | `/national-show/sponsors` |
| 16 | `16-plan-your-visit` | `/national-show/plan-your-visit` |
| 17 | `17-faq` | `/national-show/faq` |
| 18 | `18-contact-us` | `/national-show/contact` |

There is no `01-home`, and no document uses the word "home". Entry 1 is the **landing page
of a subsection**; the only home page on this site is saoc.co.za's.

## Untouchable

`ticketType` and the whole ticketing flow; the vendor subsystem (`vendorApplications`,
`vendorSubmissions`, `vendorStandOrders`, `/national-show/vendors/*`, `/api/vendors/*`);
`/national-show/archive/*` and `/national-show/upcoming`; `showVisitorInfo` and its
`confirmationStatuses` markers; `nos-theme.css` and every token in it. The SAOC parent site
and every sibling section.
