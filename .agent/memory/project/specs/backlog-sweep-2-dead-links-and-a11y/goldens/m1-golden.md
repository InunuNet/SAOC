# Backlog sweep 2 — golden reference

Five independently-scoped fixes, each reusing an existing in-codebase pattern.
No new design decisions, no new colour tokens, no invented brand assets.

## F1 — /about WOSA link

`app/(marketing)/about/page.tsx` currently has:

```tsx
<a href="https://wosa.co.za" ...>
```

This must become:

```tsx
<a href="https://wildorchids.co.za" ...>
```

`wosa.co.za` (Wines of South Africa) must not appear anywhere in the file afterward.
Do not add or edit any surrounding copy about WOSA — URL only.

## F2 — public /events.ics redirect

`next.config.ts`'s `NextConfig` must export an async `redirects()` containing an
entry equivalent to:

```ts
{
  source: '/events.ics',
  destination: '/api/events.ics',
  permanent: false,
}
```

`app/api/events.ics/route.ts` is not modified — one implementation, the public path
is an alias onto it.

## F3 — /constitution disclaimer

The exact block already present verbatim in `app/(marketing)/privacy/page.tsx`,
`app/(marketing)/terms/page.tsx`, and `app/(marketing)/refunds/page.tsx`:

```tsx
<section className="space-y-3 border border-rule bg-primary/5 px-6 py-5">
  <p className="font-sans text-[14px] leading-relaxed text-ink/80">
    <strong className="font-medium text-ink">Draft pending legal review.</strong> This
    page has been drafted with AI assistance and has not yet been reviewed by a
    qualified legal professional. It does not constitute legal advice and should not be
    relied upon as SAOC&rsquo;s final policy until formal review is complete.
  </p>
</section>
```

must be added as the first section inside `app/(marketing)/constitution/page.tsx`'s
content column (same position as on the other three pages).

## F4 — /national-show/archive index cards

`app/(marketing)/national-show/archive/page.tsx` currently renders:

```tsx
<div key={show.year} className="flex flex-col border border-rule bg-parchment">
```

with no href/onClick anywhere in the card. This must become a real link:

```tsx
<Link
  key={show.year}
  href={`/national-show/archive/${show.year}`}
  className="flex flex-col border border-rule bg-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
>
```

(`Link` is already imported in this file.) All inner markup is unchanged.

## F5 — vendor registration email validation

`lib/vendor-register-form-validation.ts` (client) and `lib/vendor-submissions.ts`'s
`validateVendorSubmissionInput` (server) must both reject a non-empty, non-email-shaped
`contactEmail` with the exact error string:

```
contactEmail must be a valid email address
```

(This wording deliberately avoids humaniseFieldError's special-cased substrings —
"must be true", "is required", "invalid value" — so it falls through to the existing
generic "Email address is invalid." message in `lib/vendor-register-response.ts` with
no changes needed there.)

`components/vendors/VendorRegisterStatusBanner.tsx` must be restyled from its current
low-contrast `border-accent/40 bg-accent/5` + `text-accent` treatment to the site's
bordered-callout pattern already used on `components/contact/ContactForm.tsx` and
`components/tickets/TicketPurchaseForm.tsx`:

```
border border-primary-800 bg-bone ... text-primary-800
```
