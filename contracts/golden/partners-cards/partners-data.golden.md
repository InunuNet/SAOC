# Partners data — golden (F1)

There are TWO independent hardcoded partner sources in this codebase — both
must be trimmed to the same three real partners. Do not let them drift:

1. `components/home/PartnersSection.tsx`'s `STATIC_PARTNERS` — feeds the
   home page "In collaboration with" section.
2. `lib/data/partners.ts`'s `partners` array — feeds the "Partners" column
   in `components/chrome/Footer.tsx` (Col 3), which renders on every page
   via `app/(marketing)/layout.tsx`. Currently `{ name: string }` objects
   only (no `url`); the `Partner` type (`types/index.ts:79`) already has
   optional `url?`/`logoUrl?` fields if you want footer/section parity, but
   that is NOT required — trim the invented three and stop. Do not turn
   this into a shared-data-model refactor merging the two sources; they can
   keep existing as two lists as long as both list the same three real
   names.

`components/home/PartnersSection.tsx`'s `STATIC_PARTNERS` fallback must contain
**exactly these three entries, in this order**, and no others. Names and hrefs
below are asserted verbatim in rendered HTML (see contract assertions
PC-01…PC-08). Descriptions are advisory copy — not asserted verbatim (too
brittle against minor wording edits), but the section's overall rendered text
must grow past a bare-name grid (asserted by PC-09, a length proxy).

| # | name (asserted exact) | website (asserted exact) | suggested one-line description (factual, not SAOC's remit) |
|---|---|---|---|
| 1 | `Wild Orchids of Southern Africa` | `https://wildorchids.co.za` | Partner organisation hosting the WOSA Conference at the 2027 National Show. |
| 2 | `South African National Biodiversity Institute` | `https://www.sanbi.org` | South Africa's national institute for biodiversity science, conservation planning and botanical gardens. |
| 3 | `Kirstenbosch NBG` | `https://www.sanbi.org/gardens/kirstenbosch` | One of the world's great botanical gardens, managed by SANBI at the foot of Table Mountain. |

### WOSA copy update (post-handoff correction from Brad, via team lead)

WOSA is not a generic external link — they are a documented SAOC partner
whose annual conference will be hosted at the 2027 National Show (Spec V3
gives the WOSA Conference its own section; it is one of the planned ticket
tiers). The card copy should say something substantive and true about that
relationship, not generic filler. Acceptable framing, still inside the
CLAUDE.md scope boundary:

> "Wild Orchids of Southern Africa — hosting the WOSA Conference at SAOC's
> 2027 National Show."

or similar wording that names the partnership and the Show tie-in. It must
**describe WOSA as the partner organisation and their conference's presence
at the Show** — it must **not** describe wild-orchid habitat/conservation
subject matter as SAOC's own remit. The separate WOSA website rebuild
(wildorchids.co.za) is another team's project; this card only links to it,
it does not describe or take credit for that site's content.

## Explicitly removed from `STATIC_PARTNERS`

These three were invented (not real SAOC partners as far as this repo's
research established) and must not appear anywhere in the rendered home page.
Asserted absent by PC-05…PC-07.

- `American Orchid Society`
- `Royal Horticultural Society`
- `World Orchid Conference`

## Scope-boundary note (WOSA copy)

Per `CLAUDE.md`, SAOC is cultivation-focused; wild-orchid conservation belongs
to WOSA. The WOSA card describes the partnership (WOSA as an organisation,
their conference at the 2027 National Show) — it does not describe wild-orchid
habitat/conservation subject matter as SAOC's own activity, and it is
presented as a link to a separate partner. Do not expand this into content
that reads as SAOC's own conservation program, and do not describe or take
credit for the content of the separate wildorchids.co.za site (another
team's project) beyond linking to it.

## Href correction

`https://wosa.org.za` does not resolve. The live WOSA site is
`https://wildorchids.co.za`. Fix it in BOTH places — `PartnersSection.tsx`'s
`STATIC_PARTNERS` entry AND `components/chrome/Footer.tsx:117`'s standalone
"Looking for wild orchids?" link. (Previously the Footer link was scoped
out of this feature; the team lead has since brought it back in scope
because leaving it dead while fixing the home-page copy was inconsistent.
Asserted by FTR-07/FTR-08.)

## Invented partners must also be removed from the footer

`lib/data/partners.ts`'s `partners` array currently lists all 6, including
the same 3 invented ones. Trim it to the same 3 real names as
`STATIC_PARTNERS` above (names only are required; `url` is optional — see
the two-sources note at the top of this file). Asserted by
FTR-01/02/03 (absence) and FTR-04/05/06 (presence), checked on `/about` —
a non-home page — because the footer is site-wide via
`app/(marketing)/layout.tsx` and proving it only on `/` wouldn't rule out a
page-specific fix.
