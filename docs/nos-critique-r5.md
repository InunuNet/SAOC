# nos-critique-r5

Class-only changes. No copy string is added, removed or changed.

## F1 — 60ch prose measure on vendors and exhibitors

Measured on the ee366553 build at 1280px: vendors VendorIntro paragraphs 80.9ch (74.1ch at 768),
the VendorEmptyState paragraph 64.7ch; exhibitors key-dates note and entry-form paragraph 80.9ch,
every ExhibitorSection and ExhibitorSteps paragraph 80.9ch, the status-marker paragraphs up to 93ch
and the 12px step captions 128ch. The cause is `max-w-3xl` (768px) at 16px inside shared components.

The components are shared, so the cap is applied from the page: one class, `[&_p]:max-w-[60ch]`,
added once to the existing 1280px content container of each page
(`app/(marketing)/national-show/vendors/page.tsx` and `.../exhibitors/page.tsx`). The variant
selector (specificity 0,1,1) beats `max-w-3xl` and `max-w-xl` (0,1,0). It targets `p` only, never
li, ul, ol, td, dd, dt or the content-state wrapper, so grid cards, the steps list, the key-dates
table and the vendor grid keep their tracks. The hero lede sits outside the container and is
already within 58ch. The vendors CTA band is outside the container and untouched; it belongs to F3.

Known limit: a Portable Text bullet list inside an ExhibitorSection body would not be capped. None
exists in the current data.

## R52 — FAQ jump chips

NOS Design ruling R52: chips get a 1px `--primary` (royal) border, transparent fill and ink text,
with the bone fill appearing on hover and focus-visible; status badges stay low-tint with no hover.
Type is 14px sentence case, Karla 600-700, tracking 0 (R35).

Tokens used, all existing: `--primary` (border, via `--border-primary: 1px`), `--ink` (text),
`--bone` (hover and focus-visible fill), `--ring-focus` (focus ring, unchanged).

R52 supersedes these r4 pins in `components/show/ShowFaqList.tsx`:
- rest fill `bg-bone` becomes `bg-transparent`; bone only as `hover:bg-bone` and `focus-visible:bg-bone`;
- text `text-primary` becomes `text-ink`; `hover:text-accent` removed;
- adds the 1px `--primary` border (44px minimum height unchanged);
- adds `tracking-normal`;
- transition widens from `[color]` to `[color,background-color]`; never outline-color, border-color or `all`.

Unchanged: nav and aria-label, ids, wrapping, 44px targets, pill radius, focus ring, scroll margin,
and the per-answer ConfirmationBadge.
