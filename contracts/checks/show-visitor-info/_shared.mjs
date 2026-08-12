// show-visitor-info — shared helpers, owned exclusively by this contract.
//
// WHY THESE CHECKS HIT REAL HTTP
// ------------------------------
// Grep-only assertions produced three false greens on this project last session: a field
// present in a query and mentioned in a file still never reached the rendered page. Source
// greps here are used ONLY for structural facts that greps can actually settle (a schema
// field exists; a seed script contains no `createOrReplace`; no venue literal appears in a
// component). Every claim of the form "the page shows X" is settled by fetching the page
// over HTTP from the running dev server and reading the bytes that came back.
//
// TARGET: http://localhost:3333 — the dev server already running for this session.
// NOT 3000, and NOT package.json's `dev` script port (3002). Override with SVI_BASE_URL.
//
// NEEDLES COME FROM THE DATASET, NOT FROM THIS FILE
// -------------------------------------------------
// A check that hardcodes "Cape Town International Convention Centre" and greps the HTML for
// it proves nothing about single-sourcing — it would pass just as happily against a page with
// the venue hardcoded in JSX. So the venue and label checks read the CURRENT value out of
// Sanity first and use that as the needle. If the dataset changes, the needle changes.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

export const BASE_URL = process.env.SVI_BASE_URL ?? 'http://localhost:3333';

export const PATHS = {
  landing: '/national-show',
  plan: '/national-show/plan-your-visit',
  expect: '/national-show/what-to-expect',
  faq: '/national-show/faq',
  archive: '/national-show/archive',
  contact: '/contact',
  tickets: '/tickets',
};

export const NEW_PAGES = [PATHS.plan, PATHS.expect, PATHS.faq];

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

// useCdn:false on purpose — these checks must read what the dataset actually holds right now,
// not a CDN copy up to a minute stale. The SITE reads through the CDN (sanity/lib/client.ts
// sets useCdn:true); that difference is exactly why the round-trip check polls.
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
        'Start it, or point SVI_BASE_URL at the right origin. This is a hard failure, never a skip.',
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

// Next.js serialises the RSC payload into the HTML, so a naive `body.includes(needle)` can
// match text that lives only in the flight data and never renders. These checks accept that:
// the flight payload IS the data the page received, and every needle used here also has to
// survive the visible-text check below where it matters. Where "actually visible" is the
// claim, use visibleText().
export function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Compares ignoring whitespace runs so a needle spanning a JSX line break still matches.
export function textContains(html, needle) {
  const haystack = visibleText(html).toLowerCase();
  const target = String(needle).replace(/\s+/g, ' ').trim().toLowerCase();
  return target.length > 0 && haystack.includes(target);
}

// ---------------------------------------------------------------------------
// Freshness — mandatory for any check that reads its needles from the dataset
// ---------------------------------------------------------------------------
//
// A rendered check that fetches ONCE is racing every writer. The dataset is authoritative the
// instant it commits; the page keeps serving its ISR copy until `export const revalidate = 60`
// expires, and the first request after that still serves stale while regenerating in the
// background. So a check that reads a needle from Sanity and immediately asserts it on the page
// can fail for pure timing, and that red is indistinguishable from a real one.
//
// This is not hypothetical and it is not rare: it is why A56 was the only red in one gate run
// and A41 the only red in the next, both immediately after the mutating checks restored their
// baselines. Both passed standalone every time.
//
// RULE FOR THIS CONTRACT: any check whose needles come from the dataset fetches its pages
// through settlePage(), never through a bare fetchOkPage(). Discrimination is unaffected — a
// page that genuinely never renders the value times out and the caller's assertion still fails.
// What goes away is the false red.
// 90s covers the whole observed staleness path: up to 60s of remaining ISR window (the retitle
// edit sat behind 12 stale reads over ~60s; A61's gate took 62s), plus the one stale read that
// follows it, plus a cold route compile. Kept deliberately tight because checks that settle
// several pages spend it PER PAGE, and every assertion's timeout_seconds must exceed the sum.
export const SETTLE_TIMEOUT_MS = 90_000;
export const SETTLE_INTERVAL_MS = 5_000;

// `needles` may be a string, an array of strings, or — preferred whenever another agent might be
// writing — an async FUNCTION returning the array. A fixed array is a snapshot of the dataset
// taken before the loop starts, and a snapshot cannot converge against a live writer: on
// 2026-08-12 this check settled on showVisitorInfo.planIntro while a concurrent round-trip check
// held a sentinel in .parking, so the page was fresh with respect to the needle we polled and
// stale with respect to the value we then asserted. Passing a function re-reads the dataset on
// every attempt, so the target is always "the page agrees with the dataset as it is NOW", which
// is the invariant these checks actually claim. Have the callback update the caller's own
// snapshot too, so the assertions after it use the same values the loop settled on.
export async function settlePage(pathname, needles, { timeoutMs = SETTLE_TIMEOUT_MS } = {}) {
  const readNeedles = async () => {
    const raw = typeof needles === 'function' ? await needles() : needles;
    return (Array.isArray(raw) ? raw : [raw]).filter(
      (n) => typeof n === 'string' && n.trim() !== '',
    );
  };

  let wanted = await readNeedles();
  let body = (await fetchOkPage(pathname)).body;
  if (wanted.length === 0) return body;

  const start = Date.now();
  let attempt = 1;
  while (!wanted.every((n) => textContains(body, n)) && Date.now() - start < timeoutMs) {
    console.log(
      `  [settle] ${pathname} attempt ${attempt}: not yet showing the current dataset values`,
    );
    await new Promise((res) => setTimeout(res, SETTLE_INTERVAL_MS));
    attempt += 1;
    wanted = await readNeedles();
    body = (await fetchOkPage(pathname)).body;
  }
  const elapsed = Math.round((Date.now() - start) / 1000);
  const fresh = wanted.every((n) => textContains(body, n));
  if (!fresh) {
    // Not an error here: returning the last body is deliberate, so the CALLER's assertion is
    // what fails and names the missing value. Never report this as "caught up".
    console.warn(
      `  [settle] ${pathname} never caught up within ${timeoutMs / 1000}s after ${attempt} ` +
        'fetches — asserting on the last response, which will fail below',
    );
  } else if (attempt > 1) {
    console.log(`  [settle] ${pathname} caught up after ${attempt} fetches (t+${elapsed}s)`);
  }
  return body;
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
      return condition;
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

// Exit codes are this contract's status channel, because contract.py records pass/fail only:
//   0 passed | 1 a real failure | 2 RESIDUE, a live content incident | 3 BLOCKED, never ran.
// A BLOCKED check has tested NOTHING. Treating it as a failure is what sent the team lead
// diagnosing a non-problem on 2026-08-12 when a gate run collided with another agent's check.
// The banner goes out FIRST and to both streams, so it survives contract.py's 500-character
// evidence window.
export async function runCheck(checkName, fn) {
  const reporter = makeReporter(checkName);
  let exitCode = 1;
  try {
    await fn(reporter);
    exitCode = reporter.finish();
  } catch (err) {
    const { DatasetLockBlockedError, PoisonedBaselineError, EXIT_CODE_BLOCKED, EXIT_CODE_RESIDUE_ALERT } =
      await import('./_mutation-guard.mjs');

    if (err instanceof DatasetLockBlockedError) {
      const banner =
        `BLOCKED: ${checkName} DID NOT RUN — ${err.message}\n` +
        'THIS IS NOT A FAILURE AND NOT A REGRESSION. The check never reached a single assertion, ' +
        'because another check was holding the dataset lock. Re-run it once that check finishes; ' +
        'do not go looking for a defect. Exit code 3 means blocked, never red.';
      console.error(banner);
      console.log(banner);
      process.exit(EXIT_CODE_BLOCKED);
    }

    if (err instanceof PoisonedBaselineError) {
      // Documented as exit 2 in dataset-mutation-safety.golden.md; it used to exit 1, which
      // filed a live content incident as an ordinary red.
      const banner = `RESIDUE ALERT: ${checkName} refused to start — ${err.message}`;
      console.error(banner);
      console.log(banner);
      process.exit(EXIT_CODE_RESIDUE_ALERT);
    }

    console.error(`FAIL: ${checkName} threw — ${err.stack ?? err.message}`);
    exitCode = 1;
  }
  process.exit(exitCode);
}
