# Goals

## Mission

Build and maintain the South African Orchid Council's digital presence and tooling. SAOC is the workspace for this project, running on the Athanor agentic framework.

## Active Goals

1. Establish what the SAOC project needs to build (website, membership system, events, etc.)
2. Keep the Athanor workspace healthy and in sync
3. Deliver working software for the South African Orchid Council

## Current Mission Status (updated 2026-07-30)

`cms-activation-deploy` — 5 of 6 features done (F1 hydration fix, F2 deploy + secret-corruption
fix, F3 singleton desk pinning, F4 seed six page singletons, F5 event slugs/hostSociety). F6
(prove a Studio edit reaches the live site) is BLOCKED on a Firebase App Hosting CDN edge that
never purges on `revalidateTag()` — a platform-level gap, not something this codebase can fix
alone. See `backlog.md` "[P0 BLOCKER] The CMS→site loop does not work in production" for the
live detail and next steps.
