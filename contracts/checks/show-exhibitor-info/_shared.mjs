// show-exhibitor-info — shared helpers, owned exclusively by this contract.
//
// A near-copy of contracts/checks/show-visitor-info/_shared.mjs, deliberately duplicated rather
// than imported. That file belongs to a contract that is open in another stream right now;
// importing it would couple two gates together so that an edit to the sibling's helper could turn
// this contract red for reasons unrelated to this feature. Contract checks are test
// infrastructure: independence beats DRY. If both contracts land and both survive a few sessions,
// merging these two files is a reasonable cleanup — booked as FU-3's neighbour, not done here.
//
// WHY THESE CHECKS HIT REAL HTTP
// ------------------------------
// Grep-only assertions produced three false greens on this project last session: a field present
// in a GROQ query and mentioned in a page file still never reached the rendered HTML. Source
// greps in this contract are used ONLY for structural facts a grep can settle — a schema field
// exists, a seed script contains no `createOrReplace`, a component emits no `href="#"`. Each of
// those assertions is labelled STRUCTURAL in the contract. Every claim of the form "the page
// shows X" is settled by fetching the page over HTTP and reading the bytes that came back.
//
// TARGET: http://localhost:3333 — the dev server already running for this session, shared with
// three other streams. Do not kill or restart it. Override with EXH_BASE_URL.
//
// NEEDLES COME FROM THE DATASET, NOT FROM THIS FILE
// -------------------------------------------------
// A check that hardcodes "To be confirmed by the show committee" and greps the HTML for it proves
// nothing — it would pass just as happily against a page with that string frozen into JSX. Every
// content needle below is read live out of Sanity first. If the dataset changes, the needle
// changes, and a page that stopped reading Sanity goes red.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

export const BASE_URL = process.env.EXH_BASE_URL ?? 'http://localhost:3333';

export const PATHS = {
  exhibitors: '/national-show/exhibitors',
  landing: '/national-show',
  judging: '/judging',
  contact: '/contact',
  home: '/',
};

export const INFO_DOC_ID = 'showExhibitorInfo';

// The ten fixed content blocks. Kept here because the contract asserts the schema, the seed and
// the rendered page all agree on this exact set.
export const SECTION_BLOCKS = [
  'entryProcess',
  'fees',
  'classes',
  'judging',
  'eligibility',
  'display',
  'sales',
  'practicalities',
  'permits',
];

export const CONFIRMATION_BLOCKS = [...SECTION_BLOCKS, 'entryForm'];

export const STATUS_VALUES = ['pending', 'research', 'question', 'confirmed'];

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local, matching scripts/seed-ticketing.ts.
// ---------------------------------------------------------------------------

export function readEnvLocal() {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnvOrFail(key) {
  const value = readEnvLocal()[key] ?? process.env[key];
  if (!value) {
    throw new Error(`FAIL: ${key} is not set in .env.local — this check cannot run without it.`);
  }
  return value;
}

let cachedClient;

// useCdn:false on purpose — these checks must read what the dataset holds right now, not a CDN
// copy up to a minute stale. The SITE reads through the CDN (sanity/lib/client.ts sets
// useCdn:true); that difference is exactly why the round-trip check polls rather than asserting
// once.
export function getSanityClient({ withToken = false } = {}) {
  const cacheKey = withToken ? 'rw' : 'ro';
  if (cachedClient?.key === cacheKey) return cachedClient.client;
  const env = readEnvLocal();
  const client = createClient({
    projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: env.NEXT_PUBLIC_SANITY_DATASET,
    apiVersion: '2024-01-01',
    token: withToken ? env.SANITY_API_TOKEN : undefined,
    useCdn: false,
  });
  cachedClient = { key: cacheKey, client };
  return client;
}

// The whole exhibitor singleton, as the checks need it.
export async function fetchExhibitorInfo() {
  const client = getSanityClient();
  const doc = await client.fetch(`*[_id == $id][0]`, { id: INFO_DOC_ID });
  if (!doc) {
    throw new Error(
      `FAIL: no ${INFO_DOC_ID} document in the dataset. Run the seed (pnpm seed:exhibitor) first. ` +
        'This is a hard failure, never a skip — a check that passes against a missing document ' +
        'is exactly the false green this contract exists to prevent.',
    );
  }
  return doc;
}

// `body` is projected here even though the render checks only need title/when/order, because
// check-policy-language reads these documents too and `body` is the second-largest body of prose
// on the page. It was omitted originally and the crux check was blind to seven documents as a
// direct result — QA finding F-3. Project the whole document rather than a field list, so the
// next field someone adds to showExhibitorStep is scanned on the day it exists rather than on the
// day someone remembers to widen this line.
export async function fetchExhibitorSteps() {
  const client = getSanityClient();
  return client.fetch(`*[_type == "showExhibitorStep"] | order(order asc)`);
}

// Class codes live on showClass documents and render on /national-show. The no-duplication check
// reads them from the dataset so it cannot be satisfied by guessing a code format.
export async function fetchShowClassCodes() {
  const client = getSanityClient();
  const rows = await client.fetch(`*[_type == "showClass" && defined(code)]{ code, name }`);
  return rows.filter((r) => typeof r.code === 'string' && r.code.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Portable text -> plain string, so a check can assert seeded body copy actually rendered.
// ---------------------------------------------------------------------------

export function portableTextToPlain(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .filter((b) => b && b._type === 'block' && Array.isArray(b.children))
    .map((b) => b.children.map((c) => (typeof c?.text === 'string' ? c.text : '')).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A distinctive slice of a longer string, for use as a needle. Short enough to survive JSX line
// breaks and entity escaping, long enough not to match by accident.
export function needleFrom(text, length = 60) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.slice(0, length);
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export async function fetchPage(pathname) {
  const url = `${BASE_URL}${pathname}`;
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'saoc-contract-check' } });
  } catch (err) {
    throw new Error(
      `FAIL: could not reach ${url} — ${err.message}. Is the dev server running on ${BASE_URL}? ` +
        'Start it, or point EXH_BASE_URL at the right origin. This is a hard failure, never a skip.',
    );
  }
  const body = await res.text();
  return { status: res.status, body, url };
}

export async function fetchOkPage(pathname) {
  const res = await fetchPage(pathname);
  if (res.status !== 200) {
    throw new Error(`FAIL: ${res.url} returned ${res.status}, expected 200.`);
  }
  return res;
}

export async function callRevalidate(secret, type) {
  const res = await fetch(`${BASE_URL}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-sanity-secret': secret },
    body: JSON.stringify({ _type: type }),
  });
  return { status: res.status, body: await res.text() };
}

// ---------------------------------------------------------------------------
// HTML inspection
// ---------------------------------------------------------------------------

// Next.js serialises the RSC payload into the HTML, so a naive body.includes() can match text
// that lives only in the flight data and never renders. Where "actually visible" is the claim,
// use visibleText()/textContains() — they strip script and style blocks first.
export function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

export function textContains(html, needle) {
  const haystack = visibleText(html).toLowerCase();
  const target = String(needle).replace(/\s+/g, ' ').trim().toLowerCase();
  return target.length > 0 && haystack.includes(target);
}

// How many times a needle appears in the visible text — used to assert a marker renders once per
// block rather than being splattered onto every element.
export function countText(html, needle) {
  const haystack = visibleText(html).toLowerCase();
  const target = String(needle).replace(/\s+/g, ' ').trim().toLowerCase();
  if (target.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(target, from);
    if (at === -1) return count;
    count += 1;
    from = at + target.length;
  }
}

export function extractHrefs(html) {
  const hrefs = new Set();
  const re = /href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    hrefs.add(m[1].split('#')[0].replace(/\/$/, '') || '/');
  }
  return hrefs;
}

export function linksTo(html, pathname) {
  const want = pathname.replace(/\/$/, '') || '/';
  for (const href of extractHrefs(html)) {
    if (href === want) return true;
    if (href === `${BASE_URL}${want}`) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Result reporting — every check ends here, never with a bare process.exit inside a try.
// ---------------------------------------------------------------------------

export function makeReporter(checkName) {
  const failures = [];
  return {
    ok(label) {
      console.log(`  PASS  ${label}`);
    },
    check(condition, label, detail) {
      if (condition) {
        console.log(`  PASS  ${label}`);
      } else {
        console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
        failures.push(label);
      }
      return Boolean(condition);
    },
    fail(label, detail) {
      console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
      failures.push(label);
    },
    finish() {
      if (failures.length === 0) {
        console.log(`PASS: ${checkName}`);
        return 0;
      }
      console.error(`FAIL: ${checkName} — ${failures.length} failing assertion(s):`);
      for (const f of failures) console.error(`  - ${f}`);
      return 1;
    },
  };
}

export async function runCheck(checkName, fn) {
  const reporter = makeReporter(checkName);
  let exitCode = 1;
  try {
    await fn(reporter);
    exitCode = reporter.finish();
  } catch (err) {
    console.error(`FAIL: ${checkName} threw — ${err.stack ?? err.message}`);
    exitCode = 1;
  }
  process.exit(exitCode);
}
