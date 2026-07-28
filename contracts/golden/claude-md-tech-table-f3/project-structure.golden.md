```
app/
├── (marketing)/          # Public-facing pages (route group — no URL segment)
│   ├── page.tsx          # Home
│   ├── about/             # About SAOC
│   ├── societies/         # 21 affiliated societies + [slug] individual pages
│   ├── judging/           # Judging system overview
│   ├── events/            # Events calendar + [slug] detail
│   ├── national-show/     # Show overview + upcoming + archive/[year]
│   ├── media-kit/         # Media kit
│   ├── sponsors/          # Sponsors
│   ├── constitution/      # Constitution
│   ├── privacy/           # Privacy policy
│   ├── terms/             # Terms
│   └── contact/           # Contact form
├── admin/                # Firebase Auth-gated admin (login, door check-in scanner)
├── studio/               # Sanity Studio, mounted at /studio (see sanity.config.ts)
├── api/
│   ├── contact/           # Contact form POST handler → Firestore + Resend
│   ├── events/             # Event submission + per-event .ics export
│   ├── events.ics/         # Combined events feed
│   ├── tickets/            # PayFast checkout + ITN webhook → Firestore `tickets`
│   ├── admin/               # Session (Firebase Auth), check-in, CSV export
│   ├── draft/ + disable-draft/  # Sanity draft-mode preview toggles
│   └── revalidate/          # Sanity webhook → on-demand ISR revalidation
├── layout.tsx             # Root layout (html/body/fonts/globals)
└── globals.css            # Tailwind v4 import only

sanity/
├── schemas/                # Document + object schema types
└── lib/                    # Sanity client helpers

lib/
├── firebase.ts             # Client Firebase initialisation (singleton)
├── firebase-admin.ts       # Server Firebase Admin initialisation (singleton)
├── payfast.ts               # PayFast signature + sandbox constants
├── email.ts                 # Resend email sending
└── data/                    # Server-side data-fetch helpers

types/
└── index.ts                # Shared TypeScript types (Society, SocietyEvent, NationalShow, etc.)
```
