# NAV-1: no focus box on nav links, focus moves to the page heading, aria-current on the current item

Brad (P1, verbatim): "what the fuck is this fucking block around the selected menu item? That looks like it's from the 1980s."
NOS Design ruling NAV-1 is final. Implement it as written below. Visual source: `design/design_handoff_saoc/` and `branding/`;
tokens only, no bare hex, nothing invented (`docs/rules/no-invention.md`).

## Diagnosis (cited, so the dev does not re-derive it)

The box is the keyboard focus ring on header nav links. After a client-side navigation, focus stays on the link that was clicked, so
the next keypress (or any `:focus-visible` heuristic hit) draws the ring on an idle page. No header link carries `aria-current`.

| host | where the ring is drawn |
|---|---|
| SAOC desktop nav | `components/chrome/Header.tsx:128` (NavLink) and `:146` (Contact): `focus-visible:ring-2 ring-primary ring-offset-2 ring-offset-parchment`, `rounded-sm` |
| SAOC mobile menu | `components/chrome/MobileMenu.tsx:134`, `:147` (nav links), `:159` (mailto link) |
| SAOC footer | `components/chrome/Footer.tsx:65-72`, `:88-99`, `:144-157` carry no focus classes at all, so they show the UA default outline |
| NOS header + drawer | `components/nos-chrome/nos-chrome.css:28`: `.nh :focus-visible, .nd :focus-visible { outline: 2px solid var(--nc-violet); outline-offset: 2px; border-radius: 4px }` |
| NOS footer | `components/nos-chrome/nos-chrome.css:122`: `.nf :focus-visible { outline: 2px solid var(--nc-ground); ... }` |
| active state, SAOC | class-driven: `Header.tsx:62` `isActive`, `:130` `active ? 'text-primary'`, `:134-139` conditional 1px span. Matching is `pathname.startsWith(href)` (marks `/eventsfoo` as Events) |
| active state, NOS | `NosHeader.tsx:208-209` exact-match `isCurrent` (no parent marking); group triggers use `data-current` (`:274`, `:360`); `.nh-link` has `aria-current` but no CSS for it |

## What to build

### (a) Route-change focus, both hosts

- `lib/route-focus.ts` (pure, no DOM globals; exports `shouldMoveRouteFocus`, `focusRouteTarget`, `ROUTE_FOCUS_ATTRIBUTE = 'data-route-focus'`,
  `ROUTE_FOCUS_WAIT_MS`). Unit-tested by `checks/check-route-focus.mjs` with fake DOM objects; the shape the fakes implement is the contract.
  - `shouldMoveRouteFocus({ previousPath, nextPath, hash })`: true only when both paths are set, they differ, and `hash` is empty. So: not on first
    render, not when only the query string changes (`usePathname` does not change), not on a hash navigation (`/tickets#ticket-day` is left to Next).
  - `focusRouteTarget(doc)`: finds `#main-content`; none, return `'none'`. If `doc.activeElement` is inside `#main-content` and is not `#main-content`
    itself, return `'kept'` (never steal focus from an autofocused field or a user who already moved on). Otherwise the target is the first
    `#main-content h1`, else `#main-content`. Add `tabindex="-1"` only if the target has no `tabindex`; set `data-route-focus`; register a one-shot
    `blur` listener that removes it; `focus({ preventScroll: true })` (`NosRouteScroll` and Next own scroll). Return `'h1'` or `'main'`.
- `components/site-chrome/RouteFocus.tsx`: `'use client'`, renders `null`. `usePathname()` plus a ref holding the previous path; on change, when
  `shouldMoveRouteFocus`, call `focusRouteTarget(document)` after commit. If it returns `'main'` (the page's h1 has not streamed in yet),
  watch `#main-content` with a `MutationObserver` and re-run `focusRouteTarget` until an h1 exists or `ROUTE_FOCUS_WAIT_MS` (1000) elapses; always
  disconnect. Reads `window.location.hash` for the hash rule.
- Mounted once per host frame, after `<Header />`/`<NosHeader />` and `<main>`: `components/site-chrome/SaocFrame.tsx:34-40` and
  `components/site-chrome/NosFrame.tsx:25-35`. Not in `app/layout.tsx` (it has no chrome; admin has its own shell and is out of scope), not in `app/admin`.
- `app/globals.css`: `[data-route-focus]:focus { outline: none; }` (no ring on the h1 or on `<main>`). The marker exists only while a route focus
  holds focus, so the skip link's focus on `<main>` is unchanged.
- The skip links (`components/chrome/SkipLink.tsx`, `components/nos-chrome/NosSkipLink.tsx`, `.nh-skip` CSS) are not touched.
- Outcome: after clicking any header nav link (desktop, SAOC mobile menu, NOS drawer, NOS disclosure panel link) and landing on a new route,
  `document.activeElement` is the new page's h1. A clicked nav link never keeps focus. In the SAOC mobile menu the focus-trap hands focus back to the
  hamburger on close; the h1 must win (RouteFocus is later in tree order than Header, and its effect runs after every cleanup in the commit). Verify it.

### (b) Focus-visible on nav and footer link lists: underline, not ring

Drop every ring/outline from nav and footer link lists. Keyboard focus stays visible (2.4.7) via the indicator below, which is at least 3:1
against its ground (1.4.11, measured by `checks/check-contrast.mjs`: 9.5:1 SAOC, 14.8:1 NOS).

SAOC, on parchment (`Header.tsx`, `MobileMenu.tsx`):
- Desktop nav link and Contact (`Header.tsx:124-157`): on `:focus-visible` the text goes to `--primary` (same as hover) and a 2px bar in `--primary`
  appears in the same slot as the active underline (`absolute left-0 right-0 -bottom-1`). The active item keeps its 1px bar and it thickens to 2px
  on focus. Hover is unchanged.
- Mobile menu rows (`MobileMenu.tsx:130-151`) and its mailto link (`:157`): same text colour; the 2px underline sits under the label text
  (`underline decoration-2 underline-offset-4`), 1px when active and not focused. The row's `hover:bg-bone` is unchanged.
- Every one of those links carries `focus-visible:outline-none` (without it the UA default outline would show) and a `forced-colors:` variant that
  restores a visible indicator from system colours (`CanvasText`/`Highlight`, never hex), because a background bar vanishes in forced-colors mode.

SAOC footer, on `--primary-800` (`Footer.tsx`): the ground is dark, so `--primary` text would disappear. Adaptation: focus uses the hover colour
`--ivory` plus a 2px `--ivory` underline (offset 4px), `focus-visible:outline-none`, forced-colors fallback. Classes go on the `Footer.tsx` links, not
into `footer-data.ts` `FOOTER_RHYTHM` (shared with the NOS footer). The newsletter field and button keep what they have.

NOS, on `--nc-ground` (`nos-chrome.css`): same pattern in `--nc-royal` ("--royal" in the ruling).
- Replace the blanket `.nh :focus-visible, .nd :focus-visible` (line 28) and `.nf :focus-visible` (line 122) rules. Link-list families take the
  underline: `.nh-link`, `.nh-trigger` (in the `.nh-label::after` bar slot, 2px), `.nh-mega-list a` (underline on `.nh-leaf`, 2px, royal),
  `.nd-item`, `.nd-group a`, `.nd-credit a`. Footer families (`.nf-list a`, `.nf-legal a`) use `--nc-ground` text and a 2px `--nc-ground` underline,
  the colour the old footer outline used. Each rule clears the UA outline (`outline: none`). A `@media (forced-colors: active)` block carries a
  `:focus-visible` indicator in system colours.
- The active mark stays as it is (`--nc-green-1`, 2px: lines 41, 57, 105). The ruling calls it the "gold active bar"; the real token is
  `--nc-green-1`. When active and focused the underline colour is royal at 2px (focus wins; royal reaches 3:1, green-1 at 2.4:1 does not, which is
  pre-existing and not changed here).
- Keepers retain their explicit outline rules (they were covered only by the blanket rule): `.nh-brand`, `.nh-cta`, `.nh-burger`, `.nf-lockup`
  (2px violet / ground as before), `.nh-skip` (unchanged), the newsletter email field, checkbox and button in `.nf-form`.

### (c) `aria-current` on the current item, both hosts

- `lib/nav-current.ts` (pure; unit-tested by `checks/check-nav-current.mjs` against `aria-current-fixtures.json`):
  `isNavCurrent(pathname, href)`, `navAriaCurrent(pathname, href, { crossSite? }) => 'page' | undefined`, `anyNavCurrent(pathname, hrefs)`.
  Rules: `null`/empty pathname is never current; an absolute (`https://`, `//`) href is never current; query and hash are stripped from both sides;
  one trailing slash ignored; both sides are normalised with `nosPath()` so the public NOS path (`/faq`) and the internal one (`/national-show/faq`)
  agree; `/` (and the NOS hub) match exactly only; everything else matches the path or a descendant on a segment boundary (`/events/x` marks Events,
  `/eventsfoo` does not); case-sensitive. A `crossSite` item (SAOC "National Show") is never current. `navAriaCurrent` returns `undefined`, so the
  attribute is omitted, never rendered as `"false"`.
- Both headers and both mobile surfaces use it and render `aria-current="page"` on the current link, including the parent item of a child route
  (`/societies/x` marks Societies; NOS `/vendors/apply` marks the Exhibitors and vendors leaf). SAOC: `Header.tsx` nav + Contact, `MobileMenu.tsx`
  nav + Contact (it needs `usePathname`). NOS: `NosHeader.tsx` brand, panel leaves, plain links, Contact, Tickets CTA, drawer items. Delete
  `isActive`/`active` from `Header.tsx` and the local `isCurrent` from `NosHeader.tsx`.
- NOS disclosure triggers (Visit, Programme, Exhibit & trade; the buttons at `NosHeader.tsx:268` and `:356`) are buttons that do not navigate.
  They get `aria-current="true"` when any child leaf is current (`anyNavCurrent`), replacing `data-current`. Assumption (the ruling says "page"
  for parents): "page" on a control that is not itself a page link would misreport it. The visual selector is `[aria-current]`, so both values
  draw the same bar.
- The active visual hangs off `[aria-current]`, not a separate class or `data-current`: SAOC via `aria-[current=page]:` / `group-aria-[current=page]:`
  variants (Tailwind v4); NOS via `[aria-current]` selectors (`.nh-link[aria-current="page"]`, `.nh-trigger[aria-current]`, `.nd-item[aria-current]`).
  Extension flagged: NOS plain links (Show sponsors, Contact) carried `aria-current` but no mark; they get the same bar as the triggers
  (wrap their label in `.nh-label`).

### (d) Unchanged

Buttons and form fields keep their rings: SAOC search and hamburger buttons (`Header.tsx:165,177`), mobile Close (`MobileMenu.tsx:100`), the
newsletter field and button, the NOS burger and Tickets CTA. The brand lockup links keep theirs too (not a link list): `Header.tsx:90`,
NOS `.nh-brand`, `.nf-lockup`. `nav-config.ts`, `nos-nav.ts`, `footer-data.ts`, `NewsletterSignup.tsx` and the skip links must not change
(`checks/check-scope.mjs` fails on any file outside the fix's allow-list).

## Fixture tables (generated from `aria-current-fixtures.json`; the JSON is authoritative)

### SAOC host: route to the item(s) carrying `aria-current="page"`

Item ids are the ids in `components/chrome/nav-config.ts` (`contact-link` is `CONTACT_LINK`).

| pathname | aria-current item | note |
|---|---|---|
| `/` | none |  |
| `/about` | `about` |  |
| `/about/` | `about` |  |
| `/societies` | `societies` |  |
| `/societies/orchid-society-of-pretoria` | `societies` |  |
| `/judging` | `judging` |  |
| `/events` | `events` |  |
| `/events/submit` | `events` |  |
| `/events/some-show` | `events` |  |
| `/eventsfoo` | none |  |
| `/aboutus` | none |  |
| `/sponsors` | `sponsors` |  |
| `/contact` | `contact-link` |  |
| `/media-kit` | none |  |
| `/members` | none |  |
| `/privacy` | none |  |
| `/national-show` | none | crossSite item: never current on the SAOC host |

### NOS host: route to current leaves and to the disclosure groups that get `aria-current="true"`

Leaf ids are the ids in `components/nos-chrome/nos-nav.ts` (`hub` is the brand link, `contact` the show contact link); groups are the column ids.

| pathname | current leaves (`page`) | current groups (`true`) | note |
|---|---|---|---|
| `/` | `hub` | none |  |
| `/national-show` | `hub` | none | host-less dev origin |
| `/about` | `about-the-show` | `visit` |  |
| `/what-to-expect` | `what-to-expect` | `visit` |  |
| `/plan-your-visit` | `plan-your-visit` | `visit` |  |
| `/plan-your-visit/parking` | `plan-your-visit` | `visit` | child route marks its parent |
| `/faq` | `faq` | `visit` |  |
| `/national-show/faq` | `faq` | `visit` | internal form |
| `/programme` | `programme` | `programme` |  |
| `/workshops` | `workshops` | `programme` |  |
| `/symposium` | `symposium` | `programme` |  |
| `/wosa-conference` | `wosa-conference` | `programme` |  |
| `/conferences` | `conferences` | `programme` |  |
| `/sa-exhibitors` | `sa-exhibitors` | `exhibit-trade` |  |
| `/international-guests` | `international-guests` | `exhibit-trade` |  |
| `/exhibitors` | `exhibitors` | `exhibit-trade` | not sa-exhibitors: segment boundary |
| `/vendors` | `vendors` | `exhibit-trade` |  |
| `/vendors/apply` | `vendors` | `exhibit-trade` |  |
| `/tickets` | `tickets` | none |  |
| `/tickets/confirmation` | `tickets` | none |  |
| `/national-show/tickets` | `tickets` | none |  |
| `/sponsors` | `show-sponsors` | none |  |
| `/archive` | `past-shows` | none |  |
| `/contact` | `contact` | none |  |
| `/faqs` | none | none |  |
| `/privacy` | none | none |  |

### Matcher rows

| pathname | href | current? | note |
|---|---|---|---|
| `/` | `/` | yes | home is exact only |
| `/about` | `/` | no | home never matches a child route |
| `/about` | `/about` | yes |  |
| `/about/` | `/about` | yes | trailing slash ignored |
| `/about/team` | `/about` | yes | parent of a child route |
| `/aboutus` | `/about` | no | segment boundary, not a string prefix |
| `/eventsfoo` | `/events` | no | the old startsWith() matched this |
| `/about?x=1` | `/about` | yes | query on the pathname ignored |
| `/tickets` | `/national-show/tickets#ticket-day` | yes | hash on the href ignored; internal href matches public NOS path |
| `/ABOUT` | `/about` | no | routing is case-sensitive |
| `null` | `/about` | no |  |
| `(empty)` | `/about` | no |  |
| `/` | `/national-show` | yes | NOS hub: public form |
| `/national-show` | `/national-show` | yes | NOS hub: internal form (host-less dev origin) |
| `/national-show` | `/` | yes | internal hub path equals the public hub href after normalising |
| `/faq` | `/national-show/faq` | yes | public pathname, internal href |
| `/national-show/faq` | `/faq` | yes | internal pathname, public href |
| `/national-show/faq` | `/national-show/faq` | yes |  |
| `/faq` | `/national-show` | no | hub is exact only |
| `/about` | `https://nos.saoc.co.za/` | no | absolute (cross-site) hrefs are never current |
| `/about` | `//nos.saoc.co.za/about` | no | protocol-relative hrefs are never current |

## Verification (what each layer proves)

| layer | proves | does not prove |
|---|---|---|
| `check-nav-current.mjs`, `check-route-focus.mjs` | the two pure cores against the tables above (a string-prefix matcher fails them: negative control run) | that the components call them |
| `check-focus-static.mjs` (nine modes) | no ring/outline on a nav/footer link in the five TSX files or the NOS CSS; every SAOC link has the underline, UA-outline reset and forced-colors fallback; aria-current present and driven by the shared matcher; keepers still ringed; tokens only | how it looks |
| `check-contrast.mjs` | indicator token pairs are at least 3:1 | that the indicator is drawn |
| `check-scope.mjs` | skip links, fields, nav data untouched; nothing outside the allow-list changed | |
| `pnpm type-check`, eslint on touched files | it compiles and lints | behaviour |
| Codex review (`codex-qa-prompt.md`) | adversarial read of the whole diff | rendering |
| BrowserAgent on the deployed hosts | focus lands on the h1 after a real click (desktop, mobile menu, NOS drawer); Tab shows the underline and no ring; aria-current in the accessibility tree; buttons still ringed; skip link unchanged | |

There is no email in this change, so the `gws_inbox_check` is declared non-required only to satisfy the triad coverage linter and is expected to skip
(Athanor#1467). The two browser manifests are written by the BrowserAgent run after deploy, bound to the deployed commit; they cannot exist
before deploy and are not faked. `.agent/memory/scratch/nav-focus-browser-saoc-manifest.json` (origin `https://beta.saoc.co.za`) and
`.agent/memory/scratch/nav-focus-browser-nos-manifest.json` (origin `https://nos.saoc.co.za`, selected by `checks/browser-nos-origin.sh`).

### Browser protocol (per host, desktop 1440 and mobile 375)

1. Mouse-click a header nav link (and, on mobile, open the menu and click a link; on NOS also a disclosure-panel link): after navigation
   `document.activeElement` is the new page's h1 (`tabindex="-1"`), and the screenshot shows no box anywhere, none on the h1.
2. Press Tab from the h1: the next stop shows the underline (2px, in the active slot), no ring. Repeat on an active item: the 1px bar is 2px.
3. Accessibility tree: the current item has `current=page`; on a child route the parent does too; NOS triggers show `current=true`; `/eventsfoo`-like
   paths mark nothing (use `/societies/<slug>` and `/vendors/apply`).
4. Footer links: Tab to one: underline, no outline.
5. Still ringed: search button, hamburger, Close, Tickets CTA, Menu button, newsletter field and button, brand lockup.
6. Skip link: first Tab shows it; Enter lands on `<main>`; behaviour unchanged.
7. Emulate `forced-colors: active` if the browser tool allows; record it as a gap in the manifest notes if not.
