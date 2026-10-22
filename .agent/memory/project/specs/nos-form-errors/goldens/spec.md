# nos-form-errors (rFE): both SAOC forms get the full per-field error pattern (architect, 2026-10-22)

BASE = origin/main 64cf1bd2. Branch fix/saoc-form-errors. Machine-readable twin: goldens/edits.json.

## Sources (NO INVENTION, docs/rules/no-invention.md)

Visual: `design/design_handoff_saoc/README.md:192` (contact form validation: name required, email regex, message at least 10
characters; errors show a red border and a message under the field), `design/design_handoff_saoc/src/styles.css:2120-2128`
(`.field.is-error input` border, `.field__err` below the field), `design/design_handoff_saoc/src/pages-show-events-contact.jsx:474-481`
(the validate function). The red is the ruled token `--color-error` (#9b2c2c, admin-redesign / r45 F3), not the prototype's #a43a3a, and
the message is the shared `TicketFieldAlert` (r45 F3, `components/tickets/TicketFormField.tsx`), per the rFE ruling. `branding/` carries no
form-error decision. Copy: only existing strings (below). No new colour, token, class string or prose.

Rulings (design lead Codi, verbatim):
- rFE: "Contact and Suggestion: yes, "every form" includes them. Keep r45 to the ticket forms so this PR stays focused. Put ContactForm and SuggestionForm onto the shared error-alert class in a follow-up round, rFE. Fold in my earlier P2s from route 30 (/members) and route 33 (/contact), the per-field errors with aria-invalid/describedby, so both SAOC forms get the full pattern at once."
- route 30 P2 (components/members/SuggestionForm.tsx): "the client guard checks only message length (l.39-44). An empty name or a bad email goes to the API, and the single role=alert message isn't tied to any field. Fix: per-field checks (name non-empty, email format, message >=10). On each invalid field set aria-invalid + aria-describedby -> its error id, and focus the first invalid field. Give the "Minimum 10 characters." hint (l.143) an id and add it to the textarea's aria-describedby. Reuse the existing/API error strings; no new copy (R7)."
- route 33 (components/contact/ContactForm.tsx): "ContactForm validates only the message (l.33). Add per-field name/email checks matching the /members ruling; SuggestionForm reuses ContactForm's wiring."
- saoc-82: the `--color-error` comment in app/globals.css becomes a shared-use comment (error alerts: door invalid banner, admin inline errors, ticket field alert; add the SAOC form alerts). "Change the comment only, never the value."

## Amendment (design lead Codi, copy ruling; supersedes the API-string choice below where they differ), verbatim

"yes, use the handoff strings. "Required" under an empty field and "Enter a valid email" under a bad email. They're existing approved design copy (pages-show-events-contact.jsx:476-478), so this isn't new copy and R7 holds. ... Keep the existing "at least 10 characters" message for the message field, since it's already field-specific. The API strings stay as the server fallback if a request slips past client checks. Checking an empty subject is right. The shared 14px alert size is fine on both sites."

Exact source: `design/design_handoff_saoc/src/pages-show-events-contact.jsx:476` (`'Required'`) and `:477` (`'Enter a valid email'`; its regex `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` is equivalent to the API's, either is accepted). Wherever the text below says `All fields are required.` or `Invalid email address.` for client validation, read `Required` and `Enter a valid email`. The API strings appear nowhere in the forms' source (static S4 fails them); they only reach the user at runtime as `data.error` in the form-level alert after a non-OK reply.

## Amendment 2 (design lead Codi, alert visual; team-lead, Codex FAIL on clear-on-edit)

Codi, verbatim: "On SAOC the alert renders as a grey filled band, about 48px tall and full field width, so each error box is as heavy as the field it belongs to. With four empty fields the form becomes a stack of grey bars (impeccable 4.4.0 critique.md: visual weight matches importance). My ruling was the left rule and text only, with no box. Remove the background, so the alert is transparent with the 2px left rule, the ⚠ and the text. Set its top margin to 4-6px under the field so it reads as belonging to it, and give it about 16px below before the next label. It's probably inheriting a SAOC alert background class; override that in the shared component so NOS and SAOC render the same."

Where the grey comes from (measured): `bg-bone` in `ALERT_CLASS` (TicketFormField.tsx, r45 F3). `--bone` is #e8e6dc on SAOC (app/globals.css:15) but the NOS theme remaps it to the card gold #f3f2d6, so on NOS the same fill is invisible. Together with `py-3` (12px each side) the box is about 44-48px.
Fix, in the shared class only (edits.json `alertClass` and the fourth `ticketFormField` substitution): `bg-bone` becomes `bg-transparent` and `py-3` becomes `py-0`, so the 2px rule hugs the text; nothing else about the class changes. NOS and SAOC then render the same because they are the same class (rendered check compares the computed styles). No CSS file is needed; the footprint is unchanged.
Geometry the rendered check measures (edits.json `geometry`): the previous sibling of the alert (input, hint or day options) to the alert top 4-6px (today `space-y-1.5` and `mt-1.5` give 6px); the alert bottom to the top of the next field's block 14-20px. NOTE for Codi: the form's `space-y-5` already puts 20px there (the label's text box, an inline element, sits about 7px lower, 27px). "About 16px" is accepted as 14-20 measured to the block, rather than forcing a negative margin that would crowd the next field closer than field-to-field spacing; if exactly 16 is wanted that is a separate decision.

Codex FAIL, as relayed: the field onChange handlers never clear that field's fieldErrors entry, so a corrected field stays aria-invalid with its alert and describedby until the next submit (ContactForm.tsx:124,148,171,197; SuggestionForm.tsx:130,154,180). Required: typing a valid value into a field removes that field's aria-invalid, its alert and its error id in aria-describedby; the other fields stay invalid; the message keeps its hint id. (Rendered check E.)

## Decision: how the SAOC forms reuse the alert

Import `TicketFieldAlert` from `@/components/tickets/TicketFormField` in both forms. The class stays defined once, in TicketFormField
(static S2 fails any copy of it). One change to that file: `TicketFieldAlert` takes an optional `id`, rendered on the `<p role="alert">`,
so an input's `aria-describedby` can name it (three exact substitutions, edits.json `ticketFormField`). Without an id the output is
byte-identical, so every ticket caller is unchanged. Not moved to a shared folder: moving it would touch the four ticket files r45 F3
pinned; an import from `components/tickets/` costs one line per form. Consequence the dev must accept: the alert is 14px (the shared
class), where the old SAOC alert was 16px with leading-[1.55]. That is the ruling ("onto the shared error-alert class").

## What the dev implements (both forms; Contact first, Suggestion mirrors it)

1. State: per-field error strings (empty = valid) replace `messageInvalid`; `errorMessage` keeps only the form-level cases (honeypot,
   non-OK reply, network). The submit handler order stays: busy guard, honeypot (no API call), then client validation, then fetch.
2. Client validation (all fields checked on every submit, trimmed): name empty -> `Required`; email empty -> `Required`, else failing `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (the API's regex, route.ts:21; the handoff's at jsx:477 is equivalent) -> `Enter a valid email`; ContactForm only: subject
   empty -> `Required` (Codi: checking an empty subject is right); message shorter than 10 trimmed
   characters -> the form's existing string (Contact: `Please write a message of at least 10 characters.`; Suggestion: `Please write a suggestion of at
   least 10 characters.`). If any field is invalid: set the errors, do not fetch, focus the first invalid field in DOM order
   (`document.getElementById(id)?.focus()` is enough), return.
3. Per field: `aria-invalid="true"` only while it has an error (absent otherwise, as the message field does today); `aria-describedby` = the
   field's error id while it has one, else absent; the message field keeps its hint: `aria-describedby` = hint id, plus the error id while
   invalid (SuggestionForm's hint gets an id: `msf-message-hint`). The error renders directly under the input as
   `<TicketFieldAlert id={errorId}>{error}</TicketFieldAlert>`. The input takes the error border while invalid (Tailwind `aria-invalid:border-error`
   appended to the input class, or equal): the handoff's `.field.is-error input` in the token colour.
4. Ids: Contact `cf-name-error`, `cf-email-error`, `cf-subject-error`, `cf-message-error` (existing const), hint `cf-message-hint`, form-level
   `cf-form-error`; Suggestion `msf-name-error`, `msf-email-error`, `msf-message-error`, `msf-message-hint`, `msf-form-error`.
5. The form-level case (honeypot, non-OK reply, network) renders `<TicketFieldAlert id={formErrorId}>`, above the submit button, as the old
   alert did. No field is aria-invalid for it.
6. Untouched: the honeypot, `noValidate`, the fetch call and its body line (still no `_hp`), the success panel, the input class
   (`rounded-sm` etc.; only the invalid variant is added), labels, placeholders, hint text, the pages, the API route.
7. `app/globals.css`: the `--color-error` comment only. `components/tickets/TicketFormField.tsx`: the `id` prop only.
8. `docs/nos-form-errors.md`: the pattern, the string sources and the 16 -> 14px note (static S6 lists the required mentions).

## Copy table (each string, its source; nothing invented)

| field | when | string | source |
|---|---|---|---|
| name, email, subject | empty | Required | design/design_handoff_saoc/src/pages-show-events-contact.jsx:476 |
| email | not empty, fails the regex | Enter a valid email | design/design_handoff_saoc/src/pages-show-events-contact.jsx:477 |
| form-level (non-OK reply) | server `data.error` | the API's own text (e.g. All fields are required. / Invalid email address., app/api/contact/route.ts:16, :23) | server fallback only, not in the forms' source |
| message (Contact) | under 10 characters | Please write a message of at least 10 characters. | components/contact/ContactForm.tsx:36 |
| message (Suggestion) | under 10 characters | Please write a suggestion of at least 10 characters. | components/members/SuggestionForm.tsx:42 |
| hint | always | Minimum 10 characters. | ContactForm.tsx:162, SuggestionForm.tsx:143 |

COPY GAP: closed by the Codi amendment above; no new copy remains.

## Checks

- static.mjs: S1 exact substitutions (TicketFormField, globals.css); S2 alert class defined once, forms render TicketFieldAlert and hold no
  role="alert" or old class; S3 ids, aria-invalid, aria-describedby, focus, noValidate, honeypot, fetch and body lines, input-class prefix;
  S4 existing strings + API regex + no new prose; S5 e2e spec, API route and both pages equal BASE; S6 docs.
- rendered.mjs: see its header (A empty, B bad email, C valid posts, D 500 reply; 1280 and 390; both forms; axe).
- e2e/contact-form-mocked.spec.ts runs unchanged (contract A6) and is byte-pinned (A1, S5).
- footprint.mjs: only goldens/footprint.json, docs/nos-form-errors.md and the spec dir. Out of scope and forbidden by that: input radius, the
  info@ link height, the hero lede, every other route 30/33 P3, the ticket components, the pages.
- Run the rendered check from the worktree with `NODE_OPTIONS='--require ../r19-chrome/use-chrome.cjs'` (Chrome shim).
