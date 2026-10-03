# p1-security-lee-ann-s-two-supplied-mailb

**[P1, security] Lee-Ann's two supplied mailbox passwords were published in a public repo.**
  `docs/leeann-source/website-development-specification-v3_2026-09-06.md` (committed 1d6512cb,
  pushed to the public InunuNet/SAOC) carried plaintext passwords for `info@saoc.co.za` and
  `treasurer-secretary@saoc.co.za`. Redacted from HEAD 2026-09-10; **git history still carries
  them and the repo was public throughout**, so removal does not undo the exposure. These are
  NOT the live mailbox passwords — the VPS migration generated fresh random ones and those were
  never committed (`ops-secrets.local.md` is gitignored and has never appeared on any ref). The
  real risk is reuse: our own note records that the treasurer-secretary value nearly matches the
  legacy cPanel login password and that the same value was reused across mailboxes. **Only Lee-Ann
  changing that password wherever she reuses it closes this.** Brad to raise it with her. Also
  tell her the Drive original should not carry credentials at all.
