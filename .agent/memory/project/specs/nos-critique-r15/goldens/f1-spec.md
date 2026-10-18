# nos-critique-r15 F1 — withhold the unsourced per-society estimates on the public build

BASE: `origin/main` `ab7c549c` (r14 merged), recorded when the spec was written. Branch `fix/nos-critique-r15`, worktree `.tmp/sandbox/critique-r15`.
If the P0 standalone-semver fix lands on main first, the dev rebases onto it before handoff. The guard only needs BASE to stay an ancestor.

## Ruling (lead, FINAL, 2026-10-18; vote carried 2/3, consistent with F24 vote 1C)

On the PUBLIC build, withhold the unsourced per-society estimates by extending the existing withholdPlaceholderProse() switch
(lib/data/show-pages.ts) to cover three things:

- the estimate pill, e.g. "Founded 1947 · ~220 members ESTIMATED" (SocietyCard.tsx:72, SocietyFacts.tsx:24);
- the /societies caption "…are our own estimates, pending confirmation from each society";
- the /societies/<slug> marker "General description — society-specific detail pending confirmation".

Beta/private stays byte-unchanged. Sourced data (real Sanity founded/memberCount with the flags false) still renders. The withhold
decision is made server-side and passed down. No new copy.

## What renders today (BASE, measured)

| where | element | source | public (BASE) |
|---|---|---|---|
| /societies, every card (21/21) | "Region · Founded YYYY · N members" + "(estimated)" | SocietyCard.tsx:57-77 (client) | shown |
| /societies, above the grid | "Founding years and member counts marked (estimated) are our own estimates, pending confirmation from each society." | SocietiesClient.tsx:110-115 (client) | shown |
| /societies, served HTML | the RSC payload passes `founded`, `memberCount` and `…Placeholder: true` to the client component | page.tsx → SocietiesClient | shipped |
| /societies/<slug> | "Founded YYYY · ~N members" + "estimated" pill | SocietyFacts.tsx:24-60 (server) | shown |
| /societies/<slug> | generic SAOC-voiced prose "<name> is one of SAOC's 21 affiliated societies, serving growers in <region>. Affiliation means …" + the marker | SocietyAbout.tsx:39-51 (server) | shown |

All 21 societies carry `foundedPlaceholder` and `memberCountPlaceholder` true on this data (Sanity or the static fallback). The mode is
fixed at build time (ISR prerender): public and preview are two builds. A `next start` env switch does not flip it (verified).

## Decision

### 1. Withhold in the DATA on the server, not in the client markup

New pure module `lib/data/society-withhold.ts`. It has no runtime imports and no string literals.

`withholdSocietyEstimates<T extends { founded: number | null; memberCount: number | null; foundedPlaceholder?: boolean | null; memberCountPlaceholder?: boolean | null }>(society: T, withhold: boolean): T`

- When `withhold` is false, it returns the same object. This is the beta preview, so it stays byte-unchanged.
- When `withhold` is true:
  - if `foundedPlaceholder` is true, it sets `founded: null, foundedPlaceholder: false`;
  - if `memberCountPlaceholder` is true, it sets `memberCount: null, memberCountPlaceholder: false`;
  - every other field, and any field whose own flag is false/null/absent (sourced), passes through unchanged;
  - it never mutates its input.
- The cases are in `goldens/f1-withhold.json` unitCases U1-U7, including the two mixed-flag cases.

The switch is the existing `withholdPlaceholderProse()`. This is "extend it to cover": no new switch, and `lib/data/show-pages.ts`
stays byte-identical.

Why the data and not a prop on the card: SocietyCard and SocietiesClient are client components. A `withhold` prop would still ship the
estimates in the RSC payload to every public visitor, so the figures would remain in the page source. Nulling them on the server
removes them from the HTML and the payload, and the existing render logic then does the right thing with no client change:

- the card's figure line keeps the region, and the "(estimated)" tag disappears because the flags are false;
- SocietiesClient's caption condition (`some(foundedPlaceholder || memberCountPlaceholder)`) is false, so the caption goes;
- SocietyFacts returns null when there is no confirmed meeting and no figure, which is the case for all 21 today.

SocietyCard.tsx, SocietyFacts.tsx, SocietiesClient.tsx, SocietiesFallback.tsx and show-pages.ts stay byte-identical.

### 2. Wire it in the two server pages

In `app/(marketing)/societies/page.tsx`:
- import the helper;
- after the `societies` const, add `const listed = societies.map((s) => withholdSocietyEstimates(s, withhold));` (the `withhold`
  const already exists at BASE);
- pass `listed` to `<SocietiesClient societies={listed} provinces={provinceChips} />`.

The fallback count is unchanged.

In `app/(marketing)/societies/[slug]/page.tsx`, in `SocietyPage` only (generateMetadata shows no estimate):
- import `withholdPlaceholderProse` and the helper;
- add `const withhold = withholdPlaceholderProse();` and `const shown = withholdSocietyEstimates(society, withhold);`;
- render `<SocietyFacts society={shown} />` and `<SocietyAbout society={shown} withhold={withhold} />`.

### 3. The generic SAOC-voiced description under the marker: withheld WITH its marker on public

`SocietyAbout` gains an optional `withhold?: boolean` prop, defaulting to false so the beta is unchanged. On public:

- the `[data-placeholder]` fallback block (the prose and the marker) is not rendered;
- if the society also has no `description` and no `website`, the whole section returns null. The "About this society" eyebrow is
  never left over nothing; with a website, the eyebrow and the link stay.

A real Sanity `description` still renders exactly as today.

Justification, recorded for the lead:

- (a) Withholding the marker but keeping the prose would present unconfirmed, generic copy as if it were confirmed. That is worse than
  either state today, and it is exactly what F24 1C rules out ("withhold on public, show marked on preview").
- (b) The prose itself carries an unsourced figure, "one of SAOC's 21 affiliated societies". The society count is the same claim
  F24 1C already withholds on /societies (UNSOURCED_LEDE). Keeping it here would contradict that ruling.
- (c) Nothing in the prose is society-specific. Removing it loses no sourced information, and the page keeps the facts it can
  stand behind: hero (province, name, region), Upcoming events, What to expect, the details callout and the CTA.

Rejected alternative: keep the prose and drop only the marker. It is simpler, but it breaks 1C and (b).

### Out of scope (reported, not changed)

- The society page CTA body (`[slug]/page.tsx`, CTASection) reads "SAOC coordinates 21 affiliated societies across South Africa".
  This is the same unsourced count, outside this ruling's three items, and F24's STATIC_CLAIM regex does not match it. Lead decision.
- `generateMetadata` descriptions ("<name> — affiliated SAOC society in <region>.") carry no estimate and are untouched.

## Acceptance (contract-f1.yaml; pins in checks-f1.sha256)

- A1: pins.
- A2: `footprint.mjs`, the union of f1/f2/f3-footprint.json, plus `docs/nos-critique-r15.md` and the spec dir.
- A3: `f1-static.mjs` S1-S6:
  - S1: the helper is pure, with no runtime import and no literal;
  - S2: both pages keep BASE except the renderer hand-off lines, bind the helper's result and pass it, and the slug page calls the switch;
  - S3: SocietyAbout gains `withhold?: boolean` with the literal set unchanged;
  - S4: the client components and show-pages.ts are byte-identical;
  - S5: no new copy;
  - S6: the docs record F1.
- A4: `f1-unit.mjs`, cases U1-U7 run against the real module through Node type stripping.
- A5: `f1-rendered.mjs`, public and preview builds, at 1280 and 390:
  - P1: no golden string or estimate in main's text on /societies and three society pages, and no placeholder flag or figure in the
    served HTML/RSC payload;
  - P2: same 21 cards, each with its preview text minus only the estimate parts; 3 columns at 1280, 1 at 390;
  - P3: no section is orphaned;
  - P4: no overflow;
  - V1: the preview still shows every string, and main.innerHTML is sha-identical to the BASE preview capture (`goldens/f1-baseline.json`).

## Proof

- At BASE, f1-static fails S1/S2/S3/S6 and f1-rendered fails P1 and P2 on every public row. The preview rows (V1) pass, since the
  baseline was captured there.
- On the prototype of this decision, all F1 assertions PASS (see the contract for the run). The prototype was reverted.

## NO INVENTION sources

- `docs/rules/no-invention.md`
- `design/design_handoff_saoc/` (design_system_README.md, colors_and_type.css, SKILL.md, ui_kits/, src/, screenshots/): no visual change
  is introduced. Withholding removes elements and adds none.
- `branding/SA Orchid Council/`: no brand asset is touched.
- The lead ruling above, and F24 vote 1C (`.agent/memory/project/specs/launch-weekend/goldens/f24/f24-spec.md`, withhold.json).
