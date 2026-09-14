# p1-qr-code-image-does-not-render-in-the

**[P1] QR code image does not render in the confirmation email.** Gmail shows the
  broken-image placeholder with its alt text. Generation is fine — it renders on the confirmation
  page and in the downloaded file. Likely cause: the email references the QR by URL or data: URI;
  Gmail proxies remote images and strips data: URIs. Robust fix is a CID-attached inline image
  (Resend supports attachments with a content id). **"It renders in my browser preview" is not
  proof of a fix** — this defect only exists in the real client, so any assertion must check what
  the delivered email contains, and the fix needs a real send to a real Gmail inbox.
