# nos-critique-r9 F4 - one emergency label filter, exhibitor short tag confirmed (interim QA P3s 2 and 3)

BASE = r8 tip 812dbaa2 (restacked on main 81490e7a; was 6bffbe7c). Footprint: goldens/f4-footprint.json (VisitDisclosure.tsx, plan-your-visit/page.tsx) + docs/nos-critique-r9.md.

(2) Dedupe: plan-your-visit/page.tsx filters the emergency contacts by label and VisitEmergency filters them again. Decision: VisitEmergency keeps the filter (it needs it for its null return and must stay safe on its own); the page stops filtering and passes info?.emergencyContacts ?? [] straight through. Behaviour is unchanged (fixture: unlabelled contacts, and their numbers, are never drawn; all-unlabelled or empty draws nothing).

(3) Exhibitor-kind short tag: no code change. The exhibitor-kind pending chip showing "To be confirmed" at <=359 (now < 360) on the exhibitors page is the ruled behaviour: r8 F1 ruling item 4 (Codi FINAL) put ShowStatusLine's chips on exhibitors and what-to-expect in scope. It stays opt-in: ShowStatusLine passes shortOnNarrow, ExhibitorStatusBadge (SAOC callers) does not. Pinned by f4-static S3 and the f4 fixture. Flag to the lead: nothing for Codi to answer unless the exhibitors page should be excluded.

NO INVENTION: no copy change.
