# p1-functional-ticketing-shared-offered-t

**[P1 functional, ticketing SHARED, offered to NOS Site 2026-10-29] Order-recovery email link 404s.** lib/recovery-url.ts:14 builds `/tickets/recover?token=`, sent by lib/confirmation-email.ts:180; no app/ route serves it (app/(nos)/tickets/[slug] treats "recover" as an unknown slug → 404). F6 spec §8.2 deep link was never routed. Must land before ticketing goes live 1 Dec 2026. Builder flips F5's cache-probe entry to 200, page stays dynamic/no-store.
