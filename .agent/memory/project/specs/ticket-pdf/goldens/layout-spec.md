# NOS A4 ticket PDF — layout spec (golden)

AUTHORITY: Codi's review artifact claude.ai/artifact/1Zc87ALWvhA7eRdVkdq12W is the golden (Codi clarification relayed by team-lead,
2026-10-22): pages 1 and 2 plus its "How it holds up" table. Where codi-ruling.md's prose disagrees, the artifact wins.
Artifact version used: `1792425877-d0a8`, read 2026-10-22 (ticket-page-1.png / ticket-page-2.png, 909x1287 px = 4.329 px/mm,
saved under .tmp/sandbox/ticket-pdf/artifact/). Brad is reviewing the artifact; if Codi relays a change, this spec and the checks are revised, not the dev's guess.

Page: A4 portrait 210 x 297 mm (595.28 x 841.89 pt). Origin here is TOP-left (pdf-lib is bottom-left). 1 mm = 2.835 pt.
Artifact px -> mm: divide by 4.329. Type sizes below are artifact px converted to pt (px x 0.2310 x 2.835 = x0.655).

| token | hex | use |
|---|---|---|
| royal | #211a57 | header band, headings, ticket text |
| page | #fbfaf0 | page ground (everything outside the stub, tile and emergency band) |
| stub | #f3f2d6 | ticket stub (left), emergency band |
| ink | #3a3654 | body text |
| muted | #6a6780 | eyebrows, labels, footer text |
| olive | #a7a841 | rule under the ticket title |
| white | #ffffff | QR tile |
| gold on royal | #f3f2d6 | text in the header band |

Fonts: embedded subsets, real text, Fraunces (display) and Karla (labels, body). Never a standard-14 font (decisions.md D6 for the Karla Regular gap).

## Layout (mm from top-left, measured from the artifact)

| element | geometry |
|---|---|
| header band | y 0..29.8, full-bleed royal. The only solid-colour band. Horizontal reversed-gold lockup x 17.5..87.8, y 8.8..21.3 (the file's own aspect ratio). Right-aligned at x=196: "ADMIT ONE" (Karla bold ~7.5pt caps, tracking .14em, gold; baseline y~11.5) over "Ticket n of N" (Karla ~8.5pt gold; y~17.3). |
| ticket card | x 13.9..196, y 40..143.9, radius ~3.7. Left stub x 13.9..108.3 fill stub; right tile x 108.3..196 fill white. Vertical dashed perforation at x=108.3, y 40..143.9, royal ~0.5pt, dash ~1 mm. |
| stub text | padding ~9 mm (text x=22.9). Eyebrow y~50.4 (Karla bold 7.5pt caps tracking .14em muted). Title = ticket type (Fraunces light ~29pt royal, baseline y~63.5). Olive rule 0.5 mm, x 22.9..100, y 71.6. Large numeral (Fraunces light ~44pt royal, left x 22.9, baseline y~88) with beside it, at x~40: date line (Karla bold ~10.5pt royal, y~86.9) over time line (Karla ~10pt ink, y~92). Unknown date/time/numeral: pill "To be confirmed" in that spot. ATTENDEE label y~110.4 (muted caps), attendee name y~115.5 (Karla bold 16px = 12pt royal, Codi final). BOOKING REFERENCE label y~123.6, value y~128.9 (Karla bold ~11pt royal, tracking .08em via the `Tc` operator). |
| QR tile | QR modules ~55 mm square (Codi final: about 55 mm of modules), centred on the tile (centre x=152.2), top y 58.4..113.4. Vector black modules drawn from `QRCode.create(bookingRef).modules`; quiet zone >= 4 modules of white on every side (the tile supplies far more). Under it: "Scan at the door" (Karla bold ~7pt caps tracking .14em royal, y~125.9) then the booking ref (Karla bold ~10.5pt royal, tracking .08em, y~131.7), centred. |
| visit row | headings at y~155.5 (Fraunces ~13pt royal), columns x 13.9 / 82.2 / 142.5. Col 1 "The venue": venue name (Karla bold 9pt royal, y~163), address (Karla 9pt ink, 2 lines, y~168/174.5), "Parking and entrance" + pill (y~181 / 186). Col 2 "Opening times" or "Session times": rows label (Karla bold 9pt royal) + value or pill, y~164..185.5 at ~7 mm pitch. Col 3 "Show dates": show dates text (Karla 9pt ink, 2 lines) and the show URL (y~163..174.5). |
| emergency band | x 13.9..196, y 199.4..236.1, fill stub, radius ~3.7. "In an emergency" Fraunces ~13pt royal at y~207.9. Four columns x 21.9 / 64.7 / 107.4 / 150.2: the three numbers (Fraunces light ~24pt royal, y~216.4) with Karla 8.5pt ink labels (y~223.6, wrapped to a second line at ~228), the 4th cell "On-site first aid and show duty contact" (Karla bold 8.5pt royal) + pill. |
| organiser / questions | headings (Fraunces ~13pt royal) y~246.5 at x 13.9 and x 108.3. Organiser: name (Karla bold 9pt royal, y~254), "Show office" + pill (y~260.8). Questions: email (Karla 9pt ink, y~254), "Quote your booking reference." (y~260.8). |
| footer | NO band (artifact). On the page ground: left, x 13.9, y~282.8: "Present this ticket — or just the booking reference — at the door for check-in." (Karla 9pt ink). Right-aligned at x=196: REG line (FOOTER_REG, Karla bold ~6.5pt caps tracking .14em muted, y~283.2) over "ORDER <ref> · PAGE n OF N" (same style, y~286.7); when no order reference is known, "PAGE n OF N" only. |

The artifact's "existing footer line" (South African Orchid Council — saoc.co.za) is NOT drawn on the PDF (the artifact has none; it is in the allowlist only for tolerance).
If a band's content does not fit (very long name or address), shrink or wrap inside the band; never overlap regions, never run text under the QR tile.

## Pills / unknowns ("How it holds up": any detail we do not have shows "To be confirmed"; nothing is made up)

Pill: 0.5pt royal outline, fully rounded, Karla bold ~6.5pt caps tracking .14em, text exactly "To be confirmed" (or Sanity `pendingLabel` when set).
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
| (5, 292) | #fbfaf0 |
| (5, 100) | #fbfaf0 |
| (20, 45) | #f3f2d6 |
| (190, 48) | #ffffff |

## Superseded by the artifact (do not build): the ruling's "Fold here" rule, royal footer band and 30 mm vertical lockup, Fraunces 28px attendee name, 50 mm QR.
