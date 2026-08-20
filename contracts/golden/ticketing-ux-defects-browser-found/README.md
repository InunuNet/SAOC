# Browser-found /tickets UX defects — decision record

A real BrowserAgent pass drove the RENDERED `/tickets` page (and the shared footer, and
the confirmation page) and reported four defects. This architect pass independently
reconfirmed every one of them live against the running dev server
(`http://localhost:3002`) before writing a single assertion — three reproduced exactly as
reported; one did not, and is scoped out below rather than faked into a green check.

---

## Item 2 does not reproduce — scoped out

**The reported defect:** "No loading or disabled state on 'Buy Ticket' during the
checkout POST — button stays fully active, no `aria-busy`, no disabled attribute, no
spinner."

**What the current source (`components/tickets/useTicketCart.ts`,
`components/tickets/TicketPurchaseForm.tsx`) already does:** `submit()` calls
`setStatus('submitting')` synchronously, before the `await fetch(...)`. The button's
`disabled={cart.status === 'submitting'}` and its label
(`cart.status === 'submitting' ? 'Redirecting to PayFast…' : buyButtonLabel`) already
exist and are wired to that state.

**Live verification performed while authoring this contract:** launched a real
Playwright Chromium instance against `http://localhost:3002/tickets`, intercepted
`POST /api/tickets/checkout` with `page.route(...)` to add an artificial 2–3s delay
before responding, filled a real attendee row, clicked "Buy Ticket", and polled
`document.querySelector('button[type=submit]')` directly (not a Playwright
`getByRole` locator scoped to the ORIGINAL button text — see the false-negative note
below) at 50ms, 150ms, 400ms, 1000ms, and 2000ms after the click:

```
at ~50ms:   {"text":"Redirecting to PayFast…","disabled":true}
at ~150ms:  {"text":"Redirecting to PayFast…","disabled":true}
at ~400ms:  {"text":"Redirecting to PayFast…","disabled":true}
at ~1000ms: {"text":"Redirecting to PayFast…","disabled":true}
at ~2000ms: {"text":"Redirecting to PayFast…","disabled":true}
```

The button disables and its label swaps within the first render after the click and
stays that way for the whole in-flight window. On response (a deliberately-forced 500 in
this test), `role="alert"` text appears with the server's error message, matching
`useTicketCart.ts`'s error-path handling.

**A first attempt at this same live check produced a false positive for the bug** —
worth recording so the mistake is not repeated: querying via
`page.getByRole('button', { name: 'Buy Ticket' })`, captured BEFORE the click, then
calling `.evaluate()` on that locator AFTER the click, reported `disabled: false, text:
"Buy Ticket"`. That locator's accessible-name selector (`name: 'Buy Ticket'`) stops
matching the instant the button's text changes to "Redirecting to PayFast…" — the
locator silently resolved to a stale/incorrect element rather than throwing. Re-querying
the DOM directly by tag/type (`button[type=submit]`), not by the very text that changes
under test, is what produced the correct, honest result above. This is recorded because
it is exactly the kind of self-deceiving harness bug this project's own
`.agent/memory/project/learned.md` warns about, just on the investigation side rather
than the assertion side.

**Conclusion:** item 2 as reported does not reproduce against the current tree. The most
likely explanation is that another concurrent session in this fleet already implemented
the disabled/label-swap behaviour before this architect pass ran (this repo has many
parallel dev/QA sessions active — see the teammate roster in this session). This
contract does NOT include a fix or assertion for item 2. The one genuine gap remaining —
no `aria-busy` attribute and no visible spinner icon, both accessibility/polish niceties
beyond "does the button visibly indicate it is busy" — is named here for the team lead
to decide whether it is worth a follow-up, but is deliberately NOT written into this
contract's scope, since fabricating an assertion for a property that was never
confirmed broken would be the same "assertion satisfiable by something that isn't the
real defect" mistake this project's audits already exist to catch, just aimed at a
non-existent target instead of a fake pass.

---

## Item 1 — no visible focus ring on `<input>` elements

**Confirmed live**, real Chromium, `http://localhost:3002/tickets`, 1440px viewport,
using a REAL `page.keyboard.press('Tab')` sequence from page load (not `element.focus()`
— see "Why a Tab keypress, not `.focus()`" below):

```
13 {"tag":"INPUT","type":"number","id":"ticket-type-qty-adult","outline":"none"}
14 {"tag":"BUTTON","ariaLabel":"Increase quantity of Adult","outline":"auto"}
```

and, after revealing an attendee row and continuing to Tab:

```
{"tag":"INPUT","id":"attendee-adult-0-name","outline":"none"}
```

Computed styles for the quantity input specifically: `outline: none`, `boxShadow: none`,
`borderColor: rgb(217, 215, 201)` both focused and unfocused — genuinely zero visible
change. The attendee name input DOES change `border-color` on focus (unfocused
`rgb(217, 215, 201)` -> focused an oklab value at roughly 40% opacity, from its existing
`focus:border-ink/40` class) — but that tint is the "confirmed by computed style and a
zoomed screenshot" evidence in the architect brief, not a fix; see "Why outlineStyle
specifically" below for why this contract does not treat that existing class as already
satisfying the defect.

### Why a Tab keypress, not `.focus()`

Found the hard way while authoring `check-input-focus-ring.mjs`: an early version of the
check called `element.focus()` (a JS method call) on the negative-control stepper
button, AFTER a prior mouse click elsewhere on the page (clicking "Increase quantity of"
to reveal the attendee row), and got `outlineStyle: "none"` back for a button that is
NOT in scope for this contract's fix and has never been touched. Chromium's
`:focus-visible` heuristic tracks recent input MODALITY: a real keyboard `Tab` keypress
always shows the native ring on the newly focused element regardless of prior mouse
activity, but a programmatic `.focus()` call after a mouse click is treated as
non-keyboard and suppresses it — even on an element whose CSS never asked for that. The
check now drives every focus move with `page.keyboard.press('Tab')` in a loop
(`tabUntil`, capped at 60 presses) until the target element is `document.activeElement`,
which is both the mechanism that actually reproduces "a keyboard-only buyer tabs to a
field" and the one that does not produce this false negative.

### Why outlineStyle specifically, not "any visible change"

A check that accepted `outline changed OR boxShadow changed OR borderColor changed`
would ALREADY PASS today, on the unmodified tree, for the attendee input specifically —
its border-color measurably differs on focus, even though the architect brief's own
zoomed-screenshot evidence is that this tint reads as invisible to a real user next to
the buttons' crisp native ring. That would be exactly this project's own repeatedly-
confirmed defect class: an assertion satisfiable by something that is not the real
property under test. The fix specified (delete `outline-none`, let the native ring
through — the SAME mechanism the buttons already use) is the only one this check
accepts, via `outlineStyle !== 'none'`.

### Fix — surgical deletion, no new design

`TicketFormField.tsx`'s `<input>` className currently reads:
`"...outline-none transition-colors focus:border-ink/40 disabled:opacity-60"`.
`TicketTypeCard.tsx`'s quantity `<input>` className currently reads:
`"...text-ink outline-none disabled:opacity-60"`. In both, delete the `outline-none`
token only. `focus:border-ink/40` stays (harmless, additive to the now-visible native
ring). No new Tailwind class, no new colour, no new focus-ring visual style — matching
the project's "No invented brand assets" rule and the architect brief's explicit
instruction to reuse the buttons' existing, working precedent rather than invent one.

---

## Item 3 — confirmation page crashes on a repeated `?ref=` query param

**Confirmed live**, real Chromium, `http://localhost:3002/tickets/confirmation?ref=A&ref=B`:

```
PAGEERROR: ref?.trim is not a function
bodyText: "This page couldn't load / A server error occurred. Reload to try again. / ERROR 4020101858"
HTTP status: 200 (Next dev's client-side error boundary; a production build returns a
real 500 for this exact route/query combination)
```

`app/(marketing)/tickets/confirmation/page.tsx` types `searchParams` as
`Promise<{ ref?: string }>` and calls `ref?.trim()` directly — a lie at runtime. Next.js
hands the page a real `string[]` for a repeated query key, and `.trim` is not a function
on an array.

### Why a named, exported pure function, not a live browser check of the page itself

This project's own convention (`contracts/checks/ticketing-multi-line-item-cart-ui/
check-confirmation-shows-all-positions.mjs`'s own header) is that a genuinely live,
rendered-page behavioural claim needs a real HTTP round trip against a running server —
which this architect pass does not run assertions against (no live Firestore/network in
a contract check). The fix specified (F2) extracts the guard into
`normalizeBookingRefParam(ref: string | string[] | undefined): string` — pure, zero
dependency, same shape as `parseLineItems()` in the sibling
`contract-ticketing-multi-line-item-cart`. Because a normalized `''` short-circuits the
page's EXISTING `bookingRef.length > 0 ? await getConfirmedOrderForDisplay(bookingRef) :
null` line, Firestore is never reached for the array case either before or after the
fix — this function alone is the complete, testable surface of the defect and its fix.

Correct behaviour is NOT "take the first array element and proceed" — the architect
brief is explicit that the array case must fall through to the SAME not-found/
`<ConfirmationPoller>` state the page already renders for an empty/missing ref, since a
repeated `?ref=` is not a value a legitimate PayFast redirect or confirmation-email link
would ever produce; treating it as "maybe still a valid ref, just take one" would let a
malformed or tampered URL silently probe for a real booking. `normalizeBookingRefParam`
therefore returns `''` for ANY non-string input (array of any length including empty,
and `undefined`), and `ref.trim()` for a genuine string — byte-identical to today's
`ref?.trim() ?? ''` for the only shape that has ever really occurred.

---

## Item 4 — footer overflows at 320px

**Confirmed live**, real Chromium, `http://localhost:3002/tickets`, 320px viewport:

```
{"footerScrollWidth":339,"viewportClientWidth":320,"bodyScrollWidth":339}
```

19px of horizontal overflow, page-wide (`document.documentElement.scrollWidth` also
339), reproducing the BrowserAgent's measurement exactly.

### Root cause: the inner row, not the outer bar

Isolated by measuring the footer's bottom bar in two pieces:

```
bottomBar (outer row):  scrollWidth=339 clientWidth=320 flexWrap="wrap"
linksDiv  (inner row):  scrollWidth=307 offsetWidth=307 flexWrap="nowrap"
copySpan  (copyright):  scrollWidth=256 offsetWidth=256
```

The OUTER bottom-bar row (`className="mx-auto flex ... gap-4 px-8 py-4 flex-wrap"`)
already carries `flex-wrap` and correctly wraps: the copyright text drops to its own
line at 256px (the available width inside the footer's `px-8` padding at a 320px
viewport). The INNER row of five legal links
(`<div className="flex items-center gap-4">` — Privacy/Terms/Refunds/Constitution/Media
kit) has NO `flex-wrap` of its own. At 307px wide against only ~256px available, that
inner row is the widest element in the footer and refuses to wrap internally, so IT
pushes the whole footer — and, on this page, the whole document — past the viewport.

### Fix — one additive `flex-wrap`, reusing the file's own existing pattern

`<div className="flex items-center gap-4">` becomes `<div className="flex items-center
gap-4 flex-wrap">` — the EXACT utility class the outer row one level up in the same file
already uses. No new breakpoint, no new class, no new token.

This is a shared, site-wide component (`components/chrome/Footer.tsx`), not scoped to
`/tickets` — the assertion is run against `/tickets` (the page named in the brief) but
the fix and its benefit apply everywhere the footer renders.

---

## Assertion inventory and defeating mutations

| ID | Proves | Kind | Negative control |
|----|--------|------|-------------------|
| A1 | Whole project type-checks after all changes | `pnpm type-check` | N/A — build-level gate |
| A2 | Quantity input and attendee input show a real, Tab-driven, visible focus outline; matches the stepper buttons' own unmodified native ring | behavioural, real Chromium, real `Tab` keypresses | same run's own stepper-button case — proves the fix does not regress a control it never touches |
| A3 | Footer causes no horizontal self-overflow at 320px, at both the footer element and the document | behavioural, real Chromium (`partners-cards` convention) | document-level check catches a fix that shrinks only the footer's own box without stopping page-wide scroll |
| A4 | `normalizeBookingRefParam` treats every array shape (2-element, 1-element, empty) as invalid, same as a missing ref; never throws | behavioural, pure fn | cases (3)/(4): a real (optionally whitespace-padded) single-string ref is unaffected — proves the fix does not regress the only shape that has ever really worked |
| A5 | `pnpm lint` passes with zero errors | lint | N/A — build-level gate |

## Red evidence — observed 2026-08-20, against the unmodified tree

- **A2** (`check-input-focus-ring.mjs`), run via `npx tsx
  contracts/checks/ticketing-ux-defects-browser-found/check-input-focus-ring.mjs` against
  the real, unmodified, running dev server (`http://localhost:3002`) — **exit 1**. Both
  the quantity input and the attendee name input reported `outlineStyle: "none"` after a
  real Tab keypress; the stepper-button negative control correctly reported `"auto"` (did
  NOT fail). This is a real, already-live UI defect, not code that doesn't exist yet —
  same category as the sibling contract's A7/A8, not the "module doesn't exist" category.

- **A3** (`check-footer-overflow-320.mjs`), same command pattern against the same live
  server — **exit 1**. `footerScrollWidth: 339 > footerClientWidth: 320` and
  `docScrollWidth: 339 > docClientWidth: 320`, both failing as expected. Also a real,
  already-live defect.

- **A4** (`check-confirmation-array-ref.mjs`) — **exit 1**, `SyntaxError: The requested
  module '../../../app/(marketing)/tickets/confirmation/page.tsx' does not provide an
  export named 'normalizeBookingRefParam'`. The expected, correct form of red for code
  that does not exist yet (same category as the sibling contracts' A2-A6) — and this
  error itself is proof the relative import path resolves correctly and the page module
  has no import-time side effect that would otherwise block this check (no Firestore/
  Sanity client construction throws merely from importing the module).

- **A1** (`pnpm type-check`): baseline captured on the unmodified tree, **exit 0**. This
  is the expected baseline for a build-level gate before any change is made.

## Mutation-discrimination pass — 2026-08-20, against real temporary implementations

Every new check was proven to DISCRIMINATE, not just RUN, by applying the real fix
directly to the real source files (not a stub), confirming green, then reverting and
confirming `git status --short` / `git diff --stat` showed zero residue on each file
before moving to the next:

- **A2**: deleted `outline-none` from both `TicketFormField.tsx`'s input className and
  `TicketTypeCard.tsx`'s quantity input className -> re-ran the check -> **exit 0**, all
  three `outlineStyle` values now `"auto"`. Reverted both files -> `git diff --stat`
  clean.
- **A3**: added `flex-wrap` to `Footer.tsx`'s inner legal-links row -> re-ran the check
  -> **exit 0**, `footerScrollWidth: 320 === footerClientWidth: 320`,
  `docScrollWidth: 320 === docClientWidth: 320`. Reverted -> `git diff --stat` clean.
- **A4**: added the real `normalizeBookingRefParam` export to `page.tsx` -> re-ran the
  check -> **exit 0**, "All cases passed." Then applied the specifically-named
  defeating mutation — an implementation that picks the array's first element
  (`Array.isArray(ref) ? ref[0] : ref`) instead of normalizing to `''` — re-ran -> **exit
  1**, cases (1) and (2) failed with `expected "", got "A"`, proving the check does not
  merely accept "any non-throwing behaviour" for an array input. Reverted the file
  completely -> `git diff --stat` clean.

`pnpm type-check` was re-run clean (**exit 0**) after every revert, confirming no
mutation left a stray change. `git status --short` at the end of this pass shows only
the new files under `contracts/` — no source file under `app/`, `components/`, or `lib/`
was left modified by any part of this exercise.

All live-browser evidence above (A2, A3, and the item-2 investigation) was produced
against the real, already-running local dev server at `http://localhost:3002` — no
staging/production deploy was touched. A4's evidence used `npx tsx` only, against a pure
function with zero external dependency — no live Firestore, no Sanity, no network call
was made in producing A4's evidence.
