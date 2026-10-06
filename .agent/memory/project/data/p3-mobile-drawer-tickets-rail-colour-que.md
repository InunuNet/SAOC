# p3-mobile-drawer-tickets-rail-colour-que

**[P3, design question for Brad] Mobile drawer Tickets rail renders in SAOC default dark
green, not NOS royal-purple like the desktop mega-menu** (menu-system-layout4 F8, found
2026-10-03). F8's scope was `MegaMenu.tsx` (desktop) only, so `MobileMenu.tsx`'s drawer never
picked up the NOS colour treatment. Evidence:
`.agent/memory/project/specs/menu-system-layout4/evidence/mobile-drawer-606px.jpg`. Needs
Brad's call against the approved handoff — do not implement a mobile-drawer colour change
without it (no invented brand decisions).
