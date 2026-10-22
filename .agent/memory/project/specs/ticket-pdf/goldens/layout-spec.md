# NOS A4 ticket PDF — layout spec (golden)

AUTHORITY (in order): 1. brad-review-2026-10-22.md (Brad's decisions + Codi's rulings; supersedes the artifact wherever they conflict); 2. Codi's review artifact claude.ai/artifact/1Zc87ALWvhA7eRdVkdq12W is the golden otherwise (Codi clarification relayed by team-lead,
2026-10-22): pages 1 and 2 plus its "How it holds up" table. Where codi-ruling.md's prose disagrees, the artifact wins.
Artifact version used: `1792425877-d0a8`, read 2026-10-22 (ticket-page-1.png / ticket-page-2.png, 909x1287 px = 4.329 px/mm,
saved under .tmp/sandbox/ticket-pdf/artifact/). Brad is reviewing the artifact; if Codi relays a change, this spec and the checks are revised, not the dev's guess.

Page: A4 portrait 210 x 297 mm (595.28 x 841.89 pt). Origin here is TOP-left (pdf-lib is bottom-left). 1 mm = 2.835 pt.
Artifact px -> mm: divide by 4.329. Type sizes below are artifact px converted to pt (px x 0.2310 x 2.835 = x0.655).

| token | hex | use |
|---|---|---|
| royal | #211a57 | header band, headings, ticket text |
| page | #fbfaf0 | page ground (everything outside the header band, stub and QR tile; incl. the footer) |
| stub | #f3f2d6 | ticket stub (left) |
| ink | #3a3654 | body text |
| muted | #6a6780 | eyebrows, labels, footer text |
| olive | #a7a841 | rule under the ticket title |
| white | #ffffff | QR tile |
| gold on royal | #f3f2d6 | text in the header band |

Fonts: embedded subsets, real text, Fraunces (display) and Karla (labels, body). Never a standard-14 font (decisions.md D6 for the Karla Regular gap).

## Layout (mm from top-left, measured from the artifact)

| element | geometry |
|---|---|
| header band | y 0..29.8, full-bleed royal. The only solid-colour band. Lockup = `NOS-2027-logo-full-colour-reversed-horizontal` (the .jpg is pre-composited on #221A56 = royal; Codi-approved equivalent: the .png export from branding/National Show 2027/Logo/, 1600 px; no plate, do not crop or recolour) at x 17.5..87.8, y 8.8..21.3 (own aspect ratio, 4108x1008). Re-measure the left inset so the artwork's left edge lines up with the text edge (the file has its own padding), as in the email fix. Right-aligned at x=196: "ADMIT ONE" (Karla bold ~7.5pt caps, tracking .14em, gold; baseline y~11.5) over "Ticket n of N" (Karla ~8.5pt gold; y~17.3). |
| ticket card | x 13.9..196, y 40..143.9, radius ~3.7. Left stub x 13.9..108.3 fill stub; right tile x 108.3..196 fill white. Vertical dashed perforation at x=108.3, y 40..143.9, royal ~0.5pt, dash ~1 mm. |
| stub text | padding ~9 mm (text x=22.9). Eyebrow y~50.4 (Karla bold 7.5pt caps tracking .14em muted). Title = ticket type (Fraunces light ~29pt royal, baseline y~63.5). Olive rule 0.5 mm, x 22.9..100, y 71.6. Large numeral (Fraunces light ~44pt royal, left x 22.9, baseline y~88) with beside it, at x~40: date line (Karla bold ~10.5pt royal, y~86.9) over time line (Karla ~10pt ink, y~92). Unknown date/time/numeral: pill "To be confirmed" in that spot. ATTENDEE label y~110.4 (muted caps), attendee name y~115.5 (Karla bold 16px = 12pt royal, Codi final); a long name wraps/shrinks inside the stub and must never reach the QR tile (x >= 108.3 mm). NO booking-reference block on the stub (Codi final: the ref appears only under "Scan at the door"). |
| QR tile | QR modules ~55 mm square (Codi final: about 55 mm of modules), centred on the tile (centre x=152.2), top y 58.4..113.4. Vector black modules drawn from `QRCode.create(bookingRef).modules`; quiet zone >= 4 modules of white on every side (the tile supplies far more). Under it: "Scan at the door" (Karla bold ~7pt caps tracking .14em royal, y~125.9) then the booking ref (Karla bold ~10.5pt royal, tracking .08em, y~131.7), centred. |
| visit row | headings at y~165 (shifted down by the instruction line; rows follow at the same pitch) (Fraunces ~13pt royal), columns x 13.9 / 82.2 / 142.5. Col 1 "The venue": venue name (Karla bold 9pt royal, y~163), address (Karla 9pt ink, 2 lines, y~168/174.5), "Parking and entrance" + pill (y~181 / 186). Col 2 "Opening times" or "Session times": rows label (Karla bold 9pt royal) + value or pill, y~164..185.5 at ~7 mm pitch. Col 3 "Show dates": show dates text (Karla 9pt ink, 2 lines) and the show URL (y~163..174.5). |
| instruction line | 8 mm under the ticket card (y~152), x 13.9, Karla ~9.5pt ink, exactly: "Present this ticket at the door for check in." The visit row moves down below it (headings y~165). The ~45 mm of ground between the visit row and the bottom-anchored footnote/footer is accepted (Codi). |
| emergency footnote | y~258, x 13.9, ONE 12px (9pt) Karla line, ink-muted, existing words only: "In an emergency: 10111 Police (national) · 10177 Ambulance and fire (national) · 112 All emergencies, from a mobile phone", followed by the on-site item "On-site first aid and show duty contact" + pill "To be confirmed" while unknown. No card, no big numerals. If it exceeds 182 mm wrap to a second line at the same size; never shrink below 12px. |
| condensed footer | bottom-anchored, on the page ground, ALL footer text Karla 9pt ink-muted #6a6780. Hairline rule (0.3pt, #e3e1c9) at y~265, x 13.9..196. Below it, left x 13.9 (x~34 when the mark is drawn): line 1 "South African Orchid Council — saoc.co.za" with "ORDER <ref> · PAGE n OF N" right-aligned at x=196 (or "PAGE n OF N" when no order reference); line 2 "REG# 1978/004040/08 · NPO 043-901"; line 3 "Show office" + pill ("To be confirmed" while unknown); line 4 "Questions: info@saoc.co.za · Quote your booking reference." The Organiser line is dropped. Optional left mark `NOS-2027-logo-ink-purple-vertical` 16 mm tall, drawn only because this footer text exists. No other logo besides the header. |

If a band's content does not fit (very long name or address), shrink or wrap inside the band; never overlap regions, never run text under the QR tile.

## Pills / unknowns ("How it holds up": any detail we do not have shows "To be confirmed"; nothing is made up)

Pills are 7pt EVERYWHERE, the footer included (D11.1: the specific rule beats "all footer text 9pt"). Date rule for the stub: see decisions.md D11 (show-span types print the range, only genuinely unconfirmed tickets print the pill). Pill (Codi final, approvals c8529cf2 / 4f1a1341 / 2c8064af): 0.5pt royal outline, fully rounded, Karla bold, 7pt minimum, text drawn exactly as written (sentence case, "To be confirmed", or Sanity `pendingLabel` when set), tracking 0. A long label wraps inside the outline (rows grow); it is never truncated or clipped (R7).
The artifact's dashed orange outlines are review-only markers and MUST NOT appear in the PDF.

## Print / phone ("How it holds up")

Only the top band is solid colour; the rest is pale so it prints well in black and white. The QR is always pure black on white and scans from any printer.
Fitted to a phone screen the QR is ~133 px wide; name, event, date and reference readable without zoom (so keep text >= the sizes above).
Page text is real text in reading order: attendee, ticket type, booking ref, then visit info.
PDF metadata: Title "Ticket <bookingRef of page 1>", Lang en-ZA where pdf-lib allows; no other new copy in metadata.

## Colour sample points (the `colours` check; 150 dpi raster of page 1, +/-4 per channel)

| point (mm from top-left) | expected |
|---|---|
| (5, 5) | #211a57 |
| (5, 292) | #fbfaf0 | (footer is on the page ground)
| (5, 100) | #fbfaf0 |
| (20, 45) | #f3f2d6 |
| (190, 48) | #ffffff |

## Superseded (do not build): the ruling's "Fold here" rule, royal footer band, big vertical lockup, Fraunces 28px name, 50 mm QR; and from the artifact: the emergency band/numerals, the Organiser and Questions sections, the two-line REG/ORDER footer on the ground without a rule, the old instruction sentence.
