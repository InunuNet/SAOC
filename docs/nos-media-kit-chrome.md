# NOS media kit sign-in chrome

An anonymous visitor to the NOS host's media kit (`/media-kit`, or `/national-show/media-kit`)
lands on the admin sign-in card inside the NOS header and footer. The SAOC host's sign-in and
media kit are unchanged.

## Cause

The media kit is admin-gated (nos-site-split rulings R2.6, "members only"). The gate redirects an
anonymous visitor on the same host to the host-neutral `/admin/login`. That page's layout,
`app/admin/login/layout.tsx`, always rendered the SAOC `Header` and `Footer`, so on the NOS host the
sign-in card appeared under SAOC chrome (including "Join a society").

## Fix

`app/admin/login/layout.tsx` is host-aware. It reads `requestSite()` and, on the NOS host, renders
`NosFrame` around `NosThemeScope`; on any other host it renders the SAOC `Header`, `main` and
`Footer showCopyGap={false}` exactly as before. It mirrors `app/(shared)/layout.tsx` and
`app/not-found.tsx`. `NosFrame` owns the single `main`, so the NOS branch adds no second one.

## Scope

Only that one layout changed. The admin shell (`app/admin/(shell)`) stays SAOC per R5.1, and
`proxy.ts`, `lib/media-kit-gate.ts`, the two media-kit pages and the NOS footer link are untouched.
NOS Design reviewed the sign-in card in NOS chrome (1280 and 390 wide) and accepted it as is.

## Tests

`e2e/nos-media-kit-chrome.spec.ts` checks that NOS `/media-kit` ends on `/admin/login` on the same
origin with `header#nh`, `footer#nf`, no "Join a society" and one `main`, and that the SAOC
`/admin/login` keeps its SAOC chrome with no NOS chrome. It covers `/media-kit` only: the
`/national-show/media-kit` spelling is canonicalised by the proxy using `NEXT_PUBLIC_*_SITE_URL`,
which the Playwright dev server does not set. That spelling is covered over HTTP by assertion A7 of
the mission contract, with the variables set.
