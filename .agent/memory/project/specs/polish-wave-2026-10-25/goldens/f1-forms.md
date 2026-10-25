# F1 — public forms must not fall through to a native GET

Defect: six public forms render `<form onSubmit=...>` with no `method`. Before React attaches onSubmit, Enter or a click
makes the browser GET the page with every named field in the query string. That puts names, emails, business names and the
vendor access code in the URL (history, server logs, Referer).

Reference pattern, already shipped on /register: components/vendors/VendorRegisterForm.tsx:35 (`subscribeNever`), :45-47
(`const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false)`), :147 (`disabled={disabled || !hydrated}`),
and `method="post"` on its form. Verified green by contracts/checks/vendor-register-p2-f1/check-no-native-get.mjs.

## Specification
1. Create lib/hooks/useHydrated.ts exporting `function useHydrated(): boolean`, implemented as the reference pattern above
   (module-level `subscribeNever`, client snapshot true, server snapshot false). Do NOT refactor VendorRegisterForm; it stays as is.
2. In each of these six files: add `method="post"` to the single `<form>`, `import { useHydrated } from '@/lib/hooks/useHydrated'`,
   `const hydrated = useHydrated();`, and add `|| !hydrated` to the (single) submit button's `disabled`:
   - components/vendors/VendorApplyForm.tsx:192 (submit is `<Button type="submit" disabled={disabled}>` at :357)
   - components/vendors/VendorRegistrationCodeEntryForm.tsx:73 (submit :119)
   - components/contact/ContactForm.tsx:152 (submit :285)
   - components/members/SuggestionForm.tsx:121 (submit :226)
   - components/events/SubmitEventForm.tsx:154 (submit :298)
   - components/tickets/TicketPurchaseForm.tsx:157 (submit :273; the +/- steppers are type="button", leave them)
3. No visual change. A disabled button must not change the page before hydration: keep the existing disabled styling the
   components already use. If a form already has a `disabled` expression, extend it, do not replace it.
4. Do not touch the API routes, validation, copy, or any other form.
5. Docs: docs/polish-wave-f1-forms.md — one page: the defect, the reference, why POST + disabled together (POST alone sends the
   body to a page route that cannot read it; disabled alone leaves Enter-key behaviour to the browser), and the declared limits below.

## Declared limits
- TicketPurchaseForm needs a Sanity ticket document with live stock, so its no-JS submit is covered statically only.
- The rendered check proves the URL never carries values. It does not prove the POST lands anywhere useful, because with the
  button disabled it never fires.

## Checks (all in contracts/checks/polish-wave-2026-10-25/)
f1-forms-static.mjs (six forms + hook), f1-forms-nojs.mjs (JavaScript disabled, Enter and forced click, 5 forms x 4 viewports).
Baseline: both red. Mutation: a form with method="post" but an enabled button still fails the static check.
