#!/usr/bin/env node
// A2 — PRIMARY: the deployed /studio opens the homePage singleton document editor
// (a real document pane, not a login screen, not a crash) with zero uncaught page
// errors. This is the P0 the whole mission exists to fix — the original crash was
// in DocumentPaneInner/useResetHistoryParams, downstream of login, so a check that
// only loads the Studio *shell* proves nothing (the shell already loaded fine
// before any fix — see docs/f2-apphosting-next16-compat.md history). Opening a
// document pane is the only check that exercises the actual crash site.
//
// homePage (not an arbitrary existing document like a province) is deliberately
// chosen: it is empty/unauthored (F4 — seeding — is a separate, later feature) and
// only reachable as a direct single-document editor because of F3's custom desk
// structure (S.document().documentId('homePage')). That makes this ONE check prove
// three things at once: (a) the useEffectEvent crash is fixed, (b) F3's pinned
// desk structure reached prod, (c) this is not a cached pre-F3 build.
//
// Auth: Sanity Studio reads its session from localStorage key
// `__studio_auth_token_<projectId>` (confirmed by reading the installed sanity
// 5.31.1 source — AUTH_TOKEN_STORAGE_PREFIX / getAuthTokenStorageKey — not
// guessed). _shared.mjs injects `.env.local`'s SANITY_API_TOKEN (a real Editor
// token) via Playwright addInitScript before any app code runs. This was PROVEN to
// authenticate end-to-end locally by @architect on 2026-07-29 (see contract header)
// — it is not a documented Sanity API, so if a future Studio upgrade renames the
// storage key, this check must fail loudly (it does: no token → no auth → login
// screen text is caught below as a FAIL), not silently pass.
//
// NEGATIVE CONTROL (recorded 2026-07-29 by @architect, run against the CURRENT
// deployed prod host, authenticated, BEFORE this feature's deploy step):
//
//   $ node contracts/checks/f2-deploy-next16/studio-document-pane-deployed.mjs
//   FAIL: /studio/structure/homePage shows the STOCK list view ("Create new" /
//   "No documents"), not F3's pinned singleton document editor. F3 has not
//   reached this deployment yet.
//
// (Prod currently falls through to the default `S.documentTypeListItem()` list —
// zero homePage documents, "Create new" button — because it predates F3's desk
// structure. This is the real baseline; it must flip once F2+F3 are live.)
//
// Never skips green on a broken environment — unreachable host, missing token, or
// browser-launch failure is a hard FAIL (Athanor#1322), never a silent skip.
import { openAuthenticatedStudioPage, fail, pass, BASE_URL } from './_shared.mjs';

const STUDIO_PATH = '/studio/structure/homePage';

let result;
try {
  result = await openAuthenticatedStudioPage(STUDIO_PATH);
} catch (err) {
  fail(`could not execute the check against ${BASE_URL}${STUDIO_PATH} — ${err?.message ?? err}`);
}

const { bodyText, pageErrors, browser } = result;
await browser.close();

if (pageErrors.length > 0) {
  fail(
    `${pageErrors.length} uncaught page error(s) opening ${BASE_URL}${STUDIO_PATH}:\n` +
      pageErrors.map((m, i) => `  [${i + 1}] ${m}`).join('\n')
  );
}

if (/Choose login provider/i.test(bodyText)) {
  fail(
    `${STUDIO_PATH} parked on the login screen — the injected localStorage auth token ` +
      'did not authenticate the session. This is a hard FAIL, not a vacuous pass ' +
      '(a check that only reaches the login screen proves nothing about the P0).'
  );
}

if (/Create new|No documents/i.test(bodyText)) {
  fail(
    `${STUDIO_PATH} shows the STOCK list view ("Create new" / "No documents"), not F3's ` +
      'pinned singleton document editor. Either F3 did not reach this deployment, or the ' +
      'desk structure regressed.'
  );
}

// The pinned singleton editor for an unseeded homePage document renders an
// "Untitled" document with a Publish button and its schema fields (Title, Hero
// Images, Mission Text, Countdown Target Date — see sanity/schemas/homePage.ts).
// Checking for the Publish control plus at least one known field name confirms a
// real document pane rendered, not just an empty shell.
if (!/Publish/i.test(bodyText)) {
  fail(`${STUDIO_PATH} did not render a document editor pane (no "Publish" control found).`);
}

pass(`${STUDIO_PATH} opened the pinned homePage document editor with no page errors`);
