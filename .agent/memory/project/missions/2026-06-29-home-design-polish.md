---
schema: athanor.mission/v1
slug: home-design-polish
goal: Match all home page chrome and sections to the Claude Design HTML reference
created_at: '2026-06-29T07:10:05.419127+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 6
  milestones: 2
  total_calls: 18
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
  - id: F1
    title: UtilityBar — remove duplicate tagline
    status: pending
    inline_brief: "Remove the centre <span> 'Making a difference since 1968' from UtilityBar.tsx (line 37-39). It duplicates the tagline in the logo lockup below."
  - id: F2
    title: Header — logo wordmark font-weight 500→600
    status: pending
    inline_brief: "Change font-medium to font-semibold on the 'SA Orchid Council' wordmark span in Header.tsx (line 83). Design spec fontWeight: 600."
  - id: F3
    title: Footer — 4-col rebuild
    status: pending
    inline_brief: "Col 1: replace flat PNG logo with stacked logo (mark + SA Orchid Council serif 600 + tagline mono). Col 4: replace Contact link with Stay in touch section (copy: 'Quarterly bulletin — show dates, judging results and yearbook news.', email input + Subscribe button, 'Looking for wild orchids?' mono label, 'Visit Wild Orchids of Southern Africa →' link). Bottom bar: Terms→Constitution, add Media kit link."
  - id: F4
    title: YearbookStrip — restore 2-col layout with image
    status: pending
    inline_brief: "Restore 2-column layout (was removed in commit 3b7d686). Left: eyebrow, h2 with <em>Orchids South Africa</em> italic, body text, meta flex row, CTAs. Right: /images/orchid-pink.jpg fill image. Keep current text styling."
  - id: F5
    title: PartnersSection — commit existing file
    status: pending
    inline_brief: "components/home/PartnersSection.tsx is already written and wired into app/(marketing)/page.tsx but is uncommitted. Stage and commit it."
  - id: F6
    title: Hero — centre, darken scrim, fix primary CTA
    status: pending
    inline_brief: "Three changes: (1) Change items-start text-left → items-center text-center on content div. (2) Darken scrim gradient from 'from-primary/80 via-primary/40 to-transparent' to something like 'from-primary via-primary/75 to-primary/40' so ivory headline is crisp against dark background. (3) Change primary CTA button from bg-accent text-ivory → bg-primary text-ivory (dark sage not brass)."
milestones:
  - id: M1
    title: Chrome + Hero complete
    features: [F1, F2, F3, F6]
  - id: M2
    title: Home sections complete
    features: [F4, F5]
---

# Mission: home-design-polish

## Context

Matching all home page sections to the Claude Design HTML reference at
`design/Claude Design HTML/SAOC Website (standalone).html`.

Design tokens: --serif: Crimson Pro, --sans: Manrope, --mono: JetBrains Mono
Colors: --primary: #384138, --primary-800: #22281f, --accent: #9e8c6b, --ivory: #f4f3ec

## Notes

Files in scope:
- components/chrome/UtilityBar.tsx (F1)
- components/chrome/Header.tsx (F2)
- components/chrome/Footer.tsx (F3)
- components/home/Hero.tsx (F6)
- components/home/YearbookStrip.tsx (F4)
- components/home/PartnersSection.tsx (F5, commit only)
