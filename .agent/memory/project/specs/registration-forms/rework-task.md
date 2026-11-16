# Dev brief: registration form rework (Brad's review of PR #195, 16 Nov 2026)

You are the dev. This brief is self-contained. Read `spec.md` section 9 for the why; this file is the what.
Never edit the goldens or the contract. Do not touch main, do not push, do not open PRs, do not touch Sanity or Firestore data.

## Base
Branch `feat/registration-forms` at `a7fbd5f3` (worktree `/Users/vetus/ai/SAOC/.claude/worktrees/registration-forms`). Commit your work on that branch (conventional commits, `feat:` / `fix:`), nothing else.
The goldens live (read-only) in `/Users/vetus/ai/SAOC/.agent/memory/project/specs/registration-forms/goldens/` on the memory branch; copy the folder into the worktree at the same relative path `.agent/memory/project/specs/registration-forms/goldens/` (and `contract.yaml` beside it) so the gate commands resolve, but do not commit changes to them. Then copy `goldens/registration-form.spec.ts` to `e2e/registration-forms.spec.ts` unchanged (assertion A8 compares them with `cmp`).

## Hard rules
- No invented brand assets: no new colours, fonts, icon families. Use existing tokens and field components (`TicketFormField.tsx` patterns, `--ink-700`, `border-rule`, `bg-ivory`).
- TypeScript strict, no `any`, Server Components by default (everything under `components/tickets/Registration*` is already client). `lib/registration.ts` stays client-bundle-safe (no firebase-admin).
- Firestore builders never leave `undefined` own-properties (`dietaryOther` is `null` when unused).
- One rule set: the browser and `validateRegistrationGroup` call the same functions in `lib/registration.ts`. No second copy of any regex or combination rule in a component.
- Untouched, byte-identical to the merge-base with origin/main: `lib/ozow.ts`, `lib/payfast.ts`, `lib/payments/`, `lib/ozow-sandbox-test-mode*.ts`, `lib/payment-mode.ts`, `app/api/tickets/itn`, `ozow-itn`, `ozow-sandbox-test-mode`, `lib/confirmation-email.ts`, `lib/ticket-pdf.ts`, `app/api/tickets/pdf`, `emails/`. No dietary or mobile in any email or PDF.
- Where Brad named labels use them verbatim: "Select all that apply", "Other", "Available as a show judge". Labels Brad did not name come from the sheet (registration-fields.json).

## Files to touch
1. `lib/registration.ts` (the validation and data core)
2. `components/tickets/registrationDraft.ts` (draft state, mapping controls to stored fields, errors)
3. `components/tickets/useRegistrationForm.ts` (state handlers: defaults, clearing, society exclusivity)
4. `components/tickets/RegistrationAttendeeFields.tsx` (the attendee form)
5. `components/tickets/TicketFormField.tsx` (select chevron padding, shared by every select)
6. New `components/tickets/SocietyDropdown.tsx` (the membership multi-select), used by 4
7. `components/tickets/RegistrationSection.tsx` only if the handler props change
8. `app/api/admin/export-csv/route.ts`, `components/admin/TicketsTable.tsx`, `app/admin/(shell)/tickets/page.tsx` (dietary Other display, and `dietaryOther` in the view type)
9. `e2e/registration-forms.spec.ts` (the unchanged golden copy)
`app/api/tickets/checkout/route.ts` should need no change (it calls `validateRegistrationGroup` and writes `buildRegistrationDoc`). If you find you must change it, say why in your result. `app/ticket-fixtures/buy/page.tsx` already has `?type=registration`; change it only if the e2e needs something it lacks.

## Behaviour

### lib/registration.ts
- `REGISTRATION_OPTIONS` must equal `goldens/registration-fields.json` `options` for every key there. New or changed: `dietary` = None, Vegetarian, Halaal, Other; `judgeAccreditation` = `['No', ...judgeOrganisation.filter(o => o !== 'Not applicable').map(o => 'Yes, with ' + o)]` (derive it, do not type it); `judgeYesNo` = Yes, No; `judgeDateChoices` = 22-Sep, 23-Sep. Keep `judgeYesNoNa`, `judgeOrganisation`, `judgeDate` (they describe stored values).
- `RegistrationPerson` / `RegistrationDoc` gain `dietaryOther: string | null`; `buildRegistrationDoc` writes it directly after `dietary` (`person.dietaryOther ?? null`). Key order is pinned by `firestore-registration-shape.json`.
- `EMAIL_PATTERN`: replace with the stricter rule in `registration-fields.json` `validationRules.email` (no doubled/leading/trailing dots in the local part, local part at most 64, domain labels with inner hyphens only, final label letters only and at least 2 long, no spaces, one @, at most 254 total). Export a function (e.g. `isValidEmail`) the client reuses.
- Mobile: export `isValidMobile(value)` per `validationRules.mobile`; `mobileField` uses it. Message: "Please enter a valid mobile number, including the country code." (SA local numbers starting 0 are accepted).
- Judge fields: replace the six independent dropdown checks by one function enforcing exactly the three canonical combinations in `registration-fields.json` `rework.storedJudgeCombinations`. Missing values report "Please choose an option." on that field; a value outside the combination reports "Please choose from the list." on that field. Error keys are the stored field names (`people.{i}.judgeDate` etc.). Dates without availability fail on `judgeDate`; availability for a non-judge fails on `judgeAvailable`; `judgeOrganisation` must be SAOC or AOS for judges and "Not applicable" otherwise.
- `dietaryOther`: required (trimmed, 1 to 100 chars) when `dietary` is Other; any non-empty text with another dietary value is an error on `dietaryOther`; stored `null` otherwise. Absent, null and empty all count as "no text".
- Export `formatDietary(registration: { dietary?: string; dietaryOther?: string | null }): string` returning `Other: <text>` when dietary is Other and text exists, otherwise `dietary` (or `''`).
- `attending` stays validated against `ATTENDING_BY_TICKET` exactly as today.
- Keep society rules exactly as today: at least one, all from the list, None cannot combine. Add nothing else (the combinations beyond None are an open question to Lee-Ann; cases pin them valid).

### Form state (registrationDraft.ts, useRegistrationForm.ts)
- `emptyDraft()` defaults: `country: 'South Africa'`, `province: ''`, `judgeAccreditation: 'No'`, `judgeAvailable: false`, `judgeDates: []` (22-Sep / 23-Sep ticks), `judgeCommunication: 'No'`, `judgeForum: 'No'`, `dietary: 'None'`, `dietaryOther: ''`. Drop `judgeOrganisation`, `judgeAvailable` (string) and `judgeDate` from the draft.
- `draftsToPeople` maps controls to the stored fields per `rework.uiToStored` and `rework.storedJudgeCombinations`: not accredited gives the not-accredited combination whatever the hidden controls hold; accredited and not available gives No and None; accredited and available gives Yes and 22-Sep, 23-Sep, or "22 & 23 Sept" (both ticked, none ticked stays empty so validation reports it on `judgeDate`). `dietaryOther` is sent only when dietary is Other, else null. `attending` is still derived from the ticket slug.
- Error mapping: server keys `judgeAccredited`, `judgeOrganisation` surface on the accreditation select; `judgeAvailable` on the availability checkbox; `judgeDate` on the date group; unchanged otherwise. Keep the error summary naming (extend `SUMMARY_FIELD_NAMES` for the date group and "Other dietary requirement"). Summary targets must point at a focusable element (the societies target is the dropdown button).
- Handlers clear what is hidden: country away from South Africa clears province; accreditation to No clears availability, dates, communication and forum back to defaults; availability unticked clears the dates; dietary away from Other clears `dietaryOther`. Same as above contact ticked then unticked restores `country: 'South Africa'` and empties mobile and province; membership ticked then unticked empties societies.
- Society exclusivity unchanged (choosing None clears the rest, choosing another clears None).

### RegistrationAttendeeFields.tsx (ids `registration-{n}-{key}`, see the e2e header for the full contract)
- Remove the Attending field and the NATIONAL SHOW BOOKING OPTIONS heading entirely.
- Personal block, desktop layout (`sm:` breakpoint and up; single column below): row 1 Title, First Name, Surname; row 2 Preferred name, Email; "Same as above" (attendees 2+) then Mobile on its own row; Country and Province share a row (Province only when country is South Africa). Same-as-above ids and behaviour unchanged.
- Membership: `SocietyDropdown` replaces the checkbox grid. A disclosure button `id=registration-{n}-societies` with `aria-expanded`, `aria-controls`, `aria-haspopup` not needed (it is a disclosure, not a menu). Closed text: "Select all that apply" when empty, the option name when one, "N selected" when more. Open: a panel directly after the button in DOM order, `role="group"` with the sheet label as its accessible name, containing the 25 native `<input type="checkbox">` with labels (reuse the existing checkbox and 44px label classes). Escape closes and returns focus to the button; a click outside closes; focus stays inside the panel while tabbing through it. Show the visible label above the button and the field error (`registration-{n}-societies-error`) below it, with `aria-describedby`/`aria-invalid` on the button. Hidden entirely when Same as above (membership) is ticked.
- Judges block (heading JUDGES EVENTS): accreditation select (label "Are you an accredited Orchid Judge", options from `judgeAccreditation`, default No). Only when the value starts with "Yes": the checkbox "Available as a show judge" (`...-judgeAvailable`); when ticked the group "Which date would you be available?" (`role=group`, two checkboxes labelled 22-Sep and 23-Sep, ids `...-judgeDate-22-sep` and `...-judgeDate-23-sep`); Judges Communication and Judges Forum selects (labels from `REGISTRATION_LABELS`, options Yes/No, default No) side by side on desktop.
- Dietary: select (default None) and, only while Other is selected, a text input id `...-dietaryOther`, label "Other", `maxLength` 100, required.
- Keep `required` and `aria-invalid`/`aria-describedby` wiring; keep the existing error alert component.

### TicketFormField.tsx (TicketSelectField)
Selects use `appearance-none`, `pr-10` (computed padding-right at least 36px) and their own chevron: an inline SVG or CSS-drawn chevron in `currentColor`/the ink token, absolutely positioned about 14px from the right edge, `pointer-events-none`, `aria-hidden`. Wrap the select in a `relative` container. This applies to every select in the ticket forms (the golden measures computed style). Do not change the text input class.

### Admin and CSV
- `TicketRegistrationView` gains `dietaryOther: string | null`; the page's `registrationView()` fills it; the drawer's Dietary row and the CSV `dietary` column both render `formatDietary(...)`. CSV header string unchanged (A10). Not on the door screen.

## Docs
There is no feature doc for this in the PR. Add `docs/registration-forms.md` (short: what the form collects, the merged-control to stored-field mapping table from spec.md 9.1 and 9.2, validation rules, where it is shown) in the same commit as the code.

## Gate (run these from the worktree root; the lead runs the long ones in the background)
```
pnpm exec tsx .agent/memory/project/specs/registration-forms/goldens/check_registration.mts options
pnpm exec tsx .agent/memory/project/specs/registration-forms/goldens/check_registration.mts cases     # 109 cases
pnpm exec tsx .agent/memory/project/specs/registration-forms/goldens/check_registration.mts shape
pnpm exec tsx .agent/memory/project/specs/registration-forms/goldens/check_registration.mts unflagged
pnpm exec tsx .agent/memory/project/specs/registration-forms/goldens/check_registration.mts wiring
cmp -s .agent/memory/project/specs/registration-forms/goldens/registration-form.spec.ts e2e/registration-forms.spec.ts
mkdir -p .tmp/sandbox/fx-empty/log && TICKET_FIXTURES=1 SANITY_FIXTURE_MODE=replay SANITY_FIXTURE_DIR=.tmp/sandbox/fx-empty SANITY_FIXTURE_LOGDIR=.tmp/sandbox/fx-empty/log NEXT_PUBLIC_SAOC_SITE_URL=http://localhost:3999 NEXT_PUBLIC_NOS_SITE_URL=http://nos.localhost:3999 SAOC_E2E_DYNAMIC_PORT=3999 pnpm exec playwright test e2e/registration-forms.spec.ts --reporter=line
bash .agent/memory/project/specs/registration-forms/goldens/check_untouched.sh lib/ozow.ts lib/payfast.ts lib/payments lib/ozow-sandbox-test-mode.ts lib/ozow-sandbox-test-mode-shared.ts lib/payment-mode.ts app/api/tickets/itn app/api/tickets/ozow-itn app/api/tickets/ozow-sandbox-test-mode
bash .agent/memory/project/specs/registration-forms/goldens/check_untouched.sh lib/confirmation-email.ts lib/ticket-pdf.ts app/api/tickets/pdf emails
grep -q formatDietary app/api/admin/export-csv/route.ts && grep -q formatDietary components/admin/TicketsTable.tsx
pnpm type-check
pnpm exec eslint lib/registration.ts lib/checkout-reservation.ts app/api/tickets/checkout/route.ts app/api/admin/export-csv/route.ts components/tickets components/admin/TicketsTable.tsx
```
All must exit 0 before you report done. Do not weaken or edit a golden to make it pass; if a golden looks wrong, stop and report the case id and why.

## Report
Write `.agent/memory/scratch/dev-registration-forms-rework-result.md`: commit sha, files changed, each gate command with its exit code, and anything you could not settle from this brief (name it, do not invent).
