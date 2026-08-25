# F1: Vendor Form Input Fields — Focus Ring Visibility Fix

**Feature:** F1 of mission `vendor-form-input-focus-indicators` (milestone M1). Adds keyboard-visible focus ring styling to all ~24 text/number/email/tel/url/textarea input fields in the vendor registration form. Keyboard users tabbing through vendor contact details, category selection, booth requests, and marketing information now see a consistent, visible focus indicator matching the established site-wide focus treatment already used on checkboxes, radio buttons, submit buttons, and navigation links.

**Contract:** `.agent/memory/project/specs/vendor-form-input-focus-indicators/contract-f1.yaml` and `contracts/golden/vendor-form-input-focus-indicators-f1/` — full design record and check scripts.

**Status:** Gated (all structural checks pass). QA-passed. Codex cross-model-passed.

---

## Why This Feature Exists

**The original defect:** The vendor registration form's ~24 input fields (across Contact, Category, Booth, Marketing, and Payment fieldsets) had no visible focus ring. When keyboard users tabbed through the form, each text input relied on a barely-perceptible border-colour shift (`outline-none` + `focus:border-ink/40`) — a 10% opacity border change that is hard to distinguish from the unfocused state. By contrast, the form's checkboxes, radio buttons, submit button, and site-wide navigation links already had the correct site-default treatment: `focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory` — a clear, branded ring with a distinct offset. This inconsistency violated WCAG 2.1 level AA (focus visibility) and created a poor keyboard navigation experience.

**Why it happened:** The defect traces to a single reused constant: `components/vendors/VendorFormField.tsx`'s `inputClass`. This string is applied to all ~24 text/number/email/tel/url/textarea inputs across the form's five fieldsets. The constant included border styling for both focused and unfocused states but omitted the site-wide focus ring classes. Because the constant was shared and reused consistently, the defect affected exactly the same ~24 fields — explaining the precise "24 of 40" count (the other ~16 interactive elements like checkboxes, radios, and buttons have their own classes and already had correct ring styling).

**Why a fix was needed:** Keyboard and screen reader users must see a clear, predictable focus indicator on every interactive element. The border-colour shift is low-contrast and visually distinct from the form's design language and the site-wide focus treatment. Applying the established ring to all `VendorFormField` inputs ensures focus is visible, predictable, and consistent across the entire vendor registration flow and the site.

---

## The Fix

The fix was purely additive — append the site-wide focus ring token set to `VendorFormField.tsx`'s `inputClass` constant:

**Before:**
```tsx
const inputClass = `
  block w-full rounded border border-ink/10 bg-ivory px-3 py-2 
  text-sm placeholder-ink/30 outline-none 
  focus:border-ink/40 disabled:opacity-50
`;
```

**After:**
```tsx
const inputClass = `
  block w-full rounded border border-ink/10 bg-ivory px-3 py-2 
  text-sm placeholder-ink/30 outline-none 
  focus:border-ink/40 focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory 
  disabled:opacity-50
`;
```

The added classes (`focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory`) match the exact ring styling already applied to the form's checkboxes, radio buttons, submit button, and site-wide navigation links. All ~24 text/number/email/tel/url/textarea inputs across the Contact, Category, Booth, Marketing, and Payment fieldsets now inherit this treatment automatically — no per-field changes required.

### Verification of the Fix

**Real browser verification (BrowserAgent / Playwright):**

Playwright suites verified focus ring rendering and presence across all input types:

- **Tab to text input (Contact.name):** Ring composites immediately, visible on first frame after focus (no transition delay)
- **Ring styling:** Exact visual match to stepper buttons and navigation links — 2px ring, ink/40 opacity, 2px offset to ivory background
- **All input types verified:** text / email / tel / url / number / textarea inputs all show ring rendering
- **Settle delay test:** Ring remains visible and stable 500ms after focus (no transition animation removes it)
- **Regression: checkboxes/radios unaffected:** Form's checkbox (Booth.prefersIndoor, Booth.needsTable) and radio (Category.type) elements render unchanged; no visual interference with the added ring
- **Regression: no error-state clash:** Vendor form validation errors render only as a summary banner above the fieldsets; there is no per-field inline error border that could clash with the focus ring

---

## Why This Fix Is Simple

Unlike the `tickettypecard-focus-ring` fix, which revealed a subtle CSS animation race condition, the vendor form input fix is straightforward:

- The classes required are already established site-wide and proven in production on other form elements
- The reuse pattern (single `inputClass` constant, shared across all inputs) meant one fix resolved the entire defect class
- No temporal bugs, animation races, or computed-style timing issues — the ring is a simple `box-shadow` applied on `:focus-visible` with no transitions involved
- QA verification was declarative: map field types from live DOM, tab to each, confirm ring rendering — no frame-timing precision required

---

## Scope & Non-Changes

- **No new dependencies added** — all styles are Tailwind v4 utilities, already in use site-wide
- **No component API changes** — `VendorFormField` props are unchanged
- **No per-field styling changes** — the shared constant was updated once; all consumers inherit the change
- **No consumer changes** — `VendorForm.tsx` and its five fieldsets continue to work without modification
- **No page structure changes** — vendor form fieldsets render in the same layout
- **No validation logic changes** — error messages and validation rules are unchanged
- **No Firestore schema changes** — vendor submission documents are unchanged
- **No API route changes** — `/api/vendors` submission handler is unchanged
- **Unmodified input state:** The form's hidden submit error message banner, success page, and proof-of-payment upload flow are unchanged

### Explicitly Out of Scope: Three Sibling Components

Investigation identified three other components with the identical missing-ring defect — but they were explicitly flagged as follow-up work and not touched by this mission:

1. **`components/contact/ContactForm.tsx`** — contact form text inputs (name, email, message) lack focus rings
2. **`components/tickets/TicketFormField.tsx`** — ticket checkout form text inputs (email, name) lack focus rings
3. **`components/tickets/CartDayPicker.tsx`** — day-picker date inputs lack focus rings

Each of these has its own `inputClass` or field styling constant that would require the same fix. They are candidates for future missions if broader form accessibility improvements are planned. For now, vendor form inputs are the isolated scope.

---

## Verification

### Structural Contract Assertions

Standard shell checks verify the fix is in place:

- **A1:** `check-input-class-has-ring.sh` — verifies `VendorFormField.tsx`'s `inputClass` contains all four focus ring classes (`focus-visible:ring-2`, `focus-visible:ring-ink/40`, `focus-visible:ring-offset-2`, `focus-visible:ring-offset-ivory`)
- **A2:** `check-all-input-types-render.sh` — verifies the component renders all input types (text, email, tel, url, number, textarea) across the five fieldsets
- **A3:** `check-checkbox-radio-unchanged.sh` — verifies checkbox and radio inputs are unaffected by the change
- **A4:** TypeScript `tsc` compilation pass (no type errors in VendorFormField.tsx or consumers)

### Live Browser Verification

Real Playwright suites verify focus ring rendering and stability across all input types and fieldsets:

**`check-focus-ring-all-inputs.mjs` (24+ assertions):**
- Tab to each of the ~24 text/email/tel/url/number/textarea inputs across all five fieldsets
- Ring is visually present on first frame after focus
- Ring is composited (non-zero `box-shadow`), not just a computed property
- Ring color and offset match the site-wide design token (ink/40, 2px offset)
- Ring stability: verified present after a 500ms settle delay (no transition removes it)

**`check-checkbox-regression.mjs` (4 assertions):**
- Checkbox inputs in Booth fieldset render unchanged
- No visual overlap or interference between added text-input ring and existing checkbox styling
- Radio button inputs unchanged

**`check-error-state-no-clash.mjs` (3 assertions):**
- Trigger a form validation error (empty required field)
- Error banner renders above fieldsets (no per-field inline error border)
- Focus ring on input fields is not obscured or hidden by error state

**Checks per test:**
- Real Playwright headless browser (not DOM simulation)
- Keyboard navigation via `page.keyboard.press('Tab')`
- Visual rendering via screenshot diffing (ring width, color, offset)
- Computed style verification via `page.evaluate(() => getComputedStyle(el).boxShadow)`
- Field-type mapping from live DOM (not assumed labels) to confirm actual inputs tested

---

## Deployment Notes

**This is a client-side UI fix.** No server-side deployment, no infrastructure changes. The only deployment is a code push to Firebase App Hosting. Once pushed and live on `beta.saoc.co.za`, keyboard users navigating the vendor registration form see a clear, consistent focus ring on all text input fields, matching the site-wide focus treatment and meeting WCAG 2.1 AA standards.
