# Polish wave F1: public forms and the native GET fall-through

## Defect
Six public forms rendered `<form onSubmit={...}>` with no `method`. Before React attached `onSubmit`, Enter or a click
made the browser GET the page with every named field in the query string, putting names, emails, business names and the
vendor access code into history, server logs and Referer.

## Fix
`lib/hooks/useHydrated.ts` exports `useHydrated()`, a `useSyncExternalStore` hook (server snapshot false, client snapshot
true). It is the same pattern as the reference in `components/vendors/VendorRegisterForm.tsx`, which is unchanged.

Each of VendorApplyForm, VendorRegistrationCodeEntryForm, ContactForm, SuggestionForm, SubmitEventForm and
TicketPurchaseForm now has `method="post"` on its form and `|| !hydrated` on its single submit button's `disabled`.

## Why both
POST alone would send the body to a page route that cannot read it. A disabled button alone leaves Enter-key behaviour
to the browser, which falls back to GET. Together, a pre-hydration submit never puts values in the URL and never fires.

## Declared limits
- TicketPurchaseForm needs a Sanity ticket document with live stock, so its no-JS behaviour is covered statically only.
- The rendered check proves the URL never carries values. It does not prove a POST lands anywhere useful, because the
  button is disabled and never fires.
