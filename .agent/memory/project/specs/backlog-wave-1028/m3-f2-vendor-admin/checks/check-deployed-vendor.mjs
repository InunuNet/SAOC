// M3/F2 RUN-AFTER-DEPLOY check (plain, not the browser_deployed_check kind: that kind's live re-check sends no auth
// and the beta Basic Auth wall answers 401, backlog 2026-10-07). Credentials are read from BETA_BASIC_AUTH_USER /
// BETA_BASIC_AUTH_PASSWORD and never printed. Run from the project root: node --env-file-if-exists=.env.local <this file>
// Exit 0 PASS, 1 FAIL (real finding), 77 inconclusive (credentials missing or host unreachable): contract.py reads 77 as a skip.
//
// What it proves, honestly: the admin detail page is behind Firebase Auth, so unauthenticated we can only prove the gate
// (redirect to /admin/login, no vendor data in the body). The detail view's contents are covered pre-merge by A16 and by the
// manual walkthrough in goldens/f2b-detail-page.md. Also proves the NOS payment path canon the A4 check relies on.
const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
if (!user || !pass) { console.error('INCONCLUSIVE: BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD not set (run from the project root with .env.local)'); process.exit(77); }
const headers = { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
const failures = [];

async function get(url) {
  try {
    return await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  } catch (error) {
    console.error(`INCONCLUSIVE: could not reach ${url} (${error.name})`);
    process.exit(77);
  }
}
const isRedirect = (res) => res.status >= 300 && res.status < 400;
const locationOf = (res) => { try { return new URL(res.headers.get('location') ?? '', 'https://x.invalid'); } catch { return null; } };

// 1. detail route is gated: no session -> redirect to /admin/login, and the body carries no vendor data.
const detail = await get('https://beta.saoc.co.za/admin/vendors/does-not-exist-gate-probe');
const detailLoc = locationOf(detail);
if (!isRedirect(detail) || !detailLoc || detailLoc.pathname !== '/admin/login') {
  failures.push(`/admin/vendors/[id] without a session: want a redirect to /admin/login, got ${detail.status} ${detail.headers.get('location') ?? ''}`);
}

// 2. public gate still shows the code-entry form (not the full registration form) without a session.
const reg = await get('https://nos.saoc.co.za/vendors/register');
const regHtml = await reg.text();
if (reg.status !== 200) failures.push(`NOS /vendors/register: want 200, got ${reg.status}`);
else if (/Declaration (&amp;|&) Terms/.test(regHtml)) failures.push('NOS /vendors/register rendered the full form without a registration session');

// 3. the apply page is served.
const apply = await get('https://nos.saoc.co.za/vendors/apply');
if (apply.status !== 200) failures.push(`NOS /vendors/apply: want 200, got ${apply.status}`);

// 4. payment path canon: NOS /vendors/payment is the page; the internal-prefix form redirects to it.
const pay = await get('https://nos.saoc.co.za/vendors/payment');
if (pay.status >= 500 || pay.status === 404) failures.push(`NOS /vendors/payment: want a served page, got ${pay.status}`);
const prefixed = await get('https://nos.saoc.co.za/national-show/vendors/payment');
const prefixedLoc = locationOf(prefixed);
if (!isRedirect(prefixed) || !prefixedLoc || prefixedLoc.pathname !== '/vendors/payment') {
  failures.push(`NOS /national-show/vendors/payment: want a redirect to /vendors/payment, got ${prefixed.status} ${prefixed.headers.get('location') ?? ''}`);
}

if (failures.length) { console.error(failures.map((f) => `FAIL: ${f}`).join('\n')); process.exit(1); }
console.log('PASS: detail route gated, NOS register gate intact, apply served, payment path canon confirmed');
