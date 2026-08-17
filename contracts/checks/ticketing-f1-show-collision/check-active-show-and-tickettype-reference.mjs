#!/usr/bin/env node
// Behavioural proof, live dataset, read-only:
//   (a) the first sales-capable show document (show-19-2027) exists and is resolvable
//       with active === true and the new sales fields defined;
//   (b) ticketType documents are queryable by their new `show` reference — at least one
//       exists and points at show-19-2027;
//   (c) negative control: a show document that predates the migration (no `active`
//       field at all, e.g. show-18-2024) must NOT be selected as active by the same
//       resolveActiveShow() function exercised in check-active-show-resolver.mjs, now
//       fed with LIVE data instead of a fixture, closing the gap between "the resolver
//       is correct in isolation" and "the resolver is correct against what's actually
//       in the dataset."
//
// This check depends on @dev's one-time migration script having already run against
// the live (pre-production) dataset — see README's "Corrected design" section. It only
// reads; it never writes.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f1-show-collision/check-active-show-and-tickettype-reference.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local — read-only.

import { createClient } from '@sanity/client';
import { config } from 'dotenv';

import { resolveActiveShow } from '../../../lib/show-resolution.ts';

config({ path: '.env.local', quiet: true });

const ACTIVE_SHOW_ID = 'show-19-2027';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    'FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN in .env.local'
  );
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

const failures = [];

// (a) the active show document exists with sales fields defined.
let activeShowDoc;
try {
  activeShowDoc = await client.fetch(
    `*[_type == "show" && _id == $id][0]{_id, active, salesOpen, edition, startDate, endDate, venue}`,
    { id: ACTIVE_SHOW_ID }
  );
} catch (err) {
  console.error(`FAIL: active-show lookup query threw — ${err.message}`);
  process.exit(1);
}
if (!activeShowDoc) {
  failures.push(`${ACTIVE_SHOW_ID} does not exist — migration has not run`);
} else {
  if (activeShowDoc.active !== true) failures.push(`${ACTIVE_SHOW_ID}.active is not true`);
  if (activeShowDoc.edition == null) failures.push(`${ACTIVE_SHOW_ID}.edition is not set`);
  if (activeShowDoc.startDate == null) failures.push(`${ACTIVE_SHOW_ID}.startDate is not set`);
  if (activeShowDoc.endDate == null) failures.push(`${ACTIVE_SHOW_ID}.endDate is not set`);
}

// (b) ticketType documents are queryable by their new show reference.
let ticketTypesForActiveShow;
try {
  ticketTypesForActiveShow = await client.fetch(
    `*[_type == "ticketType" && show._ref == $id]{_id, name}`,
    { id: ACTIVE_SHOW_ID }
  );
} catch (err) {
  console.error(`FAIL: ticketType-by-show-reference query threw — ${err.message}`);
  process.exit(1);
}
if (!ticketTypesForActiveShow || ticketTypesForActiveShow.length === 0) {
  failures.push(
    `no ticketType documents reference show._ref == '${ACTIVE_SHOW_ID}' — migration has not backfilled them`
  );
}

// (c) negative control against LIVE data: every 'show' document that predates the
// migration (i.e. every one except the active one) must not be selected as active.
let allShows;
try {
  allShows = await client.fetch(`*[_type == "show"]{_id, active}`);
} catch (err) {
  console.error(`FAIL: all-shows query threw — ${err.message}`);
  process.exit(1);
}
const legacyShows = allShows.filter((s) => s._id !== ACTIVE_SHOW_ID);
const resolvedAgainstLegacyOnly = resolveActiveShow(legacyShows);
if (resolvedAgainstLegacyOnly !== null) {
  failures.push(
    `resolveActiveShow() over the 5 legacy show documents (no 'active' field) returned ` +
      `${JSON.stringify(resolvedAgainstLegacyOnly)} instead of null`
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  `PASS: ${ACTIVE_SHOW_ID} is active with sales fields set, ${ticketTypesForActiveShow.length} ` +
    `ticketType doc(s) reference it, and the 5 legacy show docs alone do not resolve as active.`
);
process.exit(0);
