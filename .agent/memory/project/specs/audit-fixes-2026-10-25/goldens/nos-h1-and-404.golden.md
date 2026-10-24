# Golden: NOS duplicate h1 and the NOS 404

Governing rule: docs/rules/no-invention.md. No new copy. The 404 reuses the existing strings.

## Duplicate h1 (audit P2-5): /conferences /symposium /workshops /wosa-conference

Root cause, verified in .tmp/sandbox/audit/nos/conferences.html: each route has a `loading.tsx` that
renders `<NosHero>` (an h1) as the Suspense fallback (mission nos-loader-h1). Streaming leaves the fallback
in the document next to the resolved page (`<!--$?--><template id="B:0">` ... `<div hidden id="S:2">`), so
the HTML carries the hero h1 twice. `app/(nos)/tickets/[slug]/loading.tsx` has the same pattern (nbsp h1)
and must get the same treatment.

Required result:
- `NosHero` gains `titleAs?: 'h1' | 'p'`, default `'h1'`. With `'p'` it renders
  `<p className="nos-hero-title">` so every `.nos-hero-title` rule still applies. Check nos-theme.css and
  nos-structure.css for `h1.nos-hero-title` style: selectors and relax them to the class if present.
- Every `loading.tsx` under `app/(nos)` passes `titleAs="p"`. The fallback looks identical on first frame;
  only the element changes. The page's own NosHero keeps its h1.
- Exactly one `<h1` in the server HTML of each of the four routes, `/`, and `/tickets/vip`.

## NOS 404 (audit P2-6)

Observed with `next dev` on nos.localhost (BETA_PASSWORD_WALL_OFF=true, Host: nos.localhost:PORT):

| request | result |
|---|---|
| NOS `/nonexistent-xyz` | 404, `<html id="__next_error__">`, no lang, 0 h1 in server HTML |
| NOS `/archive/1900`, `/archive/abc`, `/vendors/zzz` | same error shell |
| SAOC `/nonexistent-xyz` | 404, `<html lang="en">`, 1 h1 (healthy) |
| NOS `/nonexistent-xyz` with `app/(nos)/national-show/[...slug]` removed | 404, `<html lang="en">`, 1 h1 (healthy) |
| `[...slug]/page.tsx` without its `generateMetadata` throw | still the error shell |
| `national-show/not-found.tsx` replaced by `<h1>probe</h1>` | still the error shell |

So the fault is not the not-found component or the metadata throw. Any `notFound()` raised from inside the
`app/(nos)/national-show` segment makes SSR bail to the client error shell, while a bare unmatched URL
renders correctly. The dev finds the cause (suspects: the not-found boundary of the `national-show` segment
under the `(nos)` layout chain, `NosFrame`, or a server/client boundary that only throws on this path) and
fixes the smallest thing. Note also that the shell that does stream shows the SAOC wording ("Find a society")
inside the NOS chrome, so once SSR works the NOS copy of `national-show/not-found.tsx` must be what renders
for /national-show/* misses.

Required result, all from server HTML (not after hydration):
- HTTP 404, `<html lang="en"` present, exactly one `<h1`, containing "This orchid has left the bench."
- Existing copy only. `app/(nos)/national-show/not-found.tsx` and `app/not-found.tsx` strings unchanged.
- Do not delete `[...slug]` or a not-found file to make the symptom go away (behavior.md, surgical fixes).

## NOS Design G6, quoted (final): the shape of the NOS 404
"The NOS 404 is the typographic fallback per G6: NOS black, h1 in the serif at 300, no photo, the existing
strings only, and the unified header."

Which means the 404 renders `NosHero` in its typographic variant, because that variant is exactly NOS black
(`.nos-hero { background-color: var(--black) }`) with `.nos-hero-title` at `font-weight: 300` in the serif,
on the 1080 grid, with no image (nos-theme.css:470, :492; NosHero.tsx header comment). Pick a `route` that
has no entry in components/nos/hero-photos.ts, or NosHero picks the photo variant. Mapping of the existing
strings, no new copy: the `404 — Page not found` label goes in the hero's `crumbs` slot (or just above the
title), the h1 is `This orchid has left the bench.`, the lede is `The page you’re looking for doesn’t exist or
may have moved.`, and the three existing buttons (Tickets, National Show, Plan your visit) stay below.
"Unified header" is the NOS header NosFrame already renders for both group layouts.

`app/(nos)/not-found.tsx` (tickets, vsp misses) currently re-exports the SAOC `NotFoundSection`, which has a
photo (`/images/orchid-dark.jpg`) and SAOC wording; it must render the same NOS fallback instead. The SAOC
`app/not-found.tsx` is not touched.

Enforced by check-nos-404.mjs (source: NosHero, no photo, strings, route has no photo, group file no longer
SAOC) and live-probe.mjs (served HTML: 404, lang, one h1, `nos-hero-type` and `nos-hero-title` present, no
`/images/orchid-` photo, no "Find a society").
