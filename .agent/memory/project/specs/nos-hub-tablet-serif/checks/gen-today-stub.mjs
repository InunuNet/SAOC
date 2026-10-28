// Run-time stub for the date-keyed fixture entries (known-pending, closed by fix/fixture-stable-clock). Every captured entry whose params carry todayStart is
// re-keyed for TODAY (the South African calendar day, as lib/sast-date.ts computes it) and written to the SANDBOX copy only, with the recording day's result and
// `wx` (never overwriting an existing file, so a real capture of today's key wins). The tracked fixture dir is read, never written. Skipped by the callers under
// HUB_SERIF_FIXTURE_STRICT=1. Usage: node gen-today-stub.mjs <tracked fixture dir> <sandbox fixture dir>
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Mirrors lib/sast-date.ts (Africa/Johannesburg, UTC+2, no DST) and lib/sanity-fixture.ts fixtureKey (sha256 of the trimmed query, a newline, the params with keys sorted recursively).
const SAST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' });
export const sastDate = (now) => SAST_DATE_FORMAT.format(now);
export const sastStartOfDay = (now) => new Date(`${sastDate(now)}T00:00:00+02:00`).toISOString();
const canonical = (v) => (Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);
export const fixtureKey = (query, params) => createHash('sha256').update(`${query.trim()}\n${JSON.stringify(canonical(params ?? {}))}`).digest('hex');

export function writeTodayStubs(srcDir, destDir, now = new Date()) {
  const today = { todayStart: sastStartOfDay(now), todayDate: sastDate(now) };
  const written = [];
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
    const entry = JSON.parse(readFileSync(`${srcDir}/${file}`, 'utf8'));
    if (typeof entry.query !== 'string' || !entry.params || !('todayStart' in entry.params)) continue;
    const params = { ...entry.params, ...today };
    const key = fixtureKey(entry.query, params);
    const dest = `${destDir}/${key}.json`;
    if (existsSync(dest)) continue;
    writeFileSync(dest, JSON.stringify({ ...entry, params, capturedAt: `stub: ${today.todayDate}, the recording day's result, closed by fix/fixture-stable-clock` }), { flag: 'wx' });
    written.push(key);
  }
  return written;
}

// Controls: the key function reproduces every tracked file name that has params (so it is the fixture layer's own key), and the SAST day computed for each
// entry's own capturedAt equals the todayDate recorded in its params (so the day maths is the app's).
export function selftest(srcDir) {
  const bad = [];
  let checked = 0;
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
    const entry = JSON.parse(readFileSync(`${srcDir}/${file}`, 'utf8'));
    if (typeof entry.query !== 'string') continue;
    if (fixtureKey(entry.query, entry.params) !== file.replace(/\.json$/, '')) bad.push(`key replica differs from ${file}`);
    if (entry.params && 'todayStart' in entry.params) {
      checked += 1;
      const at = new Date(entry.capturedAt);
      if (sastDate(at) !== entry.params.todayDate || sastStartOfDay(at) !== entry.params.todayStart) bad.push(`SAST day maths differs from the recorded params in ${file}`);
    }
  }
  if (checked === 0) bad.push('no date-keyed entry found to check the day maths against');
  return bad;
}

// The gate's own unknown-slug probes (sweep-routes.json notFoundRoutes: /tickets/<slug>) can never be in a recording: nothing real was captured for them. For
// every captured ticketType by-slug entry (params exactly { slug }) a null (or empty list) result is keyed for each probe slug, so the not-found route answers
// from the fixture the way the live dataset answers for an unknown slug. Sandbox copy only, wx, never the tracked dir. TEST-ONLY and PERMANENT (not closedBy any PR), skipped under HUB_SERIF_FIXTURE_STRICT=1 with the other stubs. It is NOT removable by a refresh:
// a real capture cannot hold a slug that does not exist.
export function writeUnknownSlugStubs(srcDir, destDir, probeSlugs) {
  const written = [];
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
    const entry = JSON.parse(readFileSync(`${srcDir}/${file}`, 'utf8'));
    if (typeof entry.query !== 'string' || !entry.query.includes('_type == "ticketType"') || !entry.query.includes('slug.current == $slug')) continue;
    if (!entry.params || Object.keys(entry.params).join() !== 'slug') continue;
    for (const slug of probeSlugs) {
      const params = { slug };
      const key = fixtureKey(entry.query, params);
      const dest = `${destDir}/${key}.json`;
      if (existsSync(dest)) continue;
      writeFileSync(dest, JSON.stringify({ query: entry.query, params, result: Array.isArray(entry.result) ? [] : null, capturedAt: 'stub: the gate unknown-slug probe, no such ticket type' }), { flag: 'wx' });
      written.push(key);
    }
  }
  return written;
}

// The probe slugs named by the sweep routes golden (/tickets/<slug> not-found routes).
export function probeSlugsFrom(routesFile) {
  const routes = JSON.parse(readFileSync(routesFile, 'utf8'));
  return (routes.notFoundRoutes ?? []).map((r) => /^\/tickets\/([^/]+)$/.exec(r.path)?.[1]).filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [src, dest, flag] = process.argv.slice(2);
  const routes = fileURLToPath(new URL('../goldens/sweep-routes.json', import.meta.url));
  if (flag !== '--strict') {
    console.log(`unknown-slug stubs written: ${writeUnknownSlugStubs(src, dest, probeSlugsFrom(routes)).length}`);
    console.log(`today stubs written: ${writeTodayStubs(src, dest).length}`);
  }
}
