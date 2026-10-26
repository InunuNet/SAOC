// A14: the captured Sanity fixture and its wiring. Static, no server.
//   node check-fixture-files.mjs                      verify
//   node check-fixture-files.mjs --write-manifest <logdir-of-the-capture-run>
//        rebuild fixtures/sanity/manifest.json from the files plus the capture run's _requests.log (the request count). Does not call Sanity.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const SPEC = '.agent/memory/project/specs/nos-content-standard';
const FIX = `${SPEC}/fixtures/sanity`;
const sortDeep = (v) => (Array.isArray(v) ? v.map(sortDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v);
const keyOf = (query, params) => createHash('sha256').update(`${query.trim()}\n${JSON.stringify(sortDeep(params ?? {}))}`).digest('hex');
const files = existsSync(FIX) ? readdirSync(FIX).filter((n) => /^[0-9a-f]{64}\.json$/.test(n)) : [];

if (process.argv[2] === '--write-manifest') {
  const logdir = process.argv[3];
  const reqLog = `${logdir}/_requests.log`;
  const requestCount = existsSync(reqLog) ? readFileSync(reqLog, 'utf8').split('\n').filter(Boolean).length : 0;
  const queries = files.map((n) => { const d = JSON.parse(readFileSync(`${FIX}/${n}`, 'utf8')); return { key: n.replace(/\.json$/, ''), queryHead: d.query.trim().replace(/\s+/g, ' ').slice(0, 120), params: d.params, capturedAt: d.capturedAt }; });
  const projectId = (readFileSync('apphosting.yaml', 'utf8').match(/variable: NEXT_PUBLIC_SANITY_PROJECT_ID\s*\n\s*value:\s*"?([^"\n]+)"?/) ?? [])[1] ?? '';
  const manifest = { capturedAt: new Date().toISOString(), host: `${projectId}.api.sanity.io`, perspective: 'published', publicDatasetReadsOnly: true, requestCount, queryCount: queries.length, queries };
  writeFileSync(`${FIX}/manifest.json`, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`manifest written: ${queries.length} queries, ${requestCount} live API request(s)`);
  process.exit(0);
}

const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const manifest = existsSync(`${FIX}/manifest.json`) ? JSON.parse(read(`${FIX}/manifest.json`)) : null;
check('fixtures/sanity/manifest.json exists (capture first: NOS_STD_FIXTURE=record, then --write-manifest)', Boolean(manifest));
if (manifest) {
  check('manifest has a capture date', /^\d{4}-\d{2}-\d{2}T/.test(manifest.capturedAt ?? ''));
  check('manifest host is the API host, not the CDN', /\.api\.sanity\.io$/.test(manifest.host ?? '') && !/apicdn/.test(manifest.host ?? ''), manifest.host);
  check('manifest records a live request count (> 0, and not more than twice the distinct queries: dedupe on disk)', Number.isInteger(manifest.requestCount) && manifest.requestCount > 0 && manifest.requestCount <= 2 * files.length, `${manifest.requestCount} vs ${files.length} queries`);
  check('manifest lists exactly the captured files', JSON.stringify((manifest.queries ?? []).map((q) => q.key).sort()) === JSON.stringify(files.map((n) => n.replace(/\.json$/, '')).sort()));
}
check('at least one captured query', files.length > 0);
for (const n of files) {
  const raw = read(`${FIX}/${n}`); let d = null;
  try { d = JSON.parse(raw); } catch { check(`${n} is JSON`, false); continue; }
  check(`${n.slice(0, 10)} is named by its query+params hash`, keyOf(d.query ?? '', d.params) === n.replace(/\.json$/, ''));
  check(`${n.slice(0, 10)} holds query, params, result, capturedAt only`, JSON.stringify(Object.keys(d).sort()) === JSON.stringify(['capturedAt', 'params', 'query', 'result']));
  check(`${n.slice(0, 10)} carries no credential (no bearer/authorization header text, no sk token)`, !/Bearer\s|Authorization|\bsk[A-Za-z0-9]{40,}/.test(raw));
}
const client = read('sanity/lib/client.ts'); const fetchTs = read('sanity/lib/fetch.ts'); const lib = read('lib/sanity-fixture.ts');
check('sanity/lib/client.ts wraps the exported client with withFixture from the fixture module (the hook point)', /from ['"][^'"]*sanity-fixture['"]/.test(client) && /withFixture\(/.test(client));
// Rev 46m (Codex A12, SAOC-approved): fetch.ts imports SanityFixtureMiss alone, to rethrow it from its catch ahead of the propagateErrors check. The hook (withFixture) stays in client.ts only.
const fetchFixtureImports = [...fetchTs.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]*sanity-fixture['"]/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '')).filter(Boolean));
check('the hook is NOT in sanity/lib/fetch.ts: no withFixture (call or import), no other import from the fixture module than SanityFixtureMiss, no SANITY_FIXTURE env read (SAOC owns that file; Rev 46m)', !/withFixture|SANITY_FIXTURE/.test(fetchTs) && fetchFixtureImports.every((n) => n === 'SanityFixtureMiss') && !/(?:import|export)[^;]*\*\s+(?:as\s+\w+\s+)?from\s*['"][^'"]*sanity-fixture['"]/.test(fetchTs), `imports from the fixture module: ${fetchFixtureImports.join(', ') || 'none'}`);
check('lib/sanity-fixture.ts exports withFixture, fixtureKey, isFixtureActive and SanityFixtureMiss', ['withFixture', 'fixtureKey', 'isFixtureActive', 'assertFixtureEnv', 'SanityFixtureMiss'].every((n) => new RegExp(`export (async )?(function|class|const) ${n}\\b`).test(lib)));
check('lib/sanity-fixture.ts reads SANITY_FIXTURE_MODE, SANITY_FIXTURE_DIR and SANITY_FIXTURE_RECORD_CONFIRM and consults isHostedRuntime from ./fixture-route-guard (relative import, so a bare tsx load works)', /SANITY_FIXTURE_DIR/.test(lib) && /SANITY_FIXTURE_MODE/.test(lib) && /SANITY_FIXTURE_RECORD_CONFIRM/.test(lib) && /isHostedRuntime/.test(lib) && /from ['"]\.\/fixture-route-guard['"]/.test(lib));
check('lib/sanity-fixture.ts has no token, no createClient and no NEXT_PUBLIC switch', !/createClient|NEXT_PUBLIC_SANITY_FIXTURE|process\.env\.SANITY_(API_)?(READ_|WRITE_)?TOKEN/.test(lib));

// Condition 4: generic. No NOS path or route knowledge inside; the dir comes only from env (SAOC's gates reuse this file).
check('lib/sanity-fixture.ts is generic: no NOS path, route or spec knowledge', !/nos-content-standard|national-show|\.agent\/|fixtures\/sanity|\/\(nos\)|specs\//.test(lib));
check('lib/sanity-fixture.ts runs assertFixtureEnv() at module load (a bad environment fails the server at import)', /^assertFixtureEnv\(\);?\s*$/m.test(lib));
check('lib/sanity-fixture.ts fixtureKey takes (query, params, perspective?) and never lets useCdn into the key (Rev 46m; the behaviour is asserted in A13)', (() => { const m = lib.match(/export function fixtureKey\(([^)]*)\)[\s\S]*?\n\}/); return Boolean(m) && /perspective/.test(m[1]) && !/useCdn/.test(m[0]); })());
// Condition 3: every client that bypasses `client` is inventoried; a new createClient in app/lib/sanity/components must be added to the inventory with a reason.
const inv = JSON.parse(read(`${SPEC}/goldens/fixture-client-inventory.json`) || '{}');
const known = new Set([...(inv.wrapped ?? []), ...(inv.bypass ?? []).map((b) => b.file)]);
const walk = (d) => (existsSync(d) ? readdirSync(d, { recursive: true }).map((f) => `${d}/${f}`).filter((f) => /\.(tsx?|mjs)$/.test(f) && !/node_modules/.test(f)) : []);
const found = ['app', 'lib', 'sanity', 'components'].flatMap(walk).filter((f) => /\bcreateClient\s*\(/.test(read(f)));
const codeFound = found.filter((f) => read(f).split('\n').some((l) => /\bcreateClient\s*\(/.test(l) && !/^\s*(\/\/|\*)/.test(l)));
check('every createClient( under app, lib, sanity and components is wrapped or inventoried with a reason (goldens/fixture-client-inventory.json)', codeFound.every((f) => known.has(f)), codeFound.filter((f) => !known.has(f)).join(', '));
check('every inventoried bypass client says it does not run on a gated route', (inv.bypass ?? []).length > 0 && inv.bypass.every((b) => b.gatedRoutes === false && b.reason));
// Condition 1, SAOC P0 shape (sanity/lib/cdn-fallback.ts, 34d079c0): client.ts = withCdnFallback(withFixture(createClient(...))), the fixture UNDER the fallback.
check('sanity/lib/client.ts wraps in the order withCdnFallback(withFixture(createClient(...))) - the fixture sits under SAOC\'s CDN->API retry', /withCdnFallback\(\s*withFixture\(\s*createClient\(/.test(client), 'expected withCdnFallback(withFixture(createClient(');
check('sanity/lib/client.ts imports withFixture from the fixture module and withCdnFallback from ./cdn-fallback', /import\s*\{[^}]*withFixture[^}]*\}\s*from\s*['"][^'"]*sanity-fixture['"]/.test(client) && /import\s*\{[^}]*withCdnFallback[^}]*\}\s*from\s*['"]\.\/cdn-fallback['"]/.test(client));
check('sanity/lib/cdn-fallback.ts is SAOC-owned and unchanged by this mission (no fixture reference in it)', !/SANITY_FIXTURE|sanity-fixture|withFixture/.test(read('sanity/lib/cdn-fallback.ts')));
check('lib/sanity-fixture.ts is a Proxy over the real client that returns wrapped clients from withConfig() and clone() (the fallback and any derived client must not reach the network)', /new Proxy\(/.test(lib) && /withConfig/.test(lib) && /clone/.test(lib));
// Condition 1 (tightened to SAOC's P0 shape once the sha is pinned): any createClient in sanity/lib is passed through withFixture, so a CDN->API retry sits ABOVE the fixture.
const libClients = ['sanity/lib/client.ts', 'sanity/lib/fetch.ts'].map(read).join('\n');
const nClients = (libClients.match(/\bcreateClient\s*\(/g) ?? []).length; const nWraps = (libClients.match(/\bwithFixture\s*\(/g) ?? []).length;
check(`every createClient( in sanity/lib is wrapped by withFixture so the P0 CDN->API retry cannot reach the network in replay (${nClients} clients, ${nWraps} wraps)`, nClients > 0 && nWraps >= nClients);
const leaks = ['components/ui', 'app'].flatMap((d) => (existsSync(d) ? readdirSync(d, { recursive: true }).filter((f) => /\.(tsx?|css)$/.test(String(f))).map((f) => `${d}/${f}`) : [])).filter((f) => /SANITY_FIXTURE/.test(read(f)));
check('SANITY_FIXTURE_* is read nowhere under components/ui or app', leaks.length === 0, leaks.slice(0, 3).join(', '));
if (failures.length) { console.error(`A14 FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`A14 pass (${files.length} captured queries, ${manifest?.requestCount} live request(s) at capture)`);
