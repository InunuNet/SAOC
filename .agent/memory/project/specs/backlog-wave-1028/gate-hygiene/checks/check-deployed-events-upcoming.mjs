// gate-hygiene RUN-AFTER-DEPLOY check: beta /events answers 200 and lists at least one upcoming event.
// Plain check, not the browser_deployed_check kind: that kind's live re-check sends no auth and beta answers 401 behind the
// Basic Auth wall (backlog 2026-10-07, execution/browser_deployed_check.sh:188). Credentials are read from
// BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD inside this script and never printed.
// Run as: node --env-file-if-exists=.env.local <this file>   (from the project root, after the change is deployed to beta)
// Exit 0 PASS, 1 FAIL (a real finding), 2 inconclusive (credentials missing or beta unreachable).
const ORIGIN = 'https://beta.saoc.co.za';
const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
if (!user || !pass) { console.error('INCONCLUSIVE: BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD not set (run from the project root with .env.local)'); process.exit(2); }

let res;
let html;
try {
  res = await fetch(`${ORIGIN}/events`, { headers: { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }, signal: AbortSignal.timeout(20000) });
  html = await res.text();
} catch (error) {
  console.error(`INCONCLUSIVE: could not reach ${ORIGIN}/events (${error.name})`);
  process.exit(2);
}
if (res.status !== 200) { console.error(`FAIL: ${ORIGIN}/events returned ${res.status}, want 200`); process.exit(1); }

// Event detail links only: /events/<slug>, excluding the members-only submit form and non-page routes.
const slugs = [...new Set([...html.matchAll(/href="\/events\/([a-z0-9][a-z0-9-]*)"/g)].map((m) => m[1]))].filter((s) => s !== 'submit');
if (slugs.length === 0) { console.error('FAIL: /events lists no upcoming event links'); process.exit(1); }
console.log(`PASS: ${ORIGIN}/events 200, ${slugs.length} upcoming event link(s)`);
