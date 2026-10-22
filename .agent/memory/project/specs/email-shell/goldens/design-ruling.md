# email-shell: Codi design ruling (final, verbatim source for @dev)

Source: Brad "Vendor email has no branding send to NOS Design" -> Codi (NOS Design authority) ruling.
Design source under docs/rules/no-invention.md route 3. Do not question or extend it.

## Families (sender unchanged; body brand follows subject)
| Family | Brand | Templates |
|---|---|---|
| A Show transactional | NOS | OrderConfirmation (reference pattern), VendorPaymentConfirmation |
| B Show message | NOS | VendorApplicationConfirmation, VendorApprovalConfirmation, VendorRegistrationConfirmation, VendorStandPaymentReady, SupporterRegistrationConfirmation, stand forfeiture notice (VENDOR_STAND_FORFEITURE_NOTICE, lib/vendor-stand-forfeiture-notice.ts, rendered inside B emails, text unchanged) |
| C Admin notice | NOS-light | VendorApplicationAdminNotice, VendorSubmissionAdminNotice, VendorPaymentAdminNotice, ReconciliationAlert |
| D Council | SAOC | ContactConfirmation (spec below). HELD for this ship: ContactConfirmation stays byte-identical to origin/main until the media-kit lockups merge, so production contact mail cannot render broken logos. D wiring is contract-f2.yaml |

Supporter is provisional and may move to D: the family must be ONE literal in ONE place (a single
`family="B"` on SupporterRegistrationConfirmation), so moving it is a one-line change.

## Shared shell: `<EmailShell family="A|B|C|D">` at emails/_shared/EmailShell.tsx
Reuse the OrderConfirmation pattern. Emit `data-email-shell="<family>"` on the outer table (the
contract keys on it).
- Table layout, inline CSS. ONE `<style>`: the <=620px stack and the Outlook.com dark guard.
- Container 600px on outer gold #f3f2d6. Card gold-100 #fbfaf0, 16px radius (square in Outlook ok).
  Gutter 40px, 20px at <=620. Hidden preheader (display:none) repeats the subject.
- A/B header: royal #211a57 band, 28px top/bottom, 40px sides. Holds
  NOS-2027-logo-reversed-gold-horizontal.png exported to 560px wide, displayed 280px, hosted at
  /images/email/nos-reversed-gold-horizontal-560.png. No recolour. branding/ is read-only: export
  into public/images/email/.
- A/B footer: royal band, centred. Reversed-gold vertical lockup exported 240px wide, displayed
  120px (public/images/email/nos-reversed-gold-vertical-240.png); 24px gap; REG#/NPO at 11px gold
  using FOOTER_REG from components/chrome/footer-data.ts; then existing line
  "South African Orchid Council — saoc.co.za" at 13px.
- Type: Fraunces headings, Karla body; fallbacks Georgia and Arial/Helvetica. Body ink-700 #3a3654;
  labels royal.
- Detail rows: label Karla 700 14px royal in a 150px column; value ink-700; 1px #e3e1c9 rule between rows.
- Reference/code block: gold card, label, value Fraunces 28px, .08em tracking.
- Buttons: bulletproof tables, royal fill, gold text, 10px radius, 48px tall.
- Dark mode: `color-scheme: light` and `supported-color-schemes: light` declared. EVERY band carries
  both bgcolor= and inline background-color (same hex). Text is only royal or ink. Logos are
  transparent PNGs on royal cells. Never text in an image.
- C admin: thin 4px royal top rule, no logo band, no <img>, same type and detail rows, no marketing chrome.

## Copy
NO wording changes. Existing words verbatim, restyled only. Title Case headings stay. The existing
<Preview> text stays as is (it is hidden, excluded from the copy check). The only visible text the
shell may add is the A/B footer REG/NPO line and "South African Orchid Council — saoc.co.za".
`copy-baseline/*.txt` is the visible-text extraction of every template from unmodified origin/main
with the fixtures in contracts/checks/email-shell/fixtures.mts. If a template legitimately cannot
keep a string, STOP and report to the orchestrator; never edit the baseline.

## Alt text
Logo names only ("National Orchid Show 2027" for NOS logos, "South African Orchid Council" for SAOC),
plus ONE functional exception (Codi, final): the OrderConfirmation QR image keeps its origin/main alt,
"QR code for booking reference <bookingRef>", verbatim. No other text-bearing alt.

## Codi logo-inset ruling (final)
The header cell's left padding is reduced by the PNG's transparent inset (13px at 280px display), giving 27px (desktop) and 7px (<=620). Plain padding, no crop.

## Codi fix rulings (final)
1. Header lockup is left-aligned to the text edge: 40px from the left, 20px at <=620.
2. Stacked detail rows at <=620: 4px label-to-value gap, 1px rule under the value, 12px before the next label.
3. Family C card radius is 0 at the top and 16px at the bottom, so the top rule is a straight band.

## Family D (ContactConfirmation, SAOC), Codi ruling, final
Same EmailShell structure as A/B with SAOC tokens. No copy changes.
- Outer background bone #E8E6DC; card parchment #F4F3EC, radius 2px; 600px container; gutter 40px (20px at <=620).
- Header: parchment band, 28px top/bottom, 40px sides. Holds the SAOC full-colour HORIZONTAL lockup,
  dark type on light (Eulophia speciosa + "South African Orchid Council" + tagline), exported 560px
  wide, displayed 280px: public/images/email/saoc-horizontal-colour-on-light-560.png. Source is the
  media-kit-complete export (public/downloads/media-kit/saoc/lockup/saoc-lockup-south-african-orchid-council-horizontal-colour-on-light.png),
  a pure resize, never recoloured.
- Footer: sage #384138 band, centred. SAOC horizontal "light type on dark" full-colour lockup, 220px shown
  (440px export: public/images/email/saoc-horizontal-colour-on-dark-440.png, source
  ...-horizontal-colour-on-dark.png); 24px gap; "REG# 1978/004040/08 · NPO 043-901" 11px, parchment 65%;
  then existing line "South African Orchid Council — saoc.co.za" 13px, parchment 80%.
  (The D REG line carries a middle dot; build it from FOOTER_REG's numbers, do not hand-type new numbers.)
- Type: Crimson Pro 600 headings (Georgia fallback); Manrope body (Arial/Helvetica fallback). Body ink
  #171917 at 80%; labels sage #384138; detail rows as A/B with rule #D9D6CA.
- Button: sage fill, parchment text, radius 2px, 48px, bulletproof table.
- Dark mode as A/B: color-scheme light; bgcolor plus inline background-color on every band; text only ink or
  sage; logos transparent PNG; no text in images. Alt text for the lockup: "South African Orchid Council".

### DEPENDENCY: D is BLOCKED until the media-kit-complete lockup exports exist
The two source files above are produced by the media-kit-complete mission. Until they exist, do NOT
hand-make a lockup, and do not implement D's header/footer. A5 reports "BLOCKED: media-kit-complete
source missing" until then. F1 may ship A/B/C first, but the contract is only DONE when A5, A6 and the
D inbox check (A25) are green.

## Test sends (sandbox only)
No script exists today. @dev adds scripts/email-shell-test-send.ts (`pnpm exec tsx scripts/email-shell-test-send.ts A|B|C|D`):
dotenv-loads .env.local, imports FIXTURES from contracts/checks/email-shell/fixtures.mts, picks
VendorPaymentConfirmation (A), VendorApplicationConfirmation (B), VendorApplicationAdminNotice (C), ContactConfirmation (D),
sends via sendEmail() from lib/email.ts with FORMS_FROM_ADDRESS to brad@inunu.net ONLY (hard-coded
constant; the script refuses any other recipient and refuses to run without RESEND_API_KEY).
Fictional fixture props only. Subject = the template's real subject text prefixed "[TEST] ".
Orchestrator runs it, reads the inbox with `gws gmail` (read-only), writes
.agent/memory/scratch/email-shell-gws-manifest-<A|B|C|D>.json in the shape of
verification-triad-gate/goldens/fixtures/gws_manifest_good.json. Sends happen ONLY after Codi has
approved the per-family renders (.tmp/sandbox/email-shell/codi-approval.txt).

## Evidence workflow for gates A15, A16
1. `pnpm exec tsx contracts/checks/email-shell/check-email-shell.mts render` then screenshot each
   family HTML at 600px and 375px into .tmp/sandbox/email-shell/screens/family-<A|B|C|D>.png.
2. Codi reviews, orchestrator writes codi-approval.txt (one line: who, when, verdict).
3. Test-send, gws check, manifests.

## Scope split (lead ruling)
F1 (contract-f1.yaml) = families A/B/C, shippable now; ContactConfirmation untouched (A12). F2 (contract-f2.yaml) = family D, follows once media-kit-complete lockups are on main. F2 checks run with EMAIL_SHELL_SCOPE=D.

## Brad review 2026-10-22 (supersedes conflicting parts above; verbatim source brad-review-2026-10-22.md)
Applies to F1 (A/B; C and D only get the em-dash fix).
- Copy: sentence-case A/B headings; real em dash replaces "--" (all families); "Click here to recover your tickets" becomes "Recover your tickets"; the approval code shows alone ("4 2 1 7", no business-name prefix); email line becomes "Present this ticket — or just the booking reference — at the door for check-in." (my reading of "Present this ticket everywhere"; the PDF line is a separate contract). C and ContactConfirmation keep Title Case headings. `copy-baseline/` is the amended golden, `copy-baseline-origin/` the untouched origin/main text; the differences are exactly these decisions.
- Header (A/B): NOS-2027-logo-full-colour-reversed-horizontal.png on the royal band, exported to public/images/email/nos-full-colour-reversed-horizontal-560.png (560 wide, shown 280), no crop or recolour. Re-measured inset: alpha bbox starts at x=192 of 4108, so 13px at 280, header cell left padding stays 27px desktop / 7px at <=620.
- Footer (A/B): NO big vertical lockup (nos-reversed-gold-* are gone). Condensed, on the page ground, not on a royal band: one 1px rule, 12px Karla in ink-muted, line 1 "South African Orchid Council — saoc.co.za", line 2 "REG# 1978/004040/08 · NPO 043-901". Optional left mark: NOS-2027-logo-ink-purple-vertical.png exported 96px tall (public/images/email/nos-ink-purple-vertical-96h.png), shown 48px tall; only alongside footer text.
- Emergency footnote (OrderConfirmation only): one 12px line above the footer: "In an emergency: 10111 Police (national) · 10177 Ambulance and fire (national) · 112 All emergencies, from a mobile phone", plus the on-site first-aid contact as a "To be confirmed" item in that line. The first-aid label wording is not given verbatim; the copy check tolerates any <=80 chars before "To be confirmed" until the lead supplies it. No card, no big numerals.
- Organiser and Questions become small text in the footer area. GAP: the brief gives no wording for them and they do not exist in the current templates, so no assertion covers them and the copy check will fail if @dev adds words. The lead must supply the exact strings first.
- Review: renders of the order email (A) and vendor approved (B) go to Codi before merge (A16/A17).
- Fixture VendorApprovalConfirmationWithCode renders the registration-link branch, because the code lives only there.

### Lead rulings (final, supersede the lines above)
- Organiser and Questions: only where a template already has that content. The email templates have neither, so emails add nothing; the PDF carries them.
- First-aid item, verbatim from the ticket-pdf baseline: "On-site first aid and show duty contact" followed by the "To be confirmed" pill, in the emergency line. The separator before the label and between label and pill is not fixed (the copy check tolerates spaces, "·" and ":").
- Email line is Brad's verbatim PDF line: "Present this ticket at the door for check in." It replaces the longer em-dash sentence.

## Codi final fixes for A/B (final)
1. Headings (Fraunces) render at weight 400.
2. OrderConfirmation: each ticket is a gold-100 (#fbfaf0) card; the QR image sits on a white #fff tile, 12px padding, 8px radius. The QR alt stays as ruled.
3. OrderConfirmation: the visit details are restored: venue name, address, show dates, and opening times shown as "To be confirmed". Labels MUST be strings that already exist in the ticket-pdf allowed strings or golden A; none are invented here.
   Pending: once @dev reports which labels it used, the architect adds them to goldens/copy-baseline/OrderConfirmation.txt (until then the copy check will flag the extra visible text on that template).

### Codi visit-data fix (final)
Known data never renders as a placeholder and must match the PDF (same Sanity docs). Confirmed values, from ticket-pdf/goldens/fixture-order.json: venue "The Hangar, Stellenbosch Flying Club" / "Stellenbosch Airfield, R44, Stellenbosch, 7600, Western Cape"; show dates "Thursday 23 to Sunday 26 September 2027"; opening times Thu 23 "16h00 to 19h00", Fri-Sun "To be confirmed". The OrderConfirmation fixture carries these; assertion "visit" forbids "The venue To be confirmed" / "Show dates To be confirmed". Family C headings also go to weight 400 (no check pins heading weight).

### Codi pendingLabel ruling (final, verbatim-relay summary)
Codi ruled that the email must match the PDF; both read the same Sanity source and the same `pendingLabel`. Codi approved the live long label ("To be confirmed by the show committee") at 375 and 680 wide, on condition that it is never shortened (R7), and approved the PDF wrap for it.
- The pill text is the Sanity `pendingLabel`, with "To be confirmed" as the fallback when Sanity has none.
- It must not be shortened.
- It must wrap and never clip.
- Visit values themselves still render only when confirmed; only the placeholder text comes from Sanity.
