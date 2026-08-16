# Remedy — precise, non-optional values

This is a minimal darkening of the EXISTING brass accent, not a new brand colour.
Same hue (≈39°) and saturation as the current `--accent`, only lightness reduced —
derived by scanning HSL lightness downward from the current value until the
tightest real pairing (`--accent` on `--bone`) clears 4.5:1, then stopping (no
further darkening than the threshold requires).

## 1. Token value change — `app/globals.css`

```
--accent: #74654c;   /* was #9e8c6b */
```
`--accent-soft` is UNCHANGED (`#c2b393` already passes every dark-surface pairing
it's used in — 5.13:1 on `--primary`, 7.30:1 on `--primary-800`).

Resulting ratios (verified by `check_contrast.py`, see fixture test in this
directory):
- `--accent` (`#74654c`) on `--parchment` (`#f4f3ec`): **5.09:1** — PASS (req 4.5:1)
- `--accent` (`#74654c`) on `--bone` (`#e8e6dc`): **4.53:1** — PASS (req 4.5:1, binding case)
- `--color-ivory` text on `bg-accent` (`#74654c`) fill: **5.09:1** — PASS (req 4.5:1)
- `--accent-soft` on `--primary` / `--primary-800`: unchanged, 5.13:1 / 7.30:1 — PASS

This ONE token edit fixes, with no other change: all 24 light-surface `text-accent`
usages (audit rows 1–4, 8, 10–13, 16–22, 26–29 — including the three originally
reported public forms) and all 7 `bg-accent`+`text-ivory` button fills (including
both public submit buttons: `ContactForm.tsx:174`, `TicketPurchaseForm.tsx:149`).

## 2. Class swap — `text-accent` → `text-accent-soft` on dark surfaces

The 6 dark-surface usages (audit rows 5, 6, 7, 9, 14, 15) must change their Tailwind
class from `text-accent` to `text-accent-soft`. Darkening the token (step 1) does NOT
fix these — it makes accent-vs-primary/primary-800 worse (4.61:1→drops below 3:1 on
primary-800; 3.24:1→worse on primary), because darkening moves `--accent` closer in
luminance to the dark backgrounds it sits on there. `--accent-soft` already passes
both (5.13:1 / 7.30:1) and needs no value change — it is the correct token for text
on a dark surface; these six lines were using the wrong token, not a broken one.

Exact edits required:
- `app/not-found.tsx:21` — `text-accent` → `text-accent-soft`
- `app/(marketing)/national-show/archive/page.tsx:83` — `text-accent` → `text-accent-soft`
- `app/(marketing)/national-show/archive/[year]/page.tsx:137` — `text-accent` → `text-accent-soft`
- `app/(marketing)/national-show/page.tsx:245` — `text-accent` → `text-accent-soft`
- `app/(marketing)/national-show/page.tsx:504` — `text-accent` → `text-accent-soft`
- `app/(marketing)/national-show/page.tsx:522` — `text-accent` → `text-accent-soft`

## 3. Component fix — `components/chrome/UtilityBar.tsx:68`

`text-primary` on `bg-accent` degrades from an already-failing 3.24:1 to 1.87:1 once
`--accent` is darkened (accent and primary become close in luminance). Change the
text color class on this element from `text-primary` to `text-ivory`. Resulting
ratio: **5.09:1** — PASS (identical to the ivory-on-accent button case in step 1,
since it's the same background token).

## Both usages checked in light AND dark context (site has no separate dark theme —
## "light"/"dark" here means the parchment/bone surface vs. the primary/primary-800
## surface, which is this site's only two-surface model; there is no prefers-color-
## scheme toggle in `app/globals.css` to check separately).
- `--accent` as text: verified on both light surfaces (`--parchment`, `--bone`, both
  now PASS) and, via the class-swap in step 2, on both dark surfaces (`--primary`,
  `--primary-800`, both PASS through `--accent-soft`).
- `--accent` as a button fill: verified with `--ivory` text (the only text color ever
  paired with `bg-accent` in this codebase, per the grep in the audit) — PASS.

## What NOT to do
- Do not touch `--accent-soft` — it is not broken.
- Do not invent a new CSS variable — reuse `--accent-soft` for the dark-surface case,
  don't add e.g. `--accent-on-dark`.
- Do not raise the threshold reasoning to 3:1 anywhere in this set — every usage
  audited is normal-weight text under 18.66px/24px; none qualifies as "large text."
