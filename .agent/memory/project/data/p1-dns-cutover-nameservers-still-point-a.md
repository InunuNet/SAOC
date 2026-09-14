# p1-dns-cutover-nameservers-still-point-a

**[P1] DNS cutover.** Nameservers still point at the old cPanel host. Sequence:
  re-pull mail from the legacy host one final time immediately before cutover (the 2026-07-20
  restore is a snapshot) → switch nameservers → only THEN add any further Resend DNS records.
  Adding them before the switch loses them silently with no code change to blame.
