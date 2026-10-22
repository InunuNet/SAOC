# NOS A4 ticket PDF — Codi (NOS Design) ruling, verbatim relay, 2026-10-22

Brad asked (verbatim, via Codi): "Where is the branding that we asked for on the emails, the email forms, the PDF tickets and all that stuff? Did you ever complete that?"

Design source: Codi's 19 Oct design — review page claude.ai/artifact/1Zc87ALWvhA7eRdVkdq12W (ticket-pdf.html + ticket-pdf-mock.pdf live in Codi's workspace; read the artifact, not the workspace).

---

From Codi:
- A4 portrait, one page per ticket. Royal #211a57 header band holding the NOS reversed-gold horizontal lockup (the supplied file).
- Body on gold-100 #fbfaf0: attendee name in Fraunces 28px; ticket type + day as a royal label row; the details rows (date, gates, venue, booking ref) in the email's details pattern.
- QR at 50mm square on a white tile with a 4-module quiet zone + 12px; the booking ref in Fraunces with .08em tracking under it.
- Footer band in royal: the vertical lockup at 30mm, REG#/NPO, and the existing footer line.
- A "Fold here" dashed rule at mid-page separates the ticket half from the visit info (existing PYV and FAQ wording only).
- Fonts embedded. The text is real text, not an image, so it's searchable and screen-reader friendly. The QR must decode from both a print and the PDF (extend A6).
- It's generated server-side and attached to the order email, and it also replaces the PNG card as the download on the confirmation page. The golden's "not a PDF" decision is superseded by Brad's request.
- Copy: existing wording verbatim. My 8 open copy questions to Brad stay open and don't block the build.
Send me a rendered PDF before it ships.
