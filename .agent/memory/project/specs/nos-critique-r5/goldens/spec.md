# nos-critique-r5 — golden spec for @dev (F1 60ch measure, F2 R52 chips)

Worktree `.tmp/sandbox/critique-r5/` (branch fix/nos-critique-r5, base ee366553, r4 merged).
Checks live in `contracts/checks/nos-critique-r5/` and are hash-locked (`checks.sha256`); do not edit them.
NO INVENTION: both features are class-only. No copy string is added, removed or changed.

## Footprint (check-footprint.mjs)
- F1: `app/(marketing)/national-show/vendors/page.tsx`, `app/(marketing)/national-show/exhibitors/page.tsx`.
- F2: `components/show/ShowFaqList.tsx`.
- Both: `docs/nos-critique-r5.md` and the r5 checks.
- Off limits: the vendors CTA (`<CtaBand …/>` is F3's; byte-identical, A3 pins it), vendors apply/register/payment/photos subroutes, ShowContentState, the hub, tickets, nos-theme, Header, Footer, globals.css, every shared component other than ShowFaqList (VendorIntro, VendorGrid, VendorEmptyState, Exhibitor* and StatusMarker are NOT edited; the cap is applied from the page).

## F1 — 60ch prose measure on /national-show/vendors and /national-show/exhibitors

Measured on the ee366553 build (r4 worktree): vendors VendorIntro paragraphs 80.9ch at 1280 (74.1ch at 768), the VendorEmptyState paragraph 64.7ch; exhibitors the key-dates note and entry-form paragraph 80.9ch, every ExhibitorSection and ExhibitorSteps paragraph 80.9ch, the ※ status-marker paragraphs up to 93ch and the 12px step captions 128ch. The cause is `max-w-3xl` (768px) at 16px; the components are shared and off limits, so the cap is a page-local descendant variant (the r2 what-to-expect precedent, `[&_p]:max-w-[60ch]`).

One class, added once per page, on the existing 1280px content container, and nothing else:

| file | container className (before -> after) |
|---|---|
| vendors/page.tsx | `mx-auto max-w-[1280px] px-8 py-16 space-y-16` -> `mx-auto max-w-[1280px] px-8 py-16 space-y-16 [&_p]:max-w-[60ch]` |
| exhibitors/page.tsx | `mx-auto max-w-[1280px] space-y-12 px-8 py-16` -> `mx-auto max-w-[1280px] space-y-12 px-8 py-16 [&_p]:max-w-[60ch]` |

Why this is enough and safe:
- The variant selector (`.[&_p]… p`, specificity 0,1,1) beats `max-w-3xl` / `max-w-xl` (0,1,0) on the paragraphs, and `mx-auto` on the empty-state paragraph still centres it.
- It targets `p` only. Never li, ul, ol, td, dd, dt or `[data-nos-content-state]` (the critique-r1 Codex P2 lesson): the exhibitor question cards, the steps list, the key-dates table and the vendor grid keep their tracks. A paragraph inside a card narrower than 60ch is unaffected.
- The hero lede is outside the container and already 34ch at 1280 (<= 58ch).
- The vendors CtaBand sits outside the container, untouched.
- Known limit, accepted: a Portable Text bullet list in an ExhibitorSection body would not be capped (an li selector is forbidden). None exists in the current data; the rendered check measures every prose li and would flag one.

## F2 — R52, restyle the r4 FAQ chips (`components/show/ShowFaqList.tsx`)

NOS Design ruling R52, verbatim: "Change the chips to a 1px --primary (royal) border, transparent fill and ink text, with the bone fill appearing on hover and focus-visible. The status badges stay low-tint, with no hover." and "Type: ratified. Use 14px sentence case, Karla 600–700, tracking 0 (R35: tracking follows case)."

Tokens (all existing, `app/(marketing)/national-show/nos-theme.css` `.nos-theme`):
- `--primary: #211a57` (royal; Tailwind `border-primary`), 1px width from `--border-primary: 1px` (nos-theme.css:288, the same pairing Button's ghost variant uses);
- `--ink: #211a57` (Tailwind `text-ink`);
- `--bone: #f3f2d6` (Tailwind `bg-bone`); page ground `--parchment: #fbfaf0`;
- ring `--ring-focus` (R9/3) unchanged; Karla via `font-sans` (`--font-sans: var(--font-nos-karla)`).
Contrast: ink on parchment and ink on bone both exceed 4.5:1 (the rendered check computes it from the resolved colours; ink and primary are the same hex so the border matches the text).

Replace the chip `<a>` className (the only edit) with exactly:

```
inline-flex min-h-[44px] items-center rounded-[length:var(--radius-pill)] border-[length:var(--border-primary)] border-primary bg-transparent px-3 font-sans text-[14px] font-semibold tracking-normal text-ink hover:bg-bone motion-safe:transition-[color,background-color] motion-safe:duration-150 focus-visible:bg-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]
```
(`goldens/ShowFaqList.reference.tsx` is the full file.) Changes from r4, each superseding an r4 pin ("R52 supersedes"):
- rest fill `bg-bone` -> `bg-transparent`; bone only as `hover:bg-bone` and `focus-visible:bg-bone`;
- text `text-primary` -> `text-ink`; `hover:text-accent` removed (text is ink in every state);
- adds the 1px `--primary` border (+2px on each chip's box; 44px min height unchanged);
- adds `tracking-normal` (R35: sentence case, tracking 0);
- transition list widens from `[color]` to `[color,background-color]` because the fill now fades. It must never list outline-color, border-color or `all`: the r4 focus-ring assertion (ring is the `--ring-focus` colour on the first frame) still holds and is re-asserted.

Unchanged: nav/aria-label, ids, `flex-wrap gap-2`, 44px targets, pill radius, `focus-visible:outline-*` ring, scroll-mt, per-answer `<ConfirmationBadge …/>` (byte-identical; it keeps `border-rule bg-parchment text-muted`, no hover).
Layout risk: the border adds 2px per chip; the 375 row limit (<= 2) must still hold. If it wraps to 3, tighten `px-3` to `px-2.5` or `gap-2` to `gap-1.5` and nothing else.

## Docs
`docs/nos-critique-r5.md`: F1 the measured before/after widths and the container-class rationale; F2 cite R52, the tokens used (`--primary` royal border, `--ink` text, `--bone` hover/focus fill) and the R52-supersedes list above; note the vendors CTA is F3.

## Checks (hash-locked)
check-footprint.mjs (`--through=1` / `--through=2`), check-static-f1.mjs, check-rendered-f1.mjs (375/768/1280 + 360), check-static-f2.mjs, check-rendered-f2.mjs (320/375/768/1280; ports every r4 rendered assertion and adds the R52 box, state, contrast and badge assertions). Static checks are red on ee366553 and green on the reference implementations.
