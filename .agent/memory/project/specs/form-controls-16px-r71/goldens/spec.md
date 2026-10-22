# r71 - every text control at 16px (sweep)

## Ruling (Codi, design lead, final authority; verbatim, .tmp/sandbox/queue/r71-ruling.md)

"r71: yes, and make it a sweep, not a single fix. Every text input, select and textarea on public routes (including /events/submit) and on admin routes (door staff use phones) gets >=16px. Add a rendered gate assertion: at 390, no visible form control computes font-size <16px on the routes it walks, so this class can't come back (craft-floor mobile input; audit responsive). No visual change other than the font size; keep the box heights."

## Inventory at base 85cf0814 (measured, 390px, public and preview builds identical)

| control | file:line | size | height | where |
|---|---|---|---|---|
| 8 controls: title, kind (select), date, endDate, venue, location, description (textarea), hostSocietyId | components/events/SubmitEventForm.tsx:164,181,204,221,237,254,271,288 | 14px (text-sm) | 38 / select 39 / textarea 98 | /events/submit (member session only) |
| email, password | app/admin/login/LoginFormFields.tsx:44,60 (inputClass :19) | 15px | 45.25 | /admin/login |
| search | components/admin/table/TableToolbar.tsx:36 | 14px | 44 (h-11) | /admin/tickets, /admin/vendors, /admin/vendors/applications |
| read-only payment link | components/admin/VendorPaymentLinkControl.tsx:37 | 11px mono | not renderable (mounts after an authenticated POST) | /admin/vendors drawer |
| read-only photo link | components/admin/VendorPhotoLinkControl.tsx:34 | 11px mono | not renderable (same) | /admin/vendors drawer |

Already 16px, no change: SocietiesClient, SAOC footer email (r70), ContactForm, SuggestionForm, SearchOverlay, DoorScannerClient. All NOS controls (tickets, vendor forms, NOS footer) carry their own text-[15px]/[14px] but sit inside `.nos-theme`, where the unlayered r55 rule in national-show/nos-theme.css sets var(--body-md) = 16px; the rendered walk proves it for every NOS route.

## Decision: per-component classes, not a base rule

The five causes are unrelated (a Tailwind text-sm form, a login inputClass, an admin toolbar, two admin link boxes). Each already follows the r70 idiom: an explicit `text-[16px]` in the class string. A scoped base rule (`input, select, textarea { font-size: ... }` in globals.css) would also move every control that is already correct and would change line-heights, so box heights would shift on controls nobody asked about; it adds a global style the NOS r55 rule already duplicates. The r55 base rule stays for NOS only.

## Box heights

Raising the font raises the inherited line-height (body 1.55) and moves a box that is not fixed-height. So the line-height is pinned to the value the control had:
- SubmitEventForm: `text-sm` was 14px/20px, so `text-[16px] leading-5` (20px) keeps 38px. The select ignores line-height and grows to 42px at 16px, so it also takes `h-[39px]` (its base height).
- LoginFormFields: 15px x 1.55 = 23.25px, so `text-[16px] leading-[23.25px]` keeps 45.25px.
- TableToolbar: fixed `h-11`, so only `text-[16px]`.
- Link controls: 11px x 1.55 = 17.05px, so `text-[16px] leading-[17.05px]` keeps the box.
No colour, spacing, token or new CSS. No file outside the five.

## What the checks prove, and what they cannot

- Rendered (A7, A8): production builds in public and preview, 390px, every route in goldens/edits.json plus every sitemap path plus one ticket page, the header search dialog, /admin/login (real, unauthenticated), and the admin screens through `/admin-fixtures/[route]` (static fixture data; `ADMIN_FIXTURES=1` is set only on the local check server; no sign-in, no credentials, no auth bypass in the app). Every visible text-entry control must compute >= 16px and match its goldens/heights-base.json height (captured from the unmodified base render) within 0.5px.
- `/events/submit` shows its form to a member session only, which the checks never forge. The walker server-renders SubmitEventForm and loads it in the browser under the real built stylesheets and real html/body classes from /contact. This proves the component's computed style, not the route's session gate.
- The two admin link inputs are read-only and mount only after an authenticated POST. They are covered by static.mjs only (resolved className >= 16px, pinned leading); their rendered height is not measured. DoorScannerClient's scan input renders in the fixtures and is walked.
- Admin routes not in the fixtures (`/admin/newsletter` and anything added later) are covered by static.mjs: goldens/controls.json must classify every control-bearing file, so a new component fails A3 until someone classifies it.
- Gated token pages (`/national-show/vendors/register` with a code, `/vendors/payment`, `/vendors/photos`) render their gate or code-entry form without a token; their token-only forms are NOS-scoped and covered by the r55 rule plus static S3.
