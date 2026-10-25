// Fixture routes never render on the deployed site (Codex review). /media-kit-fixtures renders the media kit
// body without its admin gate and /ticket-fixtures/buy renders the purchase form over a static ticket; both are
// env-flag gated for the local render checks. Firebase App Hosting runs on Cloud Run, which sets K_SERVICE, so
// each route must 404 whenever K_SERVICE is set, even if its flag were set there. NODE_ENV cannot be the guard
// (it is 'production' under the local `next start` the gates use).
//   flag=1 and K_SERVICE set -> 404 (both routes)
//   flag=1 locally           -> 200 and the page content (both routes)
// Needs a production build (pnpm build). Run as: node contracts/checks/polish-wave-2-2026-10-25/fixture-hosted-guard.mjs
import { finish } from './_lib.mjs';
import { buildProblem, get, startServer } from './_server.mjs';

const ROUTES = [
  { path: '/media-kit-fixtures', flag: 'MEDIA_KIT_FIXTURES', marker: 'Mark only' },
  { path: '/ticket-fixtures/buy', flag: 'TICKET_FIXTURES', marker: 'Continue to payment' },
];

const failures = [];
const stale = buildProblem(['app/media-kit-fixtures/page.tsx', 'app/ticket-fixtures/buy/page.tsx']);
if (stale.length) finish('fixture-hosted-guard', stale);

async function probe(env) {
  const srv = await startServer({ env });
  try {
    const results = [];
    for (const r of ROUTES) results.push({ ...r, ...(await get(srv.port, r.path, 'localhost')) });
    return results;
  } finally {
    srv.stop();
  }
}

const hosted = await probe(Object.fromEntries([...ROUTES.map((r) => [r.flag, '1']), ['K_SERVICE', 'saoc-site']]));
for (const r of hosted) {
  if (r.status !== 404) failures.push(`${r.path}: ${r.flag}=1 with K_SERVICE set gave ${r.status}, want 404 on the hosted runtime`);
}

const local = await probe(Object.fromEntries(ROUTES.map((r) => [r.flag, '1'])));
for (const r of local) {
  if (r.status !== 200) failures.push(`${r.path}: ${r.flag}=1 locally gave ${r.status}, want 200`);
  else if (!r.body.includes(r.marker)) failures.push(`${r.path}: ${r.flag}=1 locally rendered without "${r.marker}"`);
}

finish('fixture-hosted-guard', failures);
