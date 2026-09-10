# p2-admin-mark-paid-route-brad-wants-it-w

**[P2] Admin "mark paid" route — Brad wants it, wants to discuss before it is built.**
  Use case: a buyer pays by EFT, no ITN arrives, the order sits reserved forever. This is also the
  only sound resolution for a paid-but-ITN-failed order — nothing Firestore records can
  distinguish that from an abandoned cart (see
  `specs/ticketing-capacity-reconciliation-hold/WITHDRAWN.md`), so a human deciding is the answer.
  Questions to settle: who may do it (its own capability, not general admin); what evidence is
  recorded (bank reference, acting uid, timestamp, immutable); does it send the confirmation email
  and QR; does it decrement capacity (it must, or manual sales oversell); can it be reversed.
  **Do not build unattended.**
