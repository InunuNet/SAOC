# Polish wave 2 F7 — /events/submit success message (SS-1)

**SS-1.** `SubmitEventForm` rendered its success state as `text-green-700 text-sm`. That is a
Tailwind palette default: there is no green or success token in `app/globals.css` or
`design/design_handoff_saoc/colors_and_type.css`, so no on-system success colour exists to pick
and none is invented.

## Change

The success branch now uses the panel `/contact` and `/members` already use (the `SuggestionForm`
success block): `border border-rule bg-parchment p-8` around one
`<p role="status" className="font-sans text-[16px] leading-[1.55] text-ink/80">`. The sentence is
unchanged byte for byte. No heading, icon or colour; the error styling and the form are untouched.

## Check

`contracts/checks/polish-wave-2-2026-10-25/f7-success-static.mjs`. A rendered check is not possible:
the page needs a Firebase session and a POST.
