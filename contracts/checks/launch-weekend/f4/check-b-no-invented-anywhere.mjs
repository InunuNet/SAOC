#!/usr/bin/env node
// A2 - no invented event name or slug anywhere: every route, the calendar feeds, llms files, the sitemap,
// every society page, per-event pages/ics (must 404), the client JS bundle, and the QA fixture ticket type.
// Fails today: static fallbacks and published Sanity docs leak the 17 invented events to several surfaces.
// Usage: BASE_URL=... node contracts/checks/launch-weekend/f4/check-b-no-invented-anywhere.mjs   (optional NEXT_DIR, default .next)
import { readFileSync } from 'node:fs';
import { get, inventedIn, INVENTED, report, walk } from './_lib.mjs';

const problems = [];
const ROUTES = ['/', '/events', '/societies', '/national-show', '/about', '/judging', '/contact', '/llms.txt', '/llms-full.txt', '/sitemap.xml', '/api/events.ics'];
const TICKET_ROUTES = ['/national-show/tickets', '/tickets'];
const scan = (label, body) => { for (const t of inventedIn(body)) problems.push(`${label} contains invented event: ${t}`); };

const bodies = {};
for (const r of ROUTES) { bodies[r] = (await get(r)).text; scan(r, bodies[r]); }

// Every society page, discovered from the societies index (static fallback matched events by host name).
const slugs = [...new Set([...bodies['/societies'].matchAll(/href="\/societies\/([^"/?#]+)"/g)].map((m) => m[1]))];
if (slugs.length < 5) problems.push(`societies index yielded only ${slugs.length} society links - cannot sweep society pages`);
for (const s of slugs) scan(`/societies/${s}`, (await get(`/societies/${s}`)).text);

// Per-event pages and per-event ics for every invented slug must not resolve.
for (const e of INVENTED) {
  for (const r of [`/events/${e.slug}`, `/api/events/${e.slug}/ics`]) {
    const { status } = await get(r, { allowStatus: [404, 410] });
    if (status < 400) problems.push(`${r} resolves (HTTP ${status}); an invented event is still addressable`);
  }
}

// QA fixture ticket type must never be publicly listable.
for (const r of TICKET_ROUTES) {
  const { status, text } = await get(r, { allowStatus: [404] });
  if (status < 400 && /QA Fixture|Do Not Purchase|qa-fixture/i.test(text)) problems.push(`${r} exposes the QA fixture ticket type`);
}

// Client bundle: scripts referenced by the home page, plus the on-disk build when present
// (SearchOverlay imported the static events straight into the client bundle).
const srcs = [...new Set([...bodies['/'].matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
for (const s of srcs) scan(s, (await get(s)).text);
for (const f of walk(`${process.env.NEXT_DIR || '.next'}/static`, '.js')) scan(f, readFileSync(f, 'utf8'));

report(problems, `no invented event on ${ROUTES.length} routes, ${slugs.length} society pages, ${INVENTED.length} event slugs (404), ${srcs.length} home scripts + built bundle`);
