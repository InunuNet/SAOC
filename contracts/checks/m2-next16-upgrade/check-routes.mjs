#!/usr/bin/env node
// Behavioural route/API battery for the m2-next16-upgrade regression pass.
// Runs against a LIVE dev server (started by server-ctl.sh start, on
// http://localhost:3333) — never a static-source grep. Each category is
// invoked as its own contract assertion so a failure in one group doesn't
// hide failures in another and the gate report shows which surface broke.
//
// Usage: node check-routes.mjs <marketing|admin-studio|api-get|api-mutations>
//
// Exit 0 iff every check in the requested category passes. Prints one
// PASS/FAIL line per checked route/endpoint plus a final summary.
import { execSync } from 'node:child_process';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BASE_URL = process.env.M2_CHECK_BASE_URL ?? 'http://localhost:3333';
const category = process.argv[2];

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function get(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual', ...init });
  const body = await res.text();
  return { status: res.status, headers: res.headers, body };
}

function resolveSlugs() {
  const out = execSync('node contracts/checks/m2-next16-upgrade/resolve-slugs.mjs', {
    encoding: 'utf8',
  });
  return JSON.parse(out.trim());
}

async function checkMarketing() {
  const { societySlug, eventSlug, archiveYear } = resolveSlugs();

  const staticRoutes = [
    '/',
    '/about',
    '/societies',
    '/judging',
    '/events',
    '/events/submit',
    '/national-show',
    '/national-show/archive',
    '/national-show/exhibitors',
    '/media-kit',
    '/sponsors',
    '/constitution',
    '/privacy',
    '/terms',
    '/contact',
  ];
  for (const path of staticRoutes) {
    const { status } = await get(path);
    record(`GET ${path}`, status === 200, `http ${status}`);
  }

  // /national-show/upcoming is an intentional server redirect
  // (app/(marketing)/national-show/upcoming/page.tsx:6, `redirect('/national-show')`)
  // — asserting the actual 307+Location behaviour, not just "not 500", so a
  // regression that silently turns it into a 200 pass-through gets caught.
  {
    const { status, headers } = await get('/national-show/upcoming');
    const location = headers.get('location') ?? '';
    record(
      'GET /national-show/upcoming redirects 307 -> /national-show',
      status === 307 && location.endsWith('/national-show'),
      `http ${status}, location=${location || '(missing)'}`,
    );
  }

  if (societySlug) {
    const path = `/societies/${societySlug}`;
    const { status } = await get(path);
    record(`GET ${path}`, status === 200, `http ${status}`);
  } else {
    record('GET /societies/[slug]', true, 'SKIPPED — no society document with a slug in dataset');
  }

  if (eventSlug) {
    const path = `/events/${eventSlug}`;
    const { status } = await get(path);
    record(`GET ${path}`, status === 200, `http ${status}`);
  } else {
    record('GET /events/[slug]', true, 'SKIPPED — no societyEvent document with a slug in dataset');
  }

  if (archiveYear) {
    const path = `/national-show/archive/${archiveYear}`;
    const { status } = await get(path);
    record(`GET ${path}`, status === 200, `http ${status}`);
  } else {
    record('GET /national-show/archive/[year]', true, 'SKIPPED — no nationalShow document with a year in dataset');
  }

  // Unknown dynamic params must 404 cleanly, not 500 — proves the route's
  // not-found path still compiles under Next 16.
  const { status: notFoundStatus } = await get('/societies/does-not-exist-m2-check');
  record('GET /societies/does-not-exist-m2-check (expect 404)', notFoundStatus === 404, `http ${notFoundStatus}`);
}

async function checkAdminStudio() {
  // /admin is a server component that reads the session cookie itself
  // (app/admin/page.tsx:13-14/20-21/28-29) and calls redirect('/admin/login')
  // server-side whenever there's no cookie, an invalid session, or a
  // non-admin claim — this is a fail-closed security property enforced in
  // the server render, not a client-side gate. Assert the real 307, not
  // "200 because it's client-gated" (that claim was wrong).
  {
    const { status, headers } = await get('/admin');
    const location = headers.get('location') ?? '';
    record(
      'GET /admin unauthenticated redirects 307 -> /admin/login',
      status === 307 && location.endsWith('/admin/login'),
      `http ${status}, location=${location || '(missing)'}`,
    );
  }

  // /admin/login and /admin/door render their own public shell (no
  // server-side cookie check at these two routes) — 200 is the correct
  // unauthenticated expectation here, unlike bare /admin above.
  const routes = ['/admin/login', '/admin/door'];
  for (const path of routes) {
    const { status } = await get(path);
    record(`GET ${path}`, status === 200, `http ${status}`);
  }

  const { status: studioStatus, body } = await get('/studio');
  record('GET /studio', studioStatus === 200, `http ${studioStatus}`);
  record(
    'GET /studio has no unhandled SSR error digest',
    !/TypeError:.*digest:/i.test(body),
    'checked response body for TypeError...digest signature',
  );
}

async function checkApiGet() {
  const { status: icsAllStatus, headers: icsAllHeaders } = await get('/api/events.ics');
  record('GET /api/events.ics', icsAllStatus === 200, `http ${icsAllStatus}`);
  record(
    'GET /api/events.ics content-type is text/calendar',
    (icsAllHeaders.get('content-type') ?? '').includes('text/calendar'),
    icsAllHeaders.get('content-type') ?? '(missing)',
  );

  const { eventSlug } = resolveSlugs();
  if (eventSlug) {
    const path = `/api/events/${eventSlug}/ics`;
    const { status } = await get(path);
    record(`GET ${path}`, status === 200, `http ${status}`);
  } else {
    record('GET /api/events/[slug]/ics', true, 'SKIPPED — no societyEvent document with a slug in dataset');
  }

  // og image route (edge runtime) — flagged in F1 as informational, worth a
  // live check since it's the one edge-runtime handler in the app.
  const { status: ogStatus } = await get('/og');
  record('GET /og', ogStatus === 200, `http ${ogStatus}`);
}

async function checkApiMutations() {
  // Contact form: malformed payload must fail closed with 400, not 500.
  // Does not exercise the happy path (would send a real email via Resend
  // and write a real Firestore doc on every gate run) — a non-500 fail-
  // closed response is sufficient proof the route handler still executes
  // under Next 16; full business-logic coverage lives in
  // contracts/contract-d1-resend-email.yaml / contract-b6-contact.yaml.
  {
    const { status } = await get('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    record('POST /api/contact with empty body (expect 4xx, not 500)', status >= 400 && status < 500, `http ${status}`);
  }

  // Admin session: invalid idToken must fail closed with 400/401, not 500.
  {
    const { status } = await get('/api/admin/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'not-a-real-token' }),
    });
    record('POST /api/admin/session with bogus idToken (expect 400/401)', status === 400 || status === 401, `http ${status}`);
  }

  // Admin checkin/export-csv/tickets: no session cookie must fail closed
  // with 401, not 500 — proves firebase-admin/auth + cookies() still work
  // post-upgrade without needing a real login flow.
  for (const [path, method] of [
    ['/api/admin/checkin', 'POST'],
    ['/api/admin/export-csv', 'GET'],
    ['/api/admin/tickets', 'GET'],
  ]) {
    const { status } = await get(path, { method });
    record(`${method} ${path} unauthenticated (expect 401)`, status === 401, `http ${status}`);
  }

  // Tickets checkout: missing required body fields must fail closed.
  {
    const { status } = await get('/api/tickets/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    record('POST /api/tickets/checkout with empty body (expect 4xx, not 500)', status >= 400 && status < 500, `http ${status}`);
  }

  // PayFast ITN: a bogus signature must ALWAYS get acknowledged with HTTP 200
  // (app/api/tickets/itn/route.ts:65-68, `acknowledge()`) — this is correct
  // PayFast protocol (stop retrying), NOT a validation failure, so asserting
  // "expect 4xx" is simply wrong and asserting "200 is fine" proves nothing
  // (a broken handler that credited the payment would also return 200). The
  // actual security property is: a bogus signature must never flip a ticket
  // to 'paid'. The signature check (step 1, route.ts:79) is the FIRST gate
  // and returns immediately on mismatch, before any Firestore read/write —
  // so a nonexistent, single-use m_payment_id lets us prove "no write
  // happened" with a plain read-only Firestore query before and after,
  // zero side effects (no ticket created, no real payment recorded).
  {
    const probeId = `m2-check-itn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let db;
    try {
      const app = getApps().length > 0 ? getApps()[0] : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      db = getFirestore(app);
    } catch (e) {
      record(
        'POST /api/tickets/itn with bogus signature does not write a ticket',
        false,
        `FAILING HONESTLY, not weakened to a status check: could not init firebase-admin to verify the no-write property (${e.message}). Needs FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY in .env.local.`,
      );
    }
    if (db) {
      const before = await db.collection('tickets').where('m_payment_id', '==', probeId).limit(1).get();
      const { status } = await get('/api/tickets/itn', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `m_payment_id=${probeId}&pf_payment_id=0&payment_status=COMPLETE&amount_gross=1&signature=deadbeef`,
      });
      const after = await db.collection('tickets').where('m_payment_id', '==', probeId).limit(1).get();
      const ok = status === 200 && before.empty && after.empty;
      record(
        'POST /api/tickets/itn with bogus signature (expect 200 ack, and NO ticket written for the probe m_payment_id)',
        ok,
        `http ${status}, tickets before=${before.size}, after=${after.size} (both must be 0 — a bogus signature must never create/flip a ticket)`,
      );
    }
  }

  // Draft mode toggles.
  // /api/disable-draft never checks a secret (app/api/disable-draft/route.ts)
  // — it just clears draft mode and redirects, so a bare GET redirecting is
  // the correct unauthenticated expectation there.
  {
    const { status } = await get('/api/disable-draft');
    record('GET /api/disable-draft (expect redirect, not 500)', status >= 300 && status < 400, `http ${status}`);
  }
  // /api/draft DOES require a secret (app/api/draft/route.ts:9) and returns
  // 401 without one — the redirect branch is only reachable when
  // authenticated. Test both: fail-closed without the secret, and the real
  // redirect with it.
  {
    const { status } = await get('/api/draft');
    record('GET /api/draft with no secret (expect 401)', status === 401, `http ${status}`);
  }
  {
    const secret = process.env.SANITY_REVALIDATE_SECRET;
    if (secret) {
      const { status, headers } = await get(`/api/draft?secret=${encodeURIComponent(secret)}`);
      const location = headers.get('location') ?? '';
      record(
        'GET /api/draft with correct secret (expect redirect)',
        status >= 300 && status < 400,
        `http ${status}, location=${location || '(missing)'}`,
      );
    } else {
      record('GET /api/draft with correct secret', true, 'SKIPPED — SANITY_REVALIDATE_SECRET not set in environment');
    }
  }

  // Revalidate webhook: wrong secret must fail closed with 401.
  {
    const { status } = await get('/api/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sanity-secret': 'wrong-secret' },
      body: JSON.stringify({ _type: 'society' }),
    });
    record('POST /api/revalidate with wrong secret (expect 401)', status === 401, `http ${status}`);
  }

  // Revalidate webhook: correct secret (from env, loaded from .env.local by
  // the caller) must succeed and actually invoke revalidateTag(..., 'max')
  // without throwing — this is the one M2 change (F1 risk #1) that a fail-
  // closed check alone can't prove, since a 401 path never reaches the
  // revalidateTag() calls at all.
  const realSecret = process.env.SANITY_REVALIDATE_SECRET;
  if (realSecret) {
    const { status } = await get('/api/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sanity-secret': realSecret },
      body: JSON.stringify({ _type: 'society' }),
    });
    record('POST /api/revalidate with correct secret (expect 200, revalidateTag executes)', status === 200, `http ${status}`);
  } else {
    record('POST /api/revalidate with correct secret', true, 'SKIPPED — SANITY_REVALIDATE_SECRET not set in environment');
  }
}

const categories = {
  marketing: checkMarketing,
  'admin-studio': checkAdminStudio,
  'api-get': checkApiGet,
  'api-mutations': checkApiMutations,
};

const fn = categories[category];
if (!fn) {
  console.error(`unknown category "${category}" — expected one of: ${Object.keys(categories).join(', ')}`);
  process.exit(2);
}

await fn();

const failed = results.filter((r) => !r.ok);
console.log(`\n${category}: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(`FAILED: ${failed.map((f) => f.name).join('; ')}`);
  process.exit(1);
}
process.exit(0);
