# p2-post-api-contact-needs-a-test-mode-gu

**[P2] `POST /api/contact` needs a test-mode guard or mocked mailer before automated
  coverage** (found 2026-09-08, `ticketing-complete` overnight session). The route sends a real
  Resend email and writes a real `contactSubmissions` doc on every successful POST, with no
  test-mode gate. Manually proving the new suggestion form end-to-end mailed a non-existent
  address at a reserved domain and left a live queue document (since deleted by exact id).
  Bounces accrue against a sending domain currently mid-migration on domain + Resend DNS. Add a
  mocked mailer or a test-mode guard on the route before any Playwright/automated coverage of
  `ContactForm` or `SuggestionForm`.
