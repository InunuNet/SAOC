# Negative control — recorded before any implementation change

Run against the unmodified tree, dev server already running on
`http://localhost:3333` (verified `200` on `/`). Source: current
`components/home/PartnersSection.tsx` (6-column bordered grid,
`STATIC_PARTNERS` with 6 entries including the 3 invented ones, WOSA href
`https://wosa.org.za`).

All rendered-HTML checks below isolate the partners `<section>` only, via
`contracts/checks/partners-cards/extract-partners-html.mjs` — this avoids a
false hit from `components/chrome/Footer.tsx:117`, which independently links
the same dead `wosa.org.za` URL and is out of scope for this feature.

| Assertion | Pre-change result | Verdict |
|---|---|---|
| PC-05 `American Orchid Society` absent from section | present (1 match) | **RED** — correctly detects the invented partner |
| PC-06 `Royal Horticultural Society` absent from section | present (1 match) | **RED** |
| PC-07 `World Orchid Conference` absent from section | present (1 match) | **RED** |
| PC-01 `Wild Orchids of Southern Africa` present | present | GREEN (already true — regression guard, not a change-detector) |
| PC-02 `South African National Biodiversity Institute` present | present | GREEN (regression guard) |
| PC-03 `Kirstenbosch NBG` present | present | GREEN (regression guard) |
| PC-08 `wosa.org.za` absent from section | present (1 match) | **RED** |
| PC-04 `wildorchids.co.za` present in section | absent (0 matches) | **RED** |
| PC-09 section visible text > 250 chars | 192 chars | **RED** |
| PC-10 no hardcoded 3-card slice/index/length check in source | not present today either | GREEN (regression guard against introducing one) |
| PC-11/12 kept `wildorchids.co.za` anchor has `target="_blank"` + `rel="noopener noreferrer"` | no such anchor exists yet | **RED** |
| PC-13 no `outline-none` added to `PartnersSection.tsx` | absent today | GREEN (regression guard) |
| PC-14 partners `<section>` has no self-overflow at 375px viewport | `scrollWidth === clientWidth === 375` (no overflow) | GREEN today. Detection capability separately verified: at the same 375px viewport the whole-page `document.documentElement.scrollWidth` is `533` (real, pre-existing `ShowBand.tsx` overflow) — proves the scrollWidth-vs-clientWidth technique in `check-overflow-375.mjs` does detect real overflow when it exists. PC-14 is deliberately scoped to the section element so this unrelated bug can't taint it. |
| Build gate (tsc --noEmit, eslint) | passes today | GREEN (regression guard) |

**Honest accounting**: 5 of 14 functional assertions (PC-01/02/03, PC-10,
PC-13, PC-14) are already green before any change — they are regression
guards, not proof the redesign happened. The 6 that matter for proving the
redesign shipped (PC-04 through PC-09, PC-11, PC-12) are all RED on the
unmodified tree and must flip to GREEN once `components/home/PartnersSection.tsx`
is implemented against `partners-data.golden.md` and `requirements.golden.md`.

## Scope extension — footer partner list (FTR-01…FTR-08)

QA's PASS on the home-page section surfaced that `components/chrome/Footer.tsx:81`
renders a THIRD, independent partner source: `lib/data/partners.ts`'s
`partners` array (6 entries, same 3 invented names, plain `{ name }` objects
with no `url` — the `Partner` type in `types/index.ts:79` already has an
optional `url?`/`logoUrl?`, unused today). The footer's separate WOSA link at
`Footer.tsx:117` still points at the dead `https://wosa.org.za`. Because the
footer renders on every page via `app/(marketing)/layout.tsx`, the home page
now contradicts itself (3 partners in the section, 6 in its own footer), and
every other page still asserts the invented partnerships. This was
originally out of scope; team lead corrected that.

Run against the unmodified tree (before this footer fix), fetched from
`/about` (a non-home page, proving the fix is page-wide via the shared
`Footer` component, not coincidentally scoped to `/`) via
`contracts/checks/partners-cards/extract-footer-html.mjs`, which isolates
`<footer>...</footer>` so nothing on the rest of the page (there is no
partners section on `/about` anyway) can interfere:

| Assertion | Pre-change result | Verdict |
|---|---|---|
| FTR-01 `American Orchid Society` absent from footer on `/about` | present | **RED** |
| FTR-02 `Royal Horticultural Society` absent from footer on `/about` | present | **RED** |
| FTR-03 `World Orchid Conference` absent from footer on `/about` | present | **RED** |
| FTR-04 `Wild Orchids of Southern Africa` present in footer | present | GREEN (regression guard) |
| FTR-05 `South African National Biodiversity Institute` present in footer | present | GREEN (regression guard) |
| FTR-06 `Kirstenbosch NBG` present in footer | present | GREEN (regression guard) |
| FTR-07 `wosa.org.za` absent from footer | present | **RED** |
| FTR-08 `wildorchids.co.za` present in footer | absent | **RED** |

Confirmed the extraction script isolates footer correctly: byte length of
the extracted `<footer>` fragment is identical (4635 bytes) whether fetched
from `/` or `/about`, i.e. it is genuinely the shared, page-independent
component, not something page-specific being coincidentally matched.

Verified separately: the footer's existing WOSA anchor (`Footer.tsx:117`)
already carries `target="_blank"` and `rel="noopener noreferrer"` — only the
`href` value is wrong. No new accessibility assertion was needed for that
link; only the href-presence/absence checks above (FTR-07/08).

5 of the 8 new assertions (FTR-01, FTR-02, FTR-03, FTR-07, FTR-08) are real
red-to-green detectors on the unmodified tree; FTR-04/05/06 are regression
guards (already green today), same honest-accounting caveat as PC-01/02/03
above.
