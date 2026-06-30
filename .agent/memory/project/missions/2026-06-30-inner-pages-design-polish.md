---
schema: athanor.mission/v1
slug: inner-pages-design-polish
goal: Match all inner page heroes and section layouts to the Claude Design reference
created_at: '2026-06-30T08:07:29.843972+00:00'
started_at: null
last_active_at: null
status: complete
cost_estimate:
  features: 5
  milestones: 2
  total_calls: 12
last_checkpoint:
  milestone: M2
  feature: F5
  ts: '2026-06-30T00:00:00+00:00'
features:
  - id: F1
    title: PageHero component — centre-align content to match design reference
    status: done
    inline_brief: >
      Update components/ui/PageHero.tsx: change the inner content div from
      items-end/left-aligned to items-center text-center, matching the About reference
      screenshot (02-about.png) where eyebrow, heading, and lede are all centred.
      Keep the gradient direction (bg-gradient-to-t) unchanged.
  - id: F2
    title: About page — use orchid-violet.jpg to match purple reference screenshot
    status: done
    inline_brief: >
      Change app/(marketing)/about/page.tsx PageHero image prop from
      /images/orchid-dark.jpg to /images/orchid-violet.jpg. The design reference
      screenshot shows a violet/purple orchid background, not the dark image.
  - id: F3
    title: National Show page — align hero to design standards
    status: done
    inline_brief: >
      app/(marketing)/national-show/page.tsx uses an inline hero (not PageHero).
      Verify its structure matches the established design pattern: dark scrim,
      centred text, eyebrow pill. Update to use PageHero or align inline hero
      styling to match. No content changes — visual layout only.
  - id: F4
    title: Societies, Judging, Events, Contact — verify hero images and copy
    status: done
    inline_brief: >
      Verify all four pages (societies, judging, events, contact) have appropriate
      hero images. Societies/Judging/Events currently use orchid-purple.jpg;
      Contact uses orchid-pink.jpg. Confirm these are correct per design system
      (no specific reference screenshots available for these pages). No changes
      needed unless something is clearly wrong — this is a verification step.
  - id: F5
    title: Build verification — pnpm build must pass
    status: done
    inline_brief: >
      Run pnpm build and confirm zero errors. TypeScript strict mode — no any,
      no type assertions. All pages must compile cleanly.
milestones:
  - id: M1
    title: PageHero and About fixes implemented, QA green
    features: [F1, F2]
    status: done
  - id: M2
    title: All inner pages consistent, full QA pass, committed
    features: [F3, F4, F5]
    status: done
---

# Mission: inner-pages-design-polish

## Context

The home-design-polish mission (2026-06-29) matched the home page chrome and sections to
the Claude Design HTML reference. This mission applies the same treatment to all inner pages.

Design reference: `design/design_handoff_saoc/screenshots/02-about.png` (only usable
inner-page reference — other screenshots are all-black captures). The About reference shows:
- Centered eyebrow/heading/lede layout
- Purple orchid background image
- "OUR HERITAGE" eyebrow pill
- "A federated body of growers, since 1968." heading

Current gap: `components/ui/PageHero.tsx` uses left-aligned, bottom-pinned content
(`items-end`, no `text-center`). The About reference and design system (consistent with
the home hero's `items-center text-center`) require centered alignment.

Pages using PageHero: About, Societies, Judging, Events, Contact.
National Show uses an inline hero (no PageHero).

## Notes

- Do NOT change the gradient direction — `bg-gradient-to-t` (bottom-to-top scrim) is correct
  for bottom-aligned image compositions.
- The home Hero uses `bg-gradient-to-b` (top-to-bottom) because text is centered vertically.
  PageHero places text at the bottom, so the gradient reads correctly.
- After centering, verify that all inner page headings still fit within line limits.
- `orchid-violet.jpg` exists in public/images/ — use it for About.
