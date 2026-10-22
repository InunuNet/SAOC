# nos-form-errors (rFE): per-field errors on the SAOC forms

Mission slug `nos-form-errors`, round rFE. `ContactForm` (`/contact`) and `SuggestionForm` (`/members`)
now carry the full per-field error pattern on the shared `TicketFieldAlert`
(`components/tickets/TicketFormField.tsx`), where before they validated only the message and showed one
form-level alert.

## Pattern

- Every field is validated on submit (trimmed): name, email, `ContactForm` subject, message.
- An invalid field gets `aria-invalid="true"` and `aria-describedby` pointing at its error id; both are
  absent while the field is valid. The message field keeps its "Minimum 10 characters." hint, which now has
  an id on both forms, and lists hint then error in `aria-describedby` while invalid.
- The error renders directly under the field as `<TicketFieldAlert id={errorId}>`. `TicketFieldAlert`
  takes an optional `id`; without one its output is unchanged for every ticket caller.
- The input border turns `--color-error` through `aria-invalid:border-error`. The `--color-error` value is
  unchanged; only its comment in `app/globals.css` now names the SAOC form alerts as users.
- The first invalid field (DOM order) is focused and no request is sent.
- Ids: `cf-{name,email,subject,message}-error`, `cf-message-hint`, `cf-form-error`;
  `msf-{name,email,message}-error`, `msf-message-hint`, `msf-form-error`.
- The honeypot, `noValidate`, the fetch call and body (still no `_hp`) and the input radius are untouched.
  Honeypot, non-OK reply and network failures stay form-level, rendered as `TicketFieldAlert` above the
  submit button; no field is marked invalid for them.

## Copy (no new copy)

| when | string | source |
|---|---|---|
| empty name, email or subject | Required | `design/design_handoff_saoc/src/pages-show-events-contact.jsx:476` |
| email fails the regex | Enter a valid email | `pages-show-events-contact.jsx:477` |
| message under 10 characters | the form's existing "at least 10 characters" message | `ContactForm.tsx`, `SuggestionForm.tsx` (pre-rFE) |

Strings are the handoff copy per the design lead's amendment. The API strings ("All fields are required.",
"Invalid email address.") stay out of the forms' source and only reach the user as `data.error` in the
form-level alert after a non-OK reply. The email test is the API's own regex
(`app/api/contact/route.ts`).

## Visual change to know about

The SAOC form alert is now 14px (it was 16px with `leading-[1.55]`) because it uses the shared
`TicketFieldAlert` class. Codi ruled the shared 14px size fine on both sites.

## Copy gap

Closed by the amendment: "Required" is field-neutral, so no copy gap remains. (Before the amendment,
"All fields are required." sat under a single field and read oddly; recorded for the design lead.)

## Amendment 2 (Codi)

- The shared alert is transparent: `ALERT_CLASS` in `TicketFormField.tsx` is now
  `flex gap-2 border-l-2 border-error bg-transparent px-4 py-0 font-sans text-[14px] text-error`
  (was `bg-bone px-4 py-3`). `--bone` is a grey on SAOC, so the filled alert was as heavy as its field.
  This applies to the NOS ticket forms too: the shared alert is transparent there as well, with less
  padding, so it renders the same on NOS and SAOC. The left rule hugs the text; the gap above comes from
  the field wrapper's spacing and the gap below from the form spacing.
- Clear on edit: each field's `onChange` drops that field's own `fieldErrors` entry, so a corrected field
  loses its error and `aria-invalid` immediately instead of at the next submit. The message field keeps its
  hint id in `aria-describedby`.
