# Patch: NGO JSON-LD in app/layout.tsx

This is a **targeted patch**, not a rewrite. `app/layout.tsx` already exists with fonts,
`metadata`, and a `RootLayout` that renders `<html><body>…</body></html>`. Make exactly
two edits.

## Edit 1 — add the JSON-LD constant

After the existing `DEFAULT_DESCRIPTION` constant (near line 30, just before
`export const metadata`), add a typed constant for the structured data:

```tsx
const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'NGO',
  name: 'South African Orchid Council',
  alternateName: 'SAOC',
  url: BASE_URL,
  foundingDate: '1968',
  description: DEFAULT_DESCRIPTION,
  email: 'secretary@saoc.co.za',
};
```

Notes:
- Reuse the existing `BASE_URL` and `DEFAULT_DESCRIPTION` constants — do not redeclare them.
- `@type` is `NGO` (a Schema.org subtype of Organization) — correct for a national non-profit.
- **No `logo`** — SAOC has no confirmed logo asset path yet. Do not invent one.
- **No `sameAs`** — no social profiles are confirmed. Do not invent URLs.

## Edit 2 — render the script in `<head>`

Change the `RootLayout` return so the `<html>` element contains an explicit `<head>` with the
JSON-LD `<script>` before `<body>`. Keep the existing `<html>` `className` and the existing
`<body>` contents (`UtilityBar`, `Header`, `main`, `Footer`) exactly as they are.

Before:

```tsx
return (
  <html lang="en" className={`${crimsonPro.variable} ${manrope.variable} ${jetBrainsMono.variable}`}>
    <body>
      <UtilityBar />
      <Header />
      <main>{children}</main>
      <Footer />
    </body>
  </html>
);
```

After:

```tsx
return (
  <html lang="en" className={`${crimsonPro.variable} ${manrope.variable} ${jetBrainsMono.variable}`}>
    <head>
      <script
        type="application/ld+json"
        // Developer-controlled static JSON (no user input) — safe to inline.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />
    </head>
    <body>
      <UtilityBar />
      <Header />
      <main>{children}</main>
      <Footer />
    </body>
  </html>
);
```

## Why `dangerouslySetInnerHTML`

`JSON.stringify` of a developer-controlled object is the standard Next.js App Router pattern for
JSON-LD. There is no user input in `ORGANIZATION_JSON_LD`, so there is no XSS surface. Using
`dangerouslySetInnerHTML` (rather than `{JSON.stringify(...)}` as a child) prevents React from
HTML-escaping quotes inside the JSON, which would otherwise corrupt the structured data.

## Verification (contract assertions A17–A20)

- `grep -q "application/ld+json" app/layout.tsx`
- `grep -q "NGO" app/layout.tsx`
- `grep -q "South African Orchid Council" app/layout.tsx`  (already present in metadata; the JSON-LD reinforces it)
- `grep -q "1968" app/layout.tsx`
