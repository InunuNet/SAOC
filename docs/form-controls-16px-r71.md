# Form controls — 16px text everywhere (r71, 2026-10-23)

iOS Safari zooms the page when it focuses a text field whose font is smaller than 16px. r55 fixed the NOS
forms inside `.nos-theme` and r70 fixed the `/societies` search and the SAOC footer email. Codex then
flagged `SubmitEventForm` at `text-sm`; this round sweeps every remaining sub-16px text control.

| control | before | after | box |
|---|---|---|---|
| `/events/submit` form, 8 controls (`components/events/SubmitEventForm.tsx`) | 14px | `text-[16px] leading-5` | 38 / 39 / 98px, unchanged; the select also gets `h-[39px]` because it ignores line-height and would grow to 42px |
| `/admin/login` email and password (`app/admin/login/LoginFormFields.tsx`) | 15px | `text-[16px] leading-[23.25px]` | 45.25px, unchanged |
| admin table search (`components/admin/table/TableToolbar.tsx`) | 14px | `text-[16px]` | fixed `h-11` (44px), unchanged |
| vendor drawer read-only links (`VendorPaymentLinkControl`, `VendorPhotoLinkControl`) | 11px mono | `text-[16px] leading-[17.05px]` | unchanged |

Per-component classes, not a global base rule: the causes are unrelated, and a base rule would also move
controls that are already correct and shift their line-heights. Each change pins line-height (or, for the
admin table search, relies on its fixed `h-11`) so no box height moves (checked against a hash-locked
baseline, 0.5px tolerance).

## How it is checked

Spec and checks: `.agent/memory/project/specs/form-controls-16px-r71/`.

- **Rendered**, public and preview builds at 390: every text control on every sitemap route, the golden
  route list, a ticket page and the header search dialog must compute to at least 16px with its box height
  unchanged.
- `/events/submit` shows its form to a member session only. The check does not forge a member session; it
  server-renders `SubmitEventForm` and loads it in Chromium under the real built CSS.
- Admin: `/admin/login` renders for real, signed out. The other admin screens render through the local
  `/admin-fixtures` pages (static data, no sign-in), enabled only on the check server.
- The two vendor link controls mount only after an authenticated request, so they are covered by the
  **static** check alone. That check classifies every control-bearing `.tsx`, so a new component with a
  sub-16px control fails until it is classified.
