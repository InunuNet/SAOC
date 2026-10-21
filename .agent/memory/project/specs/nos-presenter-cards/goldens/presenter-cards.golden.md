# Golden — nos-presenter-cards (M1, F1 + F2)

Presenter cards for the SAOC Symposium and WOSA Conference pages. Written by @architect
2026-10-15. @dev implements against this file and `presenters.golden.css`; the QA inputs are
`contracts/checks/nos-presenter-cards/*.mjs` in the SAOC worktree (do not edit them).

## 0. Base, sources, and what is NOT built

**Code base.** Build on `origin/release/nos-beta-cut-20261008` @ `047d610e` (the beta
base). It has the loader, view model, `conferencePresenter` schema and Fraunces/Karla. Do not
use `origin/feat/nos-symposium-presenters` (`d7fbf8f1`): it carries 16 unmerged vendor/WOSA
commits. Its only presenter delta is `scripts/seed-symposium-presenters.ts`, which is
content-only and already applied to Sanity, so nothing in this build depends on it.
Assertions A10/A11/A12 diff against `047d610e`.

| # | Source | What it decides |
|---|---|---|
| S1 | Brad, 2026-10-15, relayed by NOS Design/Codi: "Follow Lee-Anns structure" | placement, roles, order, verbatim bios |
| S2 | Lee-Ann's spec `content/drive-source/National Show/1. Website Development SpecificationV3/v1.0/content.md` §4.6 (Symposium: "Final programme with speaker biographies, photographs…", "Speaker profiles reused from the shared database") and §4.7 (WOSA: "Speaker profiles…", "Built on the same reusable Speaker… structures as the Symposium") | ONE reusable section, inside the two existing event pages |
| S3 | Codi's approved reference render, https://claude.ai/artifact/KzuKQeqQbLBCbavB3TbSzX (read 2026-10-15) | every visual value, DOM shape, clamp script, dialog |
| S4 | Live Sanity dataset `26yfbug4/production`, read-only GROQ 2026-10-15 (perspective raw, no drafts exist) | doc ids, asset refs, image sizes, null orders, roles, WOSA count |
| S5 | `scripts/seed-symposium-presenters.ts` (on `origin/feat/nos-symposium-presenters` only; read for reference, not needed in the build) | bio storage format: one block per line, `\n\n` between, bullets as `"• "` |

**Excluded from the build (S1/S3):** the reference's page hero ("Presenter Profiles"), the
"Content flags for Lee-Ann" section, the draft-roles note ("Roles for Crous, Tibbs and Fuchs
are drafted from their bios…"), and the three drafted roles. No new route. No Sanity schema
change and no Sanity write of any kind.

## 1. Placement (F2)

Both pages keep their existing hero (`<ShowContentState>`) and section nav. The section renders
between them. `void presenters;` is removed; `void ticketCard;` stays (not this mission).

`app/(marketing)/national-show/symposium/page.tsx`:
```tsx
import { PresenterSection } from '@/components/nos/PresenterSection';
...
      <ShowContentState result={result} heroImage="/images/orchid-dark.jpg" layout="prose" />

      <PresenterSection eyebrow="Symposium" presenters={presenters} />

      <ShowSectionNav current="/national-show/symposium" />
```

`app/(marketing)/national-show/wosa-conference/page.tsx`: same, with
`<PresenterSection eyebrow="WOSA Conference" presenters={presenters} />` after the
`<ShowContentState … afterProse={…} />` element.

| eyebrow | source |
|---|---|
| `Symposium` | Codi's reference render (S3), `.sec-eyebrow` |
| `WOSA Conference` | the page's existing naming: `loadShowPageOrFallback('07-wosa-conference', { label: 'WOSA Conference' })` and metadata title "WOSA Conference — National Orchid Show" in `wosa-conference/page.tsx`; also the `conferencePresenter.event` option title |

**Empty state.** `PresenterSection` returns `null` when `presenters.length === 0`: no
heading, no placeholder, no note. **WOSA today has 0 presenters** (S4: all four
`conferencePresenter` docs have `event == "saoc-symposium"`), so the WOSA page renders
exactly as it does now. The loader's never-throw `[]` on a Sanity failure lands in the same
branch.

## 2. DOM structure (F1)

Server component `components/nos/PresenterSection.tsx` renders the section and heading, then
the client component `components/nos/PresenterGrid.tsx` (`'use client'`) renders the list and
the one dialog. The dialog sits INSIDE `section.nos-presenters`, so the scoped CSS reaches it
(top-layer rendering does not change DOM ancestry).

```html
<section class="nos-presenters" aria-labelledby="presenters-{event}-title">
  <div class="pc-wrap">
    <div class="pc-sec-top">
      <div class="pc-sec-head">
        <p class="pc-eyebrow">{eyebrow}</p>
        <h2 id="presenters-{event}-title" class="pc-title">Presenters</h2>
      </div>
      <!-- only while hasProvisionalOrder(presenters) -->
      <p class="pc-order-note">Sample sequence. Lee-Ann will confirm the order.</p>
    </div>

    <ul class="pc-grid">                                  <!-- PresenterGrid from here -->
      <li class="pc-card">                                <!-- one per presenter, golden §4 order -->
        <div class="pc-head">
          <figure class="pc-photo">                       <!-- aria-hidden="true" and empty when photo is null -->
            <img src="{photo.src}" width="{photo.width}" height="{photo.height}" alt="Portrait of {name}">
          </figure>
          <div class="pc-id">
            <h3 class="pc-name">{name}</h3>
            <p class="pc-role">{role}</p>                 <!-- ONLY when role is non-null -->
          </div>
        </div>
        <div class="pc-bio">
          <div class="pc-clip [is-clipped]">
            <div class="pc-body">{parseBio(bioExcerpt) blocks: <p> / <ul><li>}</div>
          </div>
        </div>
        <div class="pc-foot">
          <button type="button" class="pc-more" aria-haspopup="dialog" hidden>
            Read full bio<span class="sr-only"> of {name}</span>
          </button>
        </div>
      </li>
    </ul>

    <dialog class="pc-modal" aria-labelledby="presenters-{event}-dialog-title">
      <div class="pc-sheet-inner">
        <div class="pc-sheet-head">
          <div class="pc-sheet-face"><img … same src/size/alt as the card …></div>
          <div>
            <h2 id="presenters-{event}-dialog-title" class="pc-sheet-title">{name}</h2>
            <p class="pc-role">{role}</p>                 <!-- ONLY when role is non-null -->
          </div>
          <button type="button" class="pc-sheet-close">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
            <span class="sr-only">Close</span>
          </button>
        </div>
        <div class="pc-sheet-body"><div class="pc-body">{same blocks}</div></div>
      </div>
    </dialog>
  </div>
</section>
```

JSX forms the checks pin (formatting around them is free):
- `if (presenters.length === 0) return null;`
- `<section className="nos-presenters" aria-labelledby={titleId}>` (attributes in that order)
- `<p className="pc-eyebrow">{eyebrow}</p>`, `<h2 id={titleId} className="pc-title">Presenters</h2>`
- `{provisional ? (<p className="pc-order-note">Sample sequence. Lee-Ann will confirm the order.</p>) : null}`
- `<h3 className="pc-name">{presenter.name}</h3>`
- `{presenter.role ? <p className="pc-role">{presenter.role}</p> : null}`
- `alt={`Portrait of ${presenter.name}`}`
- `Read full bio` then `<span className="sr-only"> of {presenter.name}</span>`, button `hidden={!…}`
- `<span className="sr-only">Close</span>`
- `sr-only` is Tailwind's existing utility. Ids are derived from `presenters[0].event`
  (deterministic; one section per page).
- Photos: `next/image` `<Image … unoptimized />` (cdn.sanity.io is already in
  `next.config.ts` `remotePatterns`; Sanity already serves the exact crop, size and format, so
  Next must not re-encode it). The dialog reuses the card's photo object.
- Bios render as React text nodes. Never `dangerouslySetInnerHTML`.

## 3. Loader and view model (F1)

`lib/view-models/ticket-card.ts`, `PresenterCardViewModel`:
- `order: number | null` (was `number`). Null means "Lee-Ann has not set it".
- `photo: PresenterPhoto | null` replaces `photoUrl` (`PresenterPhoto` is exported from
  `lib/view-models/presenter-photo.ts`, `import type` it relatively with `.ts`).
- `id`, `name`, `role: string | null`, `bioExcerpt: string | null`, `event` unchanged.

`lib/view-models/load-presenters.ts`:
- GROQ keeps `*[_type == "conferencePresenter" && event == $event] | order(order asc)` (the
  conference-workshop-tickets-f6 checks pin it) and `"photoUrl": photo.asset->url`, and adds
  `"photoAssetRef": photo.asset._ref`.
- Map: `order: doc.order ?? null`, `photo: presenterPhoto(doc.photoUrl, doc.photoAssetRef)`.
  Remove the `photoUrl` mapping.
- `import { presenterPhoto } from './presenter-photo.ts';` — relative with `.ts`, same as
  its existing imports (check scripts load it through bare tsx, where `@/` never resolves).
- The never-throw `try/catch` with `console.error('[load-presenters] …')` stays as is.

New pure modules (no React, no `@/` imports): `lib/view-models/presenter-order.ts`,
`presenter-bio.ts`, `presenter-photo.ts`.

## 4. Order rule (S1)

`presenter-order.ts` exports:
- `PRESENTER_FALLBACK_SEQUENCE = ['Elbert Wijaya', 'Hildegard Crous', 'Michael Tibbs', 'Robert Fuchs']`
  — Sanity doc `name`, exact match. Lee-Ann's docs give no sequence; this is Codi's sample
  sequence, so it is shown with the note below.
- `orderPresenters<T extends { name: string; order: number | null }>(list: readonly T[]): T[]`
  — returns a new array, never mutates:
  1. presenters with a non-null `order` first, ascending (`0` is a real order); equal orders
     tie-break by `name` (`localeCompare(…, 'en')`);
  2. then null-order presenters by their index in the fallback sequence;
  3. then null-order names not in the sequence, by `name`.
- `hasProvisionalOrder(list): boolean` — true while ANY presenter has `order === null`.
  Drives the note "Sample sequence. Lee-Ann will confirm the order." (exact string, Codi's).

Live today (S4): all four orders are null, so the Symposium renders Wijaya, Crous, Tibbs,
Fuchs with the note.

## 5. Bio rendering (S1, S5)

`presenter-bio.ts` exports `type BioBlock = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] }`
and `parseBio(text: string | null): BioBlock[]`:
- split on `\n` (strip one trailing `\r` per line); lines that are empty or whitespace-only
  are separators and produce nothing;
- a line starting with `"• "` (U+2022 + space) is a list item; its text is the line after
  those two characters; consecutive items share one `ul`;
- every other line is a paragraph, text **exactly as stored** (no trim of inner spaces, no
  punctuation fixes, no typographic changes). `•` without a following space, `-` and `*`
  lines are paragraphs.

Live shapes (S4): Wijaya 1 paragraph (role present); Crous 18 lines = 7 paragraphs + one list
of 11 items; Tibbs 10 paragraphs; Fuchs 11 paragraphs. The editorial asides Codi flagged
(Wijaya "you know the species name!", Tibbs first-person lines, Crous stray commas) render as
stored — that is the ruling, not a defect.

## 6. Photo crops (S3 crop boxes, S4 asset refs)

**Keyed by the Sanity image asset `_ref`, not by doc `_id` or name.** A crop box is in the
original image's pixel space, so it is a property of that exact asset. If Lee-Ann replaces a
photo in Studio, the new asset has a new ref and simply gets no rect (centre 4:5 crop) instead
of a stale rect cutting the wrong pixels. No schema change, no Sanity write.

`presenter-photo.ts` exports `PRESENTER_PHOTO_CROPS: Record<string, { x0; y0; x1; y1 }>`,
`interface PresenterPhoto { src: string; width: number; height: number }`, and
`presenterPhoto(url: string | null, assetRef: string | null): PresenterPhoto | null`.

| Person (doc `_id`) | asset `_ref` (S4) | original | box x0,y0,x1,y1 | `rect=` x,y,w,h | request w×h |
|---|---|---|---|---|---|
| Elbert Wijaya (`conferencePresenter-elbert-wijaya`) | `image-22d78f9df6c4a9188138aba0787ce2d21af8a636-2113x2113-png` | 2113×2113 | 560,0,2113,1941 | 560,0,1553,1941 | 320×400 |
| Hildegard Crous (`conferencePresenter-hildegard-crous`) | `image-dc5d8e33477da7e5f2aad746c49b989d5ff70c32-690x940-png` | 690×940 | 0,0,690,862 | 0,0,690,862 | 320×400 |
| Michael Tibbs (`conferencePresenter-michael-tibbs`) | `image-29f471e86c4fbc6854aef0598554b1cb3f197822-201x317-png` | 201×317 | 0,0,201,251 | 0,0,201,251 | 261×326 |
| Robert Fuchs (`conferencePresenter-robert-fuchs`) | `image-02d56160c37ec45f6d752b1c836a7683df0c1899-2448x3264-jpg` | 2448×3264 | 473,74,2073,2074 | 473,74,1600,2000 | 320×400 |

Rules (named constants, not literals in the function):
- request width `W = min(320, floor(cropWidth × 1.3))` — 320 is 2× the 160px card plate;
  1.3 is Codi's upscale ceiling, which caps Tibbs at 261px. `H = round(W × 5 / 4)`.
- known ref: `src = `${url}?rect=${x0},${y0},${x1-x0},${y1-y0}&w=${W}&h=${H}&auto=format``
- unknown ref (or null ref) with a url: `src = `${url}?w=320&h=400&fit=crop&auto=format``,
  320×400.
- url null: `null` (the `.pc-photo` plate renders empty on black, `aria-hidden="true"`; no
  placeholder image is invented).

## 7. Styles and fonts

- Copy `presenters.golden.css` to `app/(marketing)/national-show/presenters.css` (values
  verbatim; the header comment may be shortened). Import it in
  `app/(marketing)/national-show/layout.tsx` on the line directly after
  `import './nos-theme.css';`. This mirrors the existing one-stylesheet-per-scope precedent
  and keeps Codi's CSS (mask, `::before` dash, `::backdrop`, three breakpoints, keyframes)
  1:1 instead of re-expressing ~70 declarations as Tailwind arbitrary values.
- Every selector is under `.nos-presenters`, except the scroll lock
  `html:has(.nos-presenters .pc-modal[open]) { overflow: hidden; }`.
- Fonts (same layout file): **Fraunces** becomes the variable font with the optical-size axis
  — remove `weight: ['400', '500']`, add `axes: ['opsz']` (keep subsets, variable
  `--font-nos-fraunces`, display). Codi's names are weight 300, the title 400, and all
  Fraunces headings use `font-variation-settings: "opsz" 24`; the static 400/500 load has
  neither. No Fraunces text ships anywhere else yet, so nothing else changes. **Karla** weights
  become `['400', '500', '600', '700']` (eyebrow and "Read full bio" are 700).

## 8. Behaviour

**Equal heights (S3 script, re-expressed in React).** In `PresenterGrid`:
1. `level()`: remove `--bio-h` from the `ul.pc-grid`; `bioH = Math.min(...)` of every
   `.pc-clip` `scrollHeight`; set `--bio-h: ${bioH}px` on the grid; a card is clipped when
   its `.pc-clip` `scrollHeight > bioH + 1`. Clipped cards get `is-clipped` on `.pc-clip`
   and an unhidden button; the others keep `hidden`. Only set React state when the clipped
   set actually changes.
2. Run `level` from a `ResizeObserver` on the grid (debounced through
   `requestAnimationFrame`) and after `document.fonts.ready`. On unmount:
   `observer.disconnect()` and `cancelAnimationFrame`.
3. Server render and no-JS: no `--bio-h`, every bio full, every button `hidden`.
4. Every card reserves the 44px `.pc-foot` row whether or not its button shows.
5. One presenter: it is its own minimum, so never clipped and no button.

**Dialog.** One native `<dialog className="pc-modal">` per section, filled from React state
(the active presenter), not by DOM cloning:
- open: remember the clicked button, set the active presenter, then `showModal()`, reset
  `.pc-sheet-body` `scrollTop` to 0, focus the close button;
- close on the close button, on a click whose target is the dialog itself (backdrop), and on
  Esc (native);
- on the dialog `close` event, return focus to the remembered opener;
- content: the card's photo (`.pc-sheet-face`), name in `h2.pc-sheet-title`, role only when
  present, the same `parseBio` blocks; only `.pc-sheet-body` scrolls;
- animation only inside `@media (prefers-reduced-motion: no-preference)` (in the CSS).

## 9. Fences

- Do not touch `components/chrome/**` (includes `nav-config.ts`) or `sanity/schemas/**`.
- No Sanity mutation, no seed run, no new route, no "Presenter Profiles" heading anywhere.
- `contracts/checks/conference-workshop-tickets-f6/check-symposium-page-render-unchanged.mjs`
  and `check-wosa-page-render-unchanged.mjs` pinned "zero JSX change until F7 renders the
  presenters". This mission is that render, so those two will fail by design. They are QA
  inputs of a closed contract: @dev does not edit them; the orchestrator retires them.
  `check-load-presenters-empty-state.mjs` must stay green (contract A13).

## 10. Ambiguities resolved here

| question | resolution |
|---|---|
| "Keep the role slot in the layout" vs "render a role ONLY when Sanity has one" | the `.pc-id` block keeps its role position in the markup/CSS; with no role, no `<p>` renders (no empty element, no reserved blank line), so the name alone centres on the photo, as Codi's dialog does (`slot.hidden = !role`) |
| crop key: `_id` or name | neither — asset `_ref` (§6) |
| WOSA eyebrow | `WOSA Conference` (§1) |
| mixed null / non-null orders | non-null first, then the fallback; note shows while any null (§4) |
| bullets split by single vs double newlines | either; one block per non-empty line (§5) |
| fonts for weight 300 + opsz 24 | Fraunces variable + opsz axis, Karla 700 (§7) |
| styling mechanism | scoped plain CSS file imported by the layout, not Tailwind arbitrary values (§7) |
