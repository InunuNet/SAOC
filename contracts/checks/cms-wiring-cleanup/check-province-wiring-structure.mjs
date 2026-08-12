#!/usr/bin/env node
// A8 — F3 structural half: the province type is genuinely wired, and the wiring is
// additive rather than a rewrite of how societies are filtered.
//
// The `province` document type is WIRED, not removed: nine documents exist in the
// dataset (confirmed live 2026-08-11), so removal is not permitted under this
// contract's own rule that a schema removal must first be confirmed empty.
//
// The narrow wire is deliberate. `society.province` stays a free-text code string —
// converting 21 society documents to references is a data migration, not a wiring
// fix, and it would put every society document at risk to close a P2. Instead the
// filter chips, which today come from a hardcoded array, are sourced from the
// `province` documents. That makes publishing a province do something visible with
// no migration and no destructive write.
//
// Read-only. The behavioural proof is A3 (round trip) and A4 (chip order); this check
// pins the shape so those two cannot be satisfied by an accidental or fragile route.

import fs from 'node:fs';
import { loadEnv, groq, installCrashGuard, pass, fail } from './_shared.mjs';

installCrashGuard('check-province-wiring-structure');

const env = loadEnv();
const failures = [];
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

// ---------- The type must still exist and still hold its documents ----------
const count = await groq(env, 'count(*[_type == "province"])');
if (count < 9) {
  failures.push(
    `only ${count} province document(s) in the dataset (expected at least 9). Documents were ` +
      'deleted — this contract wires the province type, it does not remove content.'
  );
}
const unordered = await groq(env, 'count(*[_type == "province" && !defined(order)])');
if (unordered !== 0) {
  failures.push(
    `${unordered} province document(s) have no \`order\` value. Every province must be seeded with ` +
      'an order so the curated chip sequence survives (see A4).'
  );
}

// ---------- Schema gains `order`; nothing else about it changes ----------
const schema = read('sanity/schemas/documents/province.ts');
if (schema === null) {
  failures.push('sanity/schemas/documents/province.ts is missing — the type must be wired, not removed');
} else {
  if (!/name:\s*'order'/.test(schema)) failures.push('province.ts does not declare an `order` field');
  for (const f of ['name', 'code', 'slug']) {
    if (!new RegExp(`name:\\s*'${f}'`).test(schema)) {
      failures.push(`province.ts lost its existing \`${f}\` field`);
    }
  }
}

const index = read('sanity/schemas/index.ts') ?? '';
if (!/^\s*province,\s*$/m.test(index)) {
  failures.push('sanity/schemas/index.ts no longer registers `province`');
}

// ---------- A query exists and orders deterministically ----------
const queries = read('sanity/queries.ts') ?? '';
const provinceQuery = (queries.match(/provinceListQuery[\s\S]*?`\)/) ?? [''])[0];
if (!provinceQuery) {
  failures.push('sanity/queries.ts declares no `provinceListQuery`');
} else {
  if (!/_type\s*==\s*"province"/.test(provinceQuery)) {
    failures.push('provinceListQuery does not select _type == "province"');
  }
  if (!/order\s*\(\s*order\s+asc/.test(provinceQuery)) {
    failures.push(
      'provinceListQuery does not `order(order asc, ...)` — without a deterministic order the ' +
        'chips reshuffle between renders.'
    );
  }
}

// ---------- The page fetches it and passes it down; ALL stays synthesised ----------
const page = read('app/(marketing)/societies/page.tsx') ?? '';
if (!/provinceListQuery/.test(page)) {
  failures.push('app/(marketing)/societies/page.tsx does not fetch provinceListQuery');
}
if (!/provinces=\{/.test(page)) {
  failures.push('app/(marketing)/societies/page.tsx does not pass a `provinces` prop to SocietiesClient');
}

const client = read('app/(marketing)/societies/SocietiesClient.tsx') ?? '';
if (/from\s+['"]@\/lib\/data\/provinces['"]/.test(client) && !/\?\?/.test(client)) {
  failures.push(
    'SocietiesClient.tsx still imports the hardcoded provinces array as its primary source. It may ' +
      'remain only as a fallback, in (sanityValue ?? fallback) order.'
  );
}
if (!/'ALL'/.test(client) && !/'ALL'/.test(page)) {
  failures.push(
    "the 'ALL' chip is no longer synthesised in code. It is a UI affordance, not a province — an " +
      'editor must not be able to delete it and break filtering.'
  );
}
if (!/aria-label=\{/.test(client)) {
  failures.push(
    'province chips carry no dynamic aria-label. Each chip must expose its province NAME as its ' +
      'accessible label — both an accessibility fix for the bare two-letter codes and the surface ' +
      'A3 asserts against.'
  );
}

// ---------- Reversed fallback precedence would mask a published edit ----------
for (const [file, src] of [
  ['app/(marketing)/societies/page.tsx', page],
  ['app/(marketing)/societies/SocietiesClient.tsx', client],
]) {
  if (/\bprovinces\s*\?\?\s*sanity/i.test(src) || /'[^']*'\s*\?\?\s*\w*[Pp]rovince/.test(src)) {
    failures.push(`${file} has reversed fallback precedence — the hardcoded list would mask Sanity`);
  }
}

if (failures.length > 0) {
  fail(`province wiring structure — ${failures.length} problem(s):\n  - ${failures.join('\n  - ')}`);
}
pass('the province type is wired to /societies additively, with a deterministic order and a11y labels.');
