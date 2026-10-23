// Mission nos-site-split — host-routing gate. Starts `next start` (needs a prior `pnpm build`) on a
// fixed local port with sandbox-only env, then asserts the routing matrix from
// .agent/memory/project/specs/nos-site-split/goldens/host-routing.golden.md using Host headers.
// Read-only against the app: GET/HEAD only, no Sanity/Firestore writes. Logs go to .tmp/sandbox/nos-split/.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import http from 'node:http';

const PORT = 3217;
const SAOC_HOST = `saoc.localhost:${PORT}`;
const NOS_HOST = `nos.localhost:${PORT}`;
const SAOC_ORIGIN = `http://${SAOC_HOST}`;
const NOS_ORIGIN = `http://${NOS_HOST}`;
const USER = 'sandbox';
const PASS = 'sandbox-pass';
const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
const LOG_DIR = '.tmp/sandbox/nos-split';

mkdirSync(LOG_DIR, { recursive: true });
const log = openSync(`${LOG_DIR}/next-start.log`, 'w');
const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], {
  stdio: ['ignore', log, log],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    BETA_BASIC_AUTH_USER: USER,
    BETA_BASIC_AUTH_PASSWORD: PASS,
    SITE_PUBLIC_LAUNCH: '',
    NEXT_PUBLIC_SAOC_SITE_URL: SAOC_ORIGIN,
    NEXT_PUBLIC_NOS_SITE_URL: NOS_ORIGIN,
    SITE_URL: SAOC_ORIGIN,
  },
});

function get(host, path, { auth = true, extraHeaders = {} } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { host, ...extraHeaders };
    if (auth) headers.authorization = AUTH;
    const req = http.request({ host: '127.0.0.1', port: PORT, path, method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error(`timeout ${host}${path}`)));
    req.end();
  });
}

const failures = [];
function check(name, ok, detail = '') {
  if (!ok) failures.push(`${name} ${detail}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
}
// Same-host redirects may come back absolute (configured origin) or relativised by Next.
const redirectsTo = (r, location) =>
  r.status === 308 && (r.headers.location === location || (location.startsWith('/') && r.headers.location === `${NOS_ORIGIN}${location}`));

async function waitUp() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await get(SAOC_HOST, '/robots.txt', { auth: false });
      if (r.status) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('next start did not come up in 90s; see ' + LOG_DIR + '/next-start.log');
}

async function run() {
  await waitUp();

  // Password wall on both hosts.
  for (const [label, host] of [['saoc', SAOC_HOST], ['nos', NOS_HOST]]) {
    const r = await get(host, '/', { auth: false });
    check(`wall-401-${label}`, r.status === 401, `got ${r.status}`);
  }
  const hook = await get(NOS_HOST, '/api/tickets/ozow-itn', { auth: false });
  check('webhook-exempt-on-nos', hook.status !== 401 && hook.status !== 308, `got ${hook.status}`);

  // Home pages by host.
  const sHome = await get(SAOC_HOST, '/');
  const nHome = await get(NOS_HOST, '/');
  check('saoc-home-200', sHome.status === 200 && sHome.headers['x-site'] === 'saoc', `got ${sHome.status} x-site=${sHome.headers['x-site']}`);
  check('nos-home-200', nHome.status === 200 && nHome.headers['x-site'] === 'nos', `got ${nHome.status} x-site=${nHome.headers['x-site']}`);
  check('nos-home-is-show-hub', /National Orchid Show/i.test(nHome.body));
  check('nos-noindex-header', /noindex/.test(nHome.headers['x-robots-tag'] || ''));
  check('saoc-home-links-to-nos-origin', sHome.body.includes(`href="${NOS_ORIGIN}`));
  check('saoc-home-no-local-show-links', !/href="\/(national-show|tickets|vsp)(\/|")/.test(sHome.body) && !sHome.body.includes('/national-show'));
  check('nos-home-links-to-saoc-origin', nHome.body.includes(`href="${SAOC_ORIGIN}`));
  check('nos-home-credits-saoc', /South African Orchid Council/.test(nHome.body));

  // SAOC host: show tree redirects to NOS (internal paths preserved, query preserved).
  const toNos = ['/national-show', '/national-show/symposium', '/national-show/tickets', '/tickets/some-slug', '/vsp?token=x'];
  for (const p of toNos) {
    const r = await get(SAOC_HOST, p);
    check(`saoc-redirects-${p}`, redirectsTo(r, `${NOS_ORIGIN}${p}`), `status=${r.status} location=${r.headers.location}`);
  }

  // NOS host: clean URLs. Old prefix 308s to the clean path; clean paths serve the show tree.
  const hubAlias = await get(NOS_HOST, '/national-show');
  check('nos-national-show-root-to-slash', redirectsTo(hubAlias, '/'), `status=${hubAlias.status} location=${hubAlias.headers.location}`);
  const stripped = await get(NOS_HOST, '/national-show/symposium?x=1');
  check('nos-prefix-stripped', redirectsTo(stripped, '/symposium?x=1'), `status=${stripped.status} location=${stripped.headers.location}`);
  for (const p of ['/symposium', '/tickets', '/vendors', '/sponsors', '/about', '/faq', '/privacy', '/terms', '/refunds']) {
    const r = await get(NOS_HOST, p);
    check(`nos-serves-${p}`, r.status === 200 && r.headers['x-site'] === 'nos', `status=${r.status}`);
  }
  for (const p of ['/privacy', '/terms', '/refunds']) {
    const r = await get(SAOC_HOST, p);
    check(`saoc-serves-shared-${p}`, r.status === 200 && r.headers['x-site'] === 'saoc', `status=${r.status}`);
  }
  for (const p of ['/contact', '/societies', '/events', '/judging', '/constitution', '/members']) {
    const r = await get(NOS_HOST, p);
    check(`nos-redirects-${p}-to-saoc`, redirectsTo(r, `${SAOC_ORIGIN}${p}`), `status=${r.status} location=${r.headers.location}`);
  }
  for (const p of ['/about', '/societies', '/events', '/judging', '/sponsors', '/contact']) {
    const r = await get(SAOC_HOST, p);
    check(`saoc-serves-${p}`, r.status === 200 && r.headers['x-site'] === 'saoc', `status=${r.status}`);
  }
  // Ozow short top-level return routes stay top-level on NOS (not rewritten into the prefix).
  const cancelled = await get(NOS_HOST, '/tickets/cancelled?ref=PROBE');
  check('nos-ticket-cancelled-route-served', cancelled.status !== 404 && cancelled.status !== 308, `status=${cancelled.status}`);
  const vsp = await get(NOS_HOST, '/vsp');
  check('nos-vsp-route-served', vsp.status !== 404 && vsp.status !== 308, `status=${vsp.status}`);

  // Admin is host-neutral: served on every host, never redirected.
  for (const [label, host] of [['saoc', SAOC_HOST], ['nos', NOS_HOST]]) {
    const r = await get(host, '/admin/login');
    check(`admin-login-served-${label}`, r.status === 200, `status=${r.status}`);
    const a = await get(host, '/admin');
    check(`admin-not-redirected-cross-host-${label}`, !(a.status === 308 && /^https?:/.test(a.headers.location || '')), `status=${a.status} location=${a.headers.location}`);
  }

  // Host-neutral surfaces never redirect.
  for (const [label, host] of [['saoc', SAOC_HOST], ['nos', NOS_HOST]]) {
    for (const p of ['/api/tickets/status', '/robots.txt']) {
      const r = await get(host, p);
      // The status handler answers 404 JSON without params; a framework 404 is HTML.
      const handlerJson404 = r.status === 404 && /application\/json/.test(r.headers['content-type'] || '');
      check(`neutral-${label}-${p}`, r.status !== 308 && r.status !== 401 && (r.status !== 404 || handlerJson404), `status=${r.status} type=${r.headers['content-type']}`);
    }
    const studio = await get(host, '/studio');
    check(`neutral-${label}-/studio-not-redirected`, studio.status !== 308, `status=${studio.status}`);
    const robots = await get(host, '/robots.txt');
    check(`robots-disallow-all-${label}`, /Disallow: \//.test(robots.body));
  }

  // Sitemaps are per-host.
  const sSitemap = await get(SAOC_HOST, '/sitemap.xml');
  const nSitemap = await get(NOS_HOST, '/sitemap.xml');
  check('saoc-sitemap-no-show', sSitemap.status === 200 && !sSitemap.body.includes('/national-show') && sSitemap.body.includes(SAOC_ORIGIN), `status=${sSitemap.status}`);
  check('nos-sitemap-only-show', nSitemap.status === 200 && nSitemap.body.includes(`${NOS_ORIGIN}/symposium`) && !nSitemap.body.includes('/national-show') && !nSitemap.body.includes('/societies') && !nSitemap.body.includes('/events'), `status=${nSitemap.status}`);

  // Media kit gate: unauthenticated-by-session (wall creds only) is sent to admin login, never served the kit.
  for (const [label, host, p] of [['saoc', SAOC_HOST, '/media-kit'], ['nos', NOS_HOST, '/media-kit']]) {
    const r = await get(host, p);
    check(`media-kit-gated-${label}`, [302, 303, 307].includes(r.status) && /\/admin\/login/.test(r.headers.location || ''), `status=${r.status} location=${r.headers.location}`);
  }

  // Host spoofing: a client-chosen nos.* Host or X-Forwarded-Host is never the NOS site, and no
  // redirect Location ever names the spoofed host.
  const EVIL = 'nos.evil.example';
  for (const [label, host, extraHeaders] of [
    ['host', EVIL, {}],
    ['x-forwarded-host', NOS_HOST, { 'x-forwarded-host': EVIL }],
  ]) {
    for (const p of ['/national-show/symposium?x=1', '/national-show', '/contact']) {
      const r = await get(host, p, { extraHeaders });
      const loc = r.headers.location || '';
      check(`spoof-${label}-${p}`, !loc.includes('evil') && r.headers['x-site'] !== 'nos', `status=${r.status} location=${loc} x-site=${r.headers['x-site']}`);
    }
  }

  // Internal-only SAOC test: no stray route-group URL leaks.
  const leak = await get(SAOC_HOST, '/nos-site');
  check('no-internal-prefix-leak', leak.status === 404, `status=${leak.status}`);
}

let code = 0;
try {
  await run();
} catch (e) {
  console.log(`FAIL harness ${e.message}`);
  failures.push(`harness ${e.message}`);
} finally {
  server.kill('SIGTERM');
  try { readFileSync(`${LOG_DIR}/next-start.log`); } catch { /* ignore */ }
}
if (failures.length) {
  console.log(`\n${failures.length} failure(s)`);
  code = 1;
}
process.exit(code);
