# Post-deploy browser checks (after the push to beta; deploy authorisation is standing)

Deployed beta is the PREVIEW build (beta wall + SHOW_PLACEHOLDER_PREVIEW=true). The PUBLIC build cannot be deployed before launch, so the public half runs on a local production build with SITE_PUBLIC_LAUNCH=true, which `checks/rendered.mjs` builds itself. Both halves use the same script and the same assertions (E1..E9 in its header).

1. Local, both modes, three widths (the gate runs this too, assertion A9):
   `node .agent/memory/project/specs/events-redesign/checks/rendered.mjs`
2. Deployed preview (real beta, no local build; preview half only, EV_MODES selects it):
   `EV_MODES=preview EV_ORIGIN_PREVIEW=https://beta.saoc.co.za EV_PREVIEW_AUTH="Basic <base64 user:pass of the beta wall>" node .agent/memory/project/specs/events-redesign/checks/rendered.mjs`
   Expect E3 "preview rows carry the marker", E7 "preview shows the marker", E9 "strip lists the 19th National Show".
3. Browser agent screenshots, 1280 / 768 / 390, saved under .tmp/sandbox/events-redesign/shots/: `/events` preview, `/events` public (local), `/events` public with 0 listed events (the live Sanity data already gives this: the show is the only real event), `/` preview, `/` public. Show them. Critique with impeccable per the browser critique loop; measurement of "why" stays server-side.
4. Heading list in the PR comes from rendered.mjs's printed `heading list:` lines. The served-width bar on the ShowBand photo is a screenshot judgement (ruling gate): confirm the served image width at 1280@2x against the photo ruling.
5. Triad: Codex review with goldens/codex-qa-prompt.md (`execution/codex_qa.sh .agent/memory/project/specs/events-redesign/goldens/codex-qa-prompt.md`); gws inbox check not applicable (no email path touched).
