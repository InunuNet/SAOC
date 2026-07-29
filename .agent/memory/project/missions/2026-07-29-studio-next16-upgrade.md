---
schema: athanor.mission/v1
slug: studio-next16-upgrade
goal: Fix the Sanity Studio document-editor P0 by upgrading Next.js 15.5.19 to 16.x,
  whose vendored React exports useEffectEvent; verify Firebase App Hosting compatibility,
  all 62 routes, and the PayFast/admin surfaces; then confirm the Studio edit pane
  actually renders fields (closes RF-11)
created_at: '2026-07-29T17:03:36.555399+00:00'
started_at: null
last_active_at: '2026-07-29T18:17:12.821279+00:00'
status: done
cost_estimate:
  features: 6
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M3
  feature: F6
  ts: '2026-07-29T18:17:12.821279+00:00'
features:
- id: F1
  name: Next 16 upgrade blast-radius assessment (investigation only, no dep changes)
  status: done
  inline_brief: 'Investigation only, zero dependency changes. Read the Next 15 to
    16 upgrade guide via Alembic and enumerate breaking changes against THIS codebase:
    App Router APIs, next.config.ts, route handlers, sanity.config.ts, image optimisation,
    ISR and the revalidate webhook, and the (marketing)/admin/studio route groups.
    Note that serverExternalPackages was previously removed from next.config.ts as
    part of the studio SSR fix - check whether Next 16 changes that. Output a written
    risk register.'
  completed_at: '2026-07-29T17:12:29.962696+00:00'
- id: F2
  name: Firebase App Hosting + Next 16 compatibility verification
  status: done
  inline_brief: Confirm Firebase App Hosting supports Next 16 SSR before committing
    to the upgrade. This is the hard external constraint - if App Hosting cannot run
    Next 16, the approach dies and the fallback (pin Sanity to a pre-useEffectEvent
    release) becomes the plan. Check apphosting.yaml, the App Hosting runtime's supported
    Next versions, and any Node version floor Next 16 imposes. Evidence required,
    not vendor optimism.
  completed_at: '2026-07-29T17:12:30.153150+00:00'
- id: F3
  name: Execute the Next 15.5.19 to 16.x upgrade
  status: done
  inline_brief: Upgrade Next 15.5.19 to 16.x, pinned exact, preferring latest stable
    unless F1 surfaces a reason otherwise. Apply Next-provided codemods. Expect eslint-config-next
    and @next/* packages to move in lockstep. Clear .next fully afterwards using find
    .next -mindepth 1 -delete. Gated on an M1 go verdict.
  completed_at: '2026-07-29T18:08:31.486930+00:00'
- id: F4
  name: Full-surface regression pass (62 routes, PayFast, admin, API)
  status: done
  inline_brief: Prove nothing broke. All 62 routes render. type-check, lint and build
    green. PayFast checkout and ITN webhook (lib/payfast.ts, app/api/tickets/) unbroken.
    Admin auth session cookies and door check-in still work. Contact form to Firestore
    and Resend. ICS export routes, draft mode toggles, revalidation webhook. Rendered-output
    assertions, not source greps.
  completed_at: '2026-07-29T18:08:31.670497+00:00'
- id: F5
  name: RF-11 closure - Studio edit pane renders fields, live document round-trip
  status: done
  inline_brief: Open Studio on port 3333, click into a society and an event, confirm
    the edit pane renders its fields rather than crashing. Then a real round-trip
    - edit a field, publish, confirm persistence in Sanity and that the change surfaces
    on the front end. Also verify the deployed Studio at saoc-prod--saoc-webapp.europe-west4.hosted.app.
    Open since 2026-07-24 and cannot be machine-checked from source.
  completed_at: '2026-07-29T18:14:28.519363+00:00'
- id: F6
  name: Page singleton documents missing - assessment and remediation plan
  status: done
  inline_brief: Zero page singletons exist (no homePage, aboutPage, nationalShow,
    contactPage, judgingPage, membersPage) so homePageQuery returns null and components
    fall through to hardcoded defaults - the site is not actually CMS-driven. Determine
    what each singleton schema expects, what the front end hardcodes, and what the
    secretary would need to fill in. Produce a plan; do not bulk-create documents
    without content sign-off. Include the hostSociety gap (0/18 events populated).
  completed_at: '2026-07-29T18:17:12.821113+00:00'
milestones:
- id: M1
  name: Assess - know the cost before paying it
  features:
  - F1
  - F2
  gate: contract
  gate_ran_at: '2026-07-29T17:12:30.337863+00:00'
  gate_result: pass
  status: done
- id: M2
  name: Upgrade and prove nothing broke
  features:
  - F3
  - F4
  gate: contract
  gate_ran_at: '2026-07-29T18:08:31.854824+00:00'
  gate_result: pass
  status: done
- id: M3
  name: Close the P0 and scope what remains
  features:
  - F5
  - F6
  gate: contract
  gate_ran_at: '2026-07-29T18:17:13.014999+00:00'
  gate_result: pass
  status: done
---










# Mission: Sanity Studio P0 — Next.js 16 upgrade

## Context

### The bug

Opening **any** document in Sanity Studio crashes the editor pane:

```
TypeError: (0 , react__WEBPACK_IMPORTED_MODULE_2__.useEffectEvent) is not a function
    at useResetHistoryParams (sanity@5.31.1/lib/_chunks-es/structureTool.js:8658)
    at DocumentPaneInner (sanity@5.31.1/lib/_chunks-es/structureTool.js:8691)
```

Reproduced live 2026-07-29 at `http://localhost:3333/studio`. This is the original P0
first reported as "document list loads, edit pane blank" — the symptom is a crash, not
a blank render.

### Root cause (CONFIRMED 2026-07-29, with evidence)

Next.js App Router client components resolve `react` to Next's **vendored** copy, not
`node_modules/react`. Next 15.5.19 vendors React `19.2.0-canary-0bdb9206-20250818`,
which does **not** export `useEffectEvent`. Sanity 5.31.1 calls it. Hence `undefined`.

Empirically probed via `npm pack` + grep of `dist/compiled/react/cjs/react.development.js`:

| Next version        | Vendored React                  | `useEffectEvent` |
|---------------------|---------------------------------|------------------|
| 15.5.19 (current)   | 19.2.0-canary-0bdb9206-20250818 | absent           |
| 15.5.22 (latest 15) | 19.2.0-canary-0bdb9206-20250818 | absent           |
| 16.0.0              | 19.3.0-canary-2bcbf254-20251020 | present          |
| 16.2.12 (latest)    | 19.3.0-canary-3f0b9e61-20260317 | present          |

**No Next.js 15 release can fix this.** 15.x is in maintenance and will not get a new
React vendor. Sanity 5.31.1's peer range (`react ^19.2.2`) exists precisely because it
depends on this API.

### Why three prior sessions missed it

Earlier investigations checked `node_modules/react` — genuinely 19.2.7, genuinely exports
`useEffectEvent`, single copy, peer range satisfied. All true, and all irrelevant: that
copy is never used by the client bundle. The `contract-sanity-react-peer-fix` work
(bumping declared `^19.0.0` -> `^19.2.2`) was correct hygiene that could not have fixed
the bug. **When diagnosing a client-side React API gap in Next App Router, check
`node_modules/next/dist/compiled/react`, not `node_modules/react`.**

A CORS/port issue masked this for months: only `http://localhost:3333` was whitelisted
on Sanity project `26yfbug4`, while dev servers ran on 3000/3002. Nobody could get far
enough into Studio to open a document and see the real error. Running dev on **3333**
sidesteps it without touching Sanity settings.

### Verified working (do not re-investigate)

- Sanity dataset `production`: 94 docs — society 21, societyEvent 18, showClass 10,
  province 9, award/boardMember/show/sponsor 6 each. Read + write API access confirmed.
- Studio loads, authenticates, renders the full schema tree.
- The site itself is unaffected: `pnpm build` green, all 62 routes generate,
  type-check and lint clean.

### Separate finding (F6, not the P0)

**Zero page-singleton documents exist** — no homePage, aboutPage, nationalShow,
contactPage, judgingPage or membersPage. `homePageQuery` returns null and the components
fall through to hardcoded defaults. So the site's page copy is currently NOT CMS-driven,
contrary to what `docs/secretary-cms-guide.md` promises the secretary. This is content +
wiring work, independent of the crash — but it is the difference between "Studio opens"
and "SAOC has a working editing back-end."

---

## Milestones

### M1 — Assess: know the cost before paying it

**F1 — Next 16 upgrade blast-radius assessment (investigation only).**
No dependency changes. Read the Next 15 -> 16 upgrade guide (via Alembic), enumerate
breaking changes against this codebase specifically: App Router APIs, `next.config.ts`,
middleware, route handlers, `sanity.config.ts`, image optimisation, caching/ISR
semantics (`app/api/revalidate/`), and the `(marketing)` / `admin` / `studio` route
groups. Note that `next.config.ts` previously had `serverExternalPackages` removed as
part of the studio SSR fix — check whether Next 16 changes that calculus. Output: a
written risk register, not a patch.

**F2 — Firebase App Hosting + Next 16 compatibility.**
Confirm App Hosting supports Next 16 SSR before committing. This is the hard external
constraint — if App Hosting cannot run Next 16, the whole approach dies and the fallback
(pin Sanity back to a pre-`useEffectEvent` release) becomes the plan instead. Check
`apphosting.yaml`, the App Hosting runtime's supported Next versions, and any Node
version floor Next 16 imposes.

**M1 gate:** a written go/no-go with evidence. Do not proceed to M2 on optimism.

### M2 — Upgrade and prove nothing broke

**F3 — Execute the upgrade.** Next 15.5.19 -> 16.x (pin exact; prefer latest stable
unless F1 surfaces a reason otherwise). Apply codemods where Next provides them. Expect
`eslint-config-next` and possibly `@next/*` packages to move in lockstep.

**F4 — Full-surface regression pass.** All 62 routes render. `pnpm type-check`, `pnpm
lint`, `pnpm build` green. PayFast checkout + ITN webhook (`lib/payfast.ts`,
`app/api/tickets/`) unbroken. Admin auth session cookies (`firebase-admin/auth`) and
door check-in still work. Contact form -> Firestore + Resend. ICS export routes. Draft
mode toggles. Revalidation webhook.

**M2 gate:** contract with rendered-output assertions, not source greps — see the F6
lesson in `learned.md`.

### M3 — Close the P0 and scope what remains

**F5 — RF-11 closure.** Open Studio, click into a society and an event, confirm the
edit pane renders its fields. Then a real round-trip: edit a field, publish, confirm
persistence in Sanity and that the change surfaces on the front end. This is the
assertion that has been open since 2026-07-24 — it cannot be machine-checked from source
and must be verified against a live browser. Also verify the deployed Studio
(`saoc-prod--saoc-webapp.europe-west4.hosted.app`, already CORS-allowed).

**F6 — Page singletons: assessment and remediation plan.** Determine what each singleton
schema expects, what the front end currently hardcodes, and what the secretary would
need to fill in. Produce a plan; do not bulk-create documents without content sign-off.
The `hostSociety` gap (0/18 events populated) belongs in the same pass.

---

## Constraints

- **Do not touch Sanity CORS settings.** Run dev on port 3333, which is already
  whitelisted. If a different port is ever needed, that is a deliberate decision.
- **Never run `pnpm build` while a dev server is up** — it corrupts the dev server's
  `.next` manifest (404s on all static chunks). Sequence them.
- **Clear `.next` fully after any dependency or Tailwind class change** —
  `rm -rf` is blocked by the security hook; use `find .next -mindepth 1 -delete`.
  A stale cache silently fails to compile new classes.
- **Scope freeze still in force** on Section 7 schemas and un-built National Show pages
  pending the client scope conversation — see backlog.md. This mission must not drift
  into building new pages.
- Rendered-output assertions over source greps, per the F6 lesson.

## Notes

- Fallback if M1 returns no-go: pin Sanity to a release predating its `useEffectEvent`
  usage. Treat as a fallback, not a plan — it means running the CMS permanently behind
  to accommodate a framework we are also behind on.
- Partial rendered-check harness exists at `contracts/checks/f6-home-fidelity/`
  (9 check files + `_shared.mjs`, playwright devDependency) but is not wired to any
  contract assertion. Reusable here; finishing it is already in the backlog.
- Prior investigation writeup: `docs/sanity-studio-p0-investigation.md`. Its React-peer
  and Free-plan conclusions are superseded by the root cause above.
