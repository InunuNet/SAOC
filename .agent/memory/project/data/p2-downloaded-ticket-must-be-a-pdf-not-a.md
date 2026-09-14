# p2-downloaded-ticket-must-be-a-pdf-not-a

**[P2] Downloaded ticket must be a PDF, not a PNG.** Currently
  `saoc-ticket-<ref>.png` (`components/tickets/DownloadTicketButton.tsx`). A PDF carries page size
  and vector text. **Watch:** the QR must stay crisp and scannable at print size — a downscaled or
  JPEG-compressed QR fails at the door, which is the one thing the artifact exists to do. Any
  contract needs a real scan test of the generated PDF, not "a PDF was produced".
