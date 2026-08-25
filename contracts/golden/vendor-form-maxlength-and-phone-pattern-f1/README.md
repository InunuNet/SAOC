# Golden: vendor-form-maxlength-and-phone-pattern F1

Defect (backlog.md P2): none of the vendor registration form's text/textarea/tel/email/url
fields carries a `maxLength`, so e.g. `businessName` accepts 5000 characters verbatim with no
truncation or warning. The phone field (`contactCellPhone`, `type="tel"`) has no format check,
so it accepts `"not a phone number !!"` verbatim.

This golden is the source of truth for the exact per-field limits and the phone pattern. Do not
invent different numbers — implement exactly this table.

## Why `maxLength`, not just a `pattern` attribute

`VendorRegisterForm.tsx` renders `<form ... noValidate>`. `noValidate` disables the browser's
HTML5 constraint-validation API entirely — so a `pattern`, `required`, `min`/`max`, or `type=email`
attribute alone is **silently inert** on submit (this is the mechanism behind the existing
`vendor-form-client-validation-gate` mission: the app relies on
`validateVendorRegisterFormClientSide` in JS, not on native constraint validation).

`maxLength` is different: it is enforced by the browser at the DOM/input level on every keystroke
and paste, **independent of `noValidate`** and independent of the constraint-validation API. It is
the correct mechanism for "stop the value getting long in the first place." `pattern` is kept only
as an HTML5 hint for assistive tech / autofill; the phone format is actually enforced by a new
`validatePhoneClientSide`-style check added to `lib/vendor-register-form-validation.ts`, wired into
the same pre-fetch early-return gate `validateVendorRegisterFormClientSide` already uses (see
`vendor-form-client-validation-gate` contract for that gate's shape — reuse it, do not duplicate).

## Fields excluded from this golden's maxLength table

`boothCount`, `tableCount`, `chairCount`, `staffPerDay` (all `htmlType="number"` in
`VendorBoothFieldset.tsx`) — the HTML spec does not apply `maxlength` to `type="number"` inputs;
browsers silently ignore it there. These fields are already bounded by
`validatePositiveInteger` / `validateOptionalNonNegativeInteger` in
`lib/vendor-submissions.ts` and by the client mirror in
`lib/vendor-register-form-validation.ts`. Out of scope for this contract — do not add a
`maxLength` prop to these three fieldset call sites; it would be a no-op and a wasted diff.

Checkbox/radio-backed fields (`vendorCategory`, `paymentMethodsAccepted`, `boothType`,
`powerRequired`, `waterRequired`, `termsAccepted`) are not text inputs — also out of scope.

## Field → maxLength table (21 text-type fields)

| Field | Component file | htmlType | maxLength | Rationale |
|---|---|---|---|---|
| `businessName` | VendorContactFieldset.tsx | text | 200 | Business/org name |
| `tradingName` | VendorContactFieldset.tsx | text | 200 | Business/org name |
| `contactPersonName` | VendorContactFieldset.tsx | text | 150 | Person's full name |
| `contactCellPhone` | VendorContactFieldset.tsx | tel | 30 | Phone incl. formatting chars; see pattern below |
| `contactEmail` | VendorContactFieldset.tsx | email | 254 | RFC 5321 max mailbox length |
| `physicalAddress` | VendorContactFieldset.tsx | textarea | 500 | Multi-line street address |
| `cipcNumber` | VendorContactFieldset.tsx | text | 50 | Registration number, short |
| `vatNumber` | VendorContactFieldset.tsx | text | 50 | Registration number, short |
| `website` | VendorContactFieldset.tsx | url | 300 | URL |
| `socialMediaHandle` | VendorContactFieldset.tsx | text | 200 | One or more @handles |
| `productDescription` | VendorCategoryFieldset.tsx | textarea | 2000 | Free-text description, required |
| `phytosanitaryPermitNumber` | VendorCategoryFieldset.tsx | text | 100 | Permit reference number |
| `citesPermitNumber` | VendorCategoryFieldset.tsx | text | 100 | Permit reference number |
| `foodHandlingCertificateNumber` | VendorCategoryFieldset.tsx | text | 100 | Certificate reference number |
| `foodItemList` | VendorCategoryFieldset.tsx | textarea | 1000 | Free-text list |
| `electricalLoad` | VendorBoothFieldset.tsx | text | 100 | e.g. "15A / 3.5kW" |
| `vehicleRegistrations` | VendorBoothFieldset.tsx | text | 150 | Possibly multiple plates |
| `loadInSlot` | VendorBoothFieldset.tsx | text | 100 | Free-text time slot |
| `loadOutSlot` | VendorBoothFieldset.tsx | text | 100 | Free-text time slot |
| `bio` | VendorMarketingFieldset.tsx | textarea | 1000 | Label asks for 50-100 words (~600-700 chars); 1000 gives headroom without allowing an essay |
| `paymentReference` | VendorPaymentFieldset.tsx | text | 200 | Reference string |

## Implementation shape (component layer)

`VendorFormField.tsx` currently has no `maxLength` prop. Add one:

```ts
interface VendorFormFieldProps {
  // ...existing props...
  maxLength?: number;
  pattern?: string;
}
```

Pass it through to both the `<input>` and `<textarea>` branches (`maxLength={maxLength}`, and
`pattern={pattern}` on the `<input>` branch only — `<textarea>` has no `pattern` attribute in
HTML). Each of the five fieldset components then passes the table value above as a new
`maxLength={N}` prop on each call site listed. Do not add a blanket default inside
`VendorFormField` — every call site states its own limit explicitly (matches this file's table,
keeps the limit auditable per-field instead of hidden behind a shared default).

## Phone format check

**Pattern (HTML5 hint only, on `contactCellPhone`'s `<input pattern=...>`):**

```
^(?=.*[0-9])[0-9+\-() ]{7,20}$
```

**Real enforcement — new exported function in `lib/vendor-register-form-validation.ts`:**

```ts
const PHONE_PATTERN = /^(?=.*[0-9])[0-9+\-() ]{7,20}$/;
```

Wire it into `validateVendorRegisterFormClientSide` alongside the existing `contactCellPhone`
non-empty check (same function, same `errors` array, same push-string convention — do not create
a second validator function called separately). New error string, following the file's existing
vocabulary exactly:

```
contactCellPhone must be a valid phone number
```

Only push this new error when `contactCellPhone.trim() !== ''` (an empty phone already produces
the existing "is required and must be a non-empty string" error — do not double-error on an empty
field).

Example accepted: `"+27 82 123 4567"`, `"(011) 234-5678"`, `"0821234567"`.
Example rejected: `"not a phone number !!"`, `"abc"`, `"       "` (whitespace-only — the leading
`(?=.*[0-9])` lookahead requires at least one digit, closing a bypass where an all-space string
otherwise satisfied the character class and length bounds), `""` handled by the existing required
check (no additional pattern error on top of the existing required error).

## Server-side mirror (`lib/vendor-submissions.ts`)

Client-only limits are trivially bypassed (devtools, curl, a modified fetch body) — the server
must independently reject both oversized strings and malformed phone numbers, not merely trust
the client already checked. Extend `requireNonEmptyString` (or add a sibling helper used
alongside it) to also enforce a max length per required field, and add equivalent length checks
for the optional fields in the table above. Reuse the exact numeric limits from the table —
`businessName` server cap is 200, matching the client `maxLength`, not a different number.

Add a server-side `PHONE_PATTERN` (same regex as the client) and reject
`contactCellPhone` values that fail it, using the same error string
`'contactCellPhone must be a valid phone number'` so
`lib/vendor-register-response.ts`'s `humaniseFieldError` mapping (which matches on that exact
string) keeps working unmodified — do not invent a different server-side error message.

Reject oversized/malformed input outright (push an error, `valid: false`) — never silently
truncate on the server. Silent truncation would let a 5000-char `businessName` get saved as a
different value than the submitter believes they sent, with no error surfaced.
