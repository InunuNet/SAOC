# F1: Vendor Form Field Length Caps and Phone Validation

**Feature:** F1 of mission `vendor-form-maxlength-and-phone-pattern` (milestone M1). Adds input field length constraints and phone format validation to the vendor registration form. None of the ~21 text/textarea/tel/email/url fields carried a `maxLength` attribute (so `businessName` accepted 5000+ characters), and the phone field had no format check (accepted `"not a phone number !!"` verbatim). This fix adds both layers: browser-enforced field length caps and client/server-side phone format validation.

**Contract:** `.agent/memory/project/specs/vendor-form-maxlength-and-phone-pattern/contract-f1.yaml` and `contracts/golden/vendor-form-maxlength-and-phone-pattern-f1/README.md` — full decision record and check scripts.

**Status:** Gated (all 8 assertions pass). QA-passed. Codex cross-model-passed.

---

## The Defect: Unbounded Form Fields and Unvalidated Phone Input

**What was wrong:** The vendor registration form had no input constraints:

```typescript
// Before: no maxLength, no pattern
<input type="text" name="businessName" />        // accepts 5000+ chars
<input type="tel" name="contactCellPhone" />     // accepts "not a phone number !!"
<textarea name="productDescription"></textarea>  // unlimited length
```

This allowed:
- Business name set to an entire essay (5000 chars or more)
- Phone field filled with gibberish, emoji, or arbitrary characters
- Long-form fields like bio and product description with no practical bounds
- Downstream confusion: what is the database column width? What does the email confirmation expect?

**Why it matters:** Form fields should communicate their boundaries to the user before submission, not surprise them with server-side rejection after they've typed a wall of text.

---

## The Fix: Three-Layer Approach

### Layer 1: Browser-Level Enforcement (maxLength)

`maxLength` is a native HTML attribute that the browser enforces at the DOM level on every keystroke and paste — *independent of form validation*. This is different from a `pattern` attribute, which is ignored when `<form noValidate>` is present.

Added `maxLength` prop to `components/vendors/VendorFormField.tsx`:

```typescript
interface VendorFormFieldProps {
  // ...existing props...
  maxLength?: number;
  pattern?: string;
}

export function VendorFormField(props: VendorFormFieldProps) {
  return (
    <>
      {htmlType === 'textarea' ? (
        <textarea maxLength={maxLength} {...otherProps} />
      ) : (
        <input
          type={htmlType}
          maxLength={maxLength}
          pattern={pattern}
          {...otherProps}
        />
      )}
    </>
  );
}
```

Each of the five fieldset components (VendorContactFieldset, VendorCategoryFieldset, VendorBoothFieldset, VendorMarketingFieldset, VendorPaymentFieldset) now passes an explicit `maxLength` value per field. The user sees the input reject additional keystrokes when the limit is reached — immediate, visible feedback.

**Note:** Number-typed fields (`boothCount`, `tableCount`, `chairCount`, `staffPerDay`) are deliberately excluded. The HTML spec does not apply `maxlength` to `type="number"` inputs; browsers silently ignore it there. These fields are already bounded by validation logic (`validatePositiveInteger` in lib/vendor-submissions.ts).

### Layer 2: Client-Side Format Validation (Phone Pattern)

The form uses `noValidate`, so the HTML5 `pattern` attribute is inert on submit. Real enforcement comes from JavaScript validation in `lib/vendor-register-form-validation.ts`:

```typescript
const PHONE_PATTERN = /^(?=.*[0-9])[0-9+\-() ]{7,20}$/;

export function validateVendorRegisterFormClientSide(state: FormState): string[] {
  const errors: string[] = [];

  // ...existing checks...

  if (state.contactCellPhone.trim() !== '') {
    if (!PHONE_PATTERN.test(state.contactCellPhone)) {
      errors.push('contactCellPhone must be a valid phone number');
    }
  }

  return errors;
}
```

This check is wired into `handleSubmit()` in `VendorRegisterForm.tsx`, blocking the API call if validation fails.

**Accepted examples:** `"+27 82 123 4567"`, `"(011) 234-5678"`, `"0821234567"`.

**Rejected examples:** `"not a phone number !!"`, `"abc"`, blank, `"       "` (spaces-only).

### Layer 3: Server-Side Mirror (Defense in Depth)

The server cannot trust the client. `lib/vendor-submissions.ts` independently enforces both per-field length caps and phone format:

```typescript
const PHONE_PATTERN = /^(?=.*[0-9])[0-9+\-() ]{7,20}$/;
const MAX_LENGTHS: Record<string, number> = {
  businessName: 200,
  contactPersonName: 150,
  // ...rest of the table below
};

function validateVendor(record: Partial<VendorRecord>, errors: string[]): void {
  if (record.businessName && record.businessName.length > MAX_LENGTHS.businessName) {
    errors.push('businessName exceeds maximum length');
  }

  if (record.contactCellPhone && !PHONE_PATTERN.test(record.contactCellPhone)) {
    errors.push('contactCellPhone must be a valid phone number');
  }

  // ...rest of validation
}
```

The server rejects, never silently truncates. If a client-bypassing POST sends a 5000-char `businessName`, the API returns `valid: false` with an error message — not a silently-shortened value.

---

## Field → maxLength Table

21 text-type fields across the form:

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
| `bio` | VendorMarketingFieldset.tsx | textarea | 1000 | Label asks for 50-100 words (~600-700 chars); 1000 gives headroom |
| `paymentReference` | VendorPaymentFieldset.tsx | text | 200 | Reference string |

---

## Security Lesson: The Whitespace-Bypass Bug

During Codex GPT-5.5 cross-model review, a subtle validation bug was caught: the phone regex originally used in a related attempt was:

```typescript
// WRONG: allows spaces-only
^[0-9+\-() ]{7,20}$
```

This pattern's character class includes space `(space)` but does not require a digit. A string of seven spaces `"       "` satisfies the length bounds (7 chars) and contains only allowed characters, so validation passed. The field could be submitted as whitespace, and a client-bypassing curl POST would persist `contactCellPhone: "       "` with `valid: true`.

**The fix:** Add a positive lookahead that requires at least one digit:

```typescript
// CORRECT: requires at least one digit
^(?=.*[0-9])[0-9+\-() ]{7,20}$
```

Now `"       "` fails because `(?=.*[0-9])` looks ahead and finds no digit. The lookahead is applied consistently across three layers:

1. **Client validator** (`lib/vendor-register-form-validation.ts`): Regex literal for pre-fetch validation
2. **Server validator** (`lib/vendor-submissions.ts`): Same regex literal for defense in depth
3. **HTML hint** (`contactCellPhone` input's `pattern` attribute): Same regex, for assistive tech

This is a recurring subtle bug class: **character classes that include whitespace without requiring meaningful content**. A pattern like `[a-zA-Z0-9_ ]` (letters, digits, underscore, space) can silently accept an all-spaces string if no other constraint forces at least one real character. Always ask: "Does my regex accept an empty value, or a value containing only whitespace?" If yes, add a lookahead or anchor guard.

---

## Verification

All 8 contract assertions passed:

- **A1:** VendorFormField.tsx accepts maxLength prop, forwards to both input and textarea branches ✓
- **A2:** All 21 fieldset call sites pass exact maxLength values from the golden table ✓
- **A3:** Phone validator is wired into validateVendorRegisterFormClientSide with correct error string ✓
- **A4:** Server-side caps and phone validation exist in lib/vendor-submissions.ts ✓
- **A5:** Behavioral — browser enforces maxLength at DOM level (e.g. businessName truncates at 200 chars on keystroke) ✓
- **A6:** Behavioral — invalid phone `"not a phone number !!"` blocked at client, visible error shown ✓
- **A7:** Behavioral — valid phone `"+27 82 123 4567"` posts to /api/vendors/register ✓
- **A8:** Durable evidence — screenshots captured ✓

---

## Scope & Non-Changes

- **Production changes:** VendorFormField.tsx (maxLength/pattern props), five fieldset components (maxLength values), lib/vendor-register-form-validation.ts (phone validator), lib/vendor-submissions.ts (server-side caps and validation).
- **No changes to form layout, visual design, or component structure.**
- **No changes to form submission API.**
- **No database schema changes.**
- **Number-typed fields (boothCount, tableCount, chairCount, staffPerDay) explicitly untouched — maxlength is a no-op on type="number".**

---

## Related Features

- **F1 (Vendor Form Client-Side Validation Gate):** `docs/vendor-form-client-validation-gate.md` — the gate that blocks submit on client-side errors, reused here.
- **F5 (Vendor Registration):** The actual feature that added vendor registration (lib/vendor-registration-handler.ts, app/api/vendors/register/route.ts).
- **F10/F11 (Confirmation Email):** Confirmation email sent after successful server-side submission acceptance.
- **F1 (Vendor Form boothCount Parse Consistency):** `docs/vendor-boothcount-guarded-parse.md` — similar defense-in-depth pattern for numeric fields.

---

## Deployment Notes

This is a backlog-closing fix, not a new feature. The production changes are straightforward: add the maxLength prop, pass values from the table, add the phone validator. The server-side mirror ensures the gate holds even if client validation is bypassed. Once committed, future changes to the form or validation logic will run the contract checks and fail if any field loses its maxLength or if the phone validator is accidentally weakened.
