# F7 — /events/submit success message (SS-1)

components/events/SubmitEventForm.tsx renders the success state as `<p className="text-green-700 text-sm" role="status">`. `text-green-700` is a Tailwind palette default:
there is no green or success token in app/globals.css or design/design_handoff_saoc/colors_and_type.css, so no on-system success colour exists to pick (README: not invented).

## Specification (SS-1)
Replace the paragraph with the site's own success panel, the one /contact and /members already use (components/members/SuggestionForm.tsx success block):
`<div className="border border-rule bg-parchment p-8"><p role="status" className="font-sans text-[16px] leading-[1.55] text-ink/80">Submitted for council review. Thank you — we will be in touch.</p></div>`.
Same single sentence, byte for byte (em dash included). No heading ("Thank you" exists in the contact panel, but adding it here is new copy on this form), no icon, no colour.
Only the success branch changes. Error styling (`text-red-600`), the form and everything else stay (wave 1 F6 reworks the form; stay out of its lines).

## Limit
/events/submit needs a Firebase session and the success state needs a POST, so this is gated statically against the SuggestionForm reference classes. The wave-1 fixture route
(app/events-fixtures/submit) renders only the form, not the success state.

## Docs
docs/polish-wave-2-f7-submit-success.md naming SS-1 and the no-green-token finding.

## Checks
f7-success-static.mjs.
