#!/usr/bin/env node
// A7 — F4 removals, structural + dataset-emptiness.
//
// Two schema fields are REMOVED rather than wired:
//   homePage.countdownDate      — a duplicate of nationalShow.countdownDate, which is
//                                 the one actually driving both countdowns. Two fields
//                                 with the same name, one inert, is the confusion this
//                                 removal exists to end.
//   contactPage.formRecipients  — enquiry routing is delivery configuration, not
//                                 content. Wiring it would let anyone with Studio
//                                 access redirect where site enquiries are delivered.
//                                 It belongs in env (lib/email.ts / RESEND_*), where
//                                 it already effectively lives.
//
// Removing a schema field is content-destructive in principle. It is permitted here
// because BOTH are confirmed to hold no data — and this check RE-CONFIRMS that live at
// grading time rather than trusting the authoring-time reading. If someone types a
// value into either field before the gate runs, this check fails and the removal must
// be reconsidered. That ordering is deliberate.
//
// Structural (grep) rather than round-trip is correct here: a removed field has, by
// definition, nothing to render. The behavioural consequences are covered separately
// by A6 (the live countdown still works) and A8 (/contact still functions).

import fs from 'node:fs';
import { loadEnv, groq, fetchPage, assertDevServerUp, installCrashGuard, pass, fail } from './_shared.mjs';

installCrashGuard('check-dead-fields-removed');

const env = loadEnv();
await assertDevServerUp();

const failures = [];

// ---------- 1. Dataset emptiness, re-confirmed at grading time ----------
const occupancy = await groq(
  env,
  `{
    "homeCountdown": count(*[_type == "homePage" && defined(countdownDate)]),
    "formRecipients": count(*[_type == "contactPage" && defined(formRecipients)])
  }`
);
if (occupancy.homeCountdown !== 0) {
  failures.push(
    `${occupancy.homeCountdown} homePage document(s) now hold a countdownDate value. Removing the ` +
      'field would destroy real content — stop and re-decide rather than proceeding.'
  );
}
if (occupancy.formRecipients !== 0) {
  failures.push(
    `${occupancy.formRecipients} contactPage document(s) now hold formRecipients values. Removing ` +
      'the field would destroy real content — stop and re-decide rather than proceeding.'
  );
}

// ---------- 2. The fields are gone from the schemas ----------
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

const homeSchema = read('sanity/schemas/documents/homePage.ts');
if (homeSchema === null) failures.push('sanity/schemas/documents/homePage.ts is missing');
else if (/name:\s*'countdownDate'/.test(homeSchema)) {
  failures.push('homePage.ts still declares a `countdownDate` field');
}

const contactSchema = read('sanity/schemas/documents/contactPage.ts');
if (contactSchema === null) failures.push('sanity/schemas/documents/contactPage.ts is missing');
else if (/name:\s*'formRecipients'/.test(contactSchema)) {
  failures.push('contactPage.ts still declares a `formRecipients` field');
}

// ---------- 3. And gone from the query + the page's type, not just the schema ----------
// A field left in homePageQuery after the schema drops it is a silently-null
// projection — tidy-looking and meaningless. The whole field must go.
const queries = read('sanity/queries.ts') ?? '';
const homePageQueryBlock = (queries.match(/homePageQuery[\s\S]*?`\)/) ?? [''])[0];
if (/countdownDate/.test(homePageQueryBlock)) {
  failures.push('sanity/queries.ts homePageQuery still projects countdownDate');
}

const homePageFile = read('app/(marketing)/page.tsx') ?? '';
const homePageDataBlock = (homePageFile.match(/interface HomePageData[\s\S]*?\}/) ?? [''])[0];
if (/countdownDate/.test(homePageDataBlock)) {
  failures.push('app/(marketing)/page.tsx HomePageData interface still declares countdownDate');
}

// ---------- 4. The LIVE countdown wiring is untouched ----------
if (!/countdownDate=\{show\?\.countdownDate\}/.test(homePageFile)) {
  failures.push(
    'app/(marketing)/page.tsx no longer passes `show?.countdownDate` to ShowBand — the wrong ' +
      'countdownDate was removed. nationalShow.countdownDate is the live one.'
  );
}

// ---------- 5. The seed script stops referencing the removed field ----------
const seed = read('scripts/seed-page-singletons.ts') ?? '';
if (/formRecipients/.test(seed)) {
  failures.push(
    'scripts/seed-page-singletons.ts still mentions formRecipients (including in a comment) — ' +
      'remove the reference so the seed script does not document a field that no longer exists.'
  );
}

// ---------- 6. /contact still works after the removal ----------
const contact = await fetchPage('/contact');
if (contact.status !== 200) {
  failures.push(`/contact returned ${contact.status} after the schema change, expected 200`);
}

if (failures.length > 0) {
  fail(`dead-field removal — ${failures.length} problem(s):\n  - ${failures.join('\n  - ')}`);
}
pass('homePage.countdownDate and contactPage.formRecipients are removed, empty, and nothing broke.');
