#!/usr/bin/env node
// A11 — F1 regression guard. NOT a fix: this defect is ALREADY CORRECT in the tree.
//
// The backlog records /events/[slug] as tagging its sanityFetch calls ['events'] —
// a string matching neither 'sanity' (the blanket tag app/api/revalidate/route.ts
// always invalidates) nor 'societyEvent' (the real document _type a webhook payload
// carries). Read live 2026-08-11: all three call sites now pass
// `tags: ['societyEvent', 'sanity']`. The defect was fixed between the backlog entry
// and this contract. It is kept here as a regression guard, not as work for @dev.
//
// SCOPE HONESTY — what this check can and cannot prove. Cache tags only do anything
// where Next's data cache is live: the deployed build. On the local dev server this
// contract is graded against, a round trip would propagate regardless of the tags, so
// it would pass with the tags wrong — a false green. The tag strings are therefore
// asserted structurally, and asserted against the REAL definitions they must match
// (the revalidate route's blanket tag, and the schema's declared type name) rather
// than against literals retyped here. The round trip below proves the page renders
// live Sanity content; it does not, and is not claimed to, prove CDN invalidation.

import fs from 'node:fs';
import { loadEnv, groq, fetchPage, assertDevServerUp, installCrashGuard, pass, fail } from './_shared.mjs';

installCrashGuard('check-event-tags-regression');

const PAGE = 'app/(marketing)/events/[slug]/page.tsx';

const env = loadEnv();
await assertDevServerUp();

const failures = [];

if (!fs.existsSync(PAGE)) fail(`${PAGE} is missing`);
const src = fs.readFileSync(PAGE, 'utf8');

// The real type name, read from the schema rather than retyped as a literal here.
const eventSchema = fs.readFileSync('sanity/schemas/documents/event.ts', 'utf8');
const typeName = (eventSchema.match(/name:\s*'([^']+)'/) ?? [null, null])[1];
if (typeName !== 'societyEvent') {
  failures.push(`sanity/schemas/documents/event.ts declares type '${typeName}', expected 'societyEvent'`);
}

// The blanket tag, read from the revalidate route rather than retyped as a literal.
const revalidateRoute = fs.readFileSync('app/api/revalidate/route.ts', 'utf8');
const blanket = (revalidateRoute.match(/revalidateTag\('([^']+)'/) ?? [null, null])[1];
if (blanket !== 'sanity') {
  failures.push(`app/api/revalidate/route.ts blanket tag is '${blanket}', expected 'sanity'`);
}

const tagArrays = [...src.matchAll(/tags:\s*\[([^\]]*)\]/g)].map((m) => m[1]);
if (tagArrays.length === 0) {
  failures.push(`${PAGE} declares no sanityFetch \`tags\` at all`);
}
tagArrays.forEach((arr, i) => {
  if (typeName && !arr.includes(`'${typeName}'`)) {
    failures.push(`${PAGE} tags array #${i + 1} ([${arr.trim()}]) is missing '${typeName}'`);
  }
  if (blanket && !arr.includes(`'${blanket}'`)) {
    failures.push(`${PAGE} tags array #${i + 1} ([${arr.trim()}]) is missing '${blanket}'`);
  }
  if (/'events'/.test(arr)) {
    failures.push(
      `${PAGE} tags array #${i + 1} reintroduced the bogus 'events' tag — no document type or ` +
        'revalidation path uses that string.'
    );
  }
});

// Behavioural half: the page must actually render live Sanity content for a real slug.
const sample = await groq(
  env,
  '*[_type == "societyEvent" && defined(slug.current)] | order(_id asc)[0]{"slug": slug.current, title}'
);
if (!sample?.slug) {
  failures.push('no societyEvent document with a slug exists — cannot verify the detail page renders.');
} else {
  const { status, html } = await fetchPage(`/events/${sample.slug}`);
  if (status !== 200) {
    failures.push(`/events/${sample.slug} returned ${status}, expected 200`);
  } else if (!html.includes(sample.title)) {
    failures.push(
      `/events/${sample.slug} did not render its Sanity title "${sample.title}" — the detail page ` +
        'is not showing live CMS content.'
    );
  }
}

if (failures.length > 0) {
  fail(`event tag regression — ${failures.length} problem(s):\n  - ${failures.join('\n  - ')}`);
}
pass("/events/[slug] tags every fetch ['societyEvent', 'sanity'] and renders live Sanity content.");
