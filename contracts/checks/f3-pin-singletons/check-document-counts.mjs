#!/usr/bin/env node
// F3 (cms-activation-deploy): data-integrity guard, not a structure-code check.
// Pinning the desk structure to a fixed document ID only prevents NEW duplicates
// created through the Studio UI. It says nothing about documents that already exist
// (e.g. created earlier via the API or a script) — if a pinned type already had 2+
// documents, the fixed-ID pin would silently orphan one of them instead of surfacing
// the conflict. This check queries the live dataset directly (GROQ, not source) and
// fails loudly if any of the 6 pinned types has more than one document.
//
// Baseline captured by @architect before @dev's changes (2026-07-29), see the F3
// contract header: all 6 singleton types (including membersPage) had 0 documents.
// membersPage stays an empty placeholder per Brad's decision — F3 pins it but does not
// seed it (seeding is F4's job for the other 5, and out of scope entirely for
// membersPage until Brad decides to build the page).
//
// Run as: node --import tsx/esm contracts/checks/f3-pin-singletons/check-document-counts.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local — read-only.
//
// Exit codes: 0 = every pinned type has 0 or 1 documents. 1 = any type over 1, or the
// query itself fails (missing credentials, network, etc.) — never a silent skip.

import { createClient } from '@sanity/client';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const PINNED_TYPES = ['homePage', 'aboutPage', 'nationalShow', 'contactPage', 'judgingPage', 'membersPage'];

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  console.error('FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN in .env.local');
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

let failures = [];

for (const typeName of PINNED_TYPES) {
  let docs;
  try {
    docs = await client.fetch(`*[_type == $t]{_id}`, { t: typeName });
  } catch (err) {
    console.error(`FAIL: GROQ query for ${typeName} threw — ${err.message}`);
    process.exit(1);
  }
  if (docs.length > 1) {
    failures.push(
      `${typeName}: ${docs.length} documents exist (ids: ${docs.map((d) => d._id).join(', ')}) — ` +
        `pinning to a fixed id would silently orphan ${docs.length - 1} of them`
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: all 6 pinned types have 0-1 documents.');
process.exit(0);
