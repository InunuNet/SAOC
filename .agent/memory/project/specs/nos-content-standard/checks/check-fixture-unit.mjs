// A13: lib/sanity-fixture.ts behaves as specified - key vector (query + params only: never useCdn or perspective options), off = identity, FAIL-CLOSED, record/replay round trip,
// a miss is a hard error that never reaches the network and never carries an HTTP status (so SAOC's 402/429/5xx fallback cannot swallow it), and the
// draft perspective is never served. Run from the repo root. tsx is registered programmatically; lib/sanity-fixture.ts must import relatively (no '@/').
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';

register();
const SPEC = '.agent/memory/project/specs/nos-content-standard';
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };
const SB = '.tmp/sandbox/fixture-unit';
const DIR = `${SB}/fixtures`; const LOG = `${SB}/logs`;
rmSync(SB, { recursive: true, force: true }); mkdirSync(DIR, { recursive: true }); mkdirSync(LOG, { recursive: true });
const ENV_KEYS = ['SANITY_FIXTURE_DIR', 'SANITY_FIXTURE_MODE', 'SANITY_FIXTURE_LOGDIR', 'SANITY_FIXTURE_RECORD_CONFIRM', 'K_SERVICE'];
const setEnv = (o) => { for (const k of ENV_KEYS) delete process.env[k]; for (const [k, v] of Object.entries(o)) process.env[k] = v; };

let mod;
try { mod = await import(pathToFileURL(path.resolve(process.env.NOS_STD_ROOT ?? process.cwd(), 'lib/sanity-fixture.ts')).href); } catch (e) { console.error(`A13 FAILED: cannot import lib/sanity-fixture.ts (${e.message})`); process.exit(1); }
for (const n of ['withFixture', 'fixtureKey', 'isFixtureActive', 'assertFixtureEnv', 'SanityFixtureMiss']) check(`lib/sanity-fixture.ts exports ${n}`, n in mod);
if (failures.length) { console.error(`A13 FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
const { withFixture, fixtureKey, isFixtureActive, assertFixtureEnv, SanityFixtureMiss } = mod;

const vec = JSON.parse(readFileSync(`${SPEC}/goldens/fixture-key-vector.json`, 'utf8'));
for (const [i, k] of vec.cases.entries()) check(`key vector ${i}: fixtureKey equals the golden`, fixtureKey(k.query, k.params ?? undefined) === k.key, `${fixtureKey(k.query, k.params ?? undefined)} vs ${k.key}`);
check('key ignores param key order', fixtureKey('*', { a: 1, b: 2 }) === fixtureKey('*', { b: 2, a: 1 }));
check('key ignores surrounding whitespace in the query', fixtureKey('  *[x]\n', {}) === fixtureKey('*[x]', {}));

const fakeClient = (result) => {
  const calls = { fetch: 0, withConfig: [], opts: [] };
  const real = { fetch: async (q, p, o) => { calls.fetch += 1; calls.opts.push(o); return structuredClone(result); }, withConfig: (c) => { calls.withConfig.push(c); return real; }, config: () => ({ useCdn: true }), clone: () => real };
  real.calls = calls; return real;
};
const Q = '*[_type == "x"][0]{a}'; const P = { slug: 's' };

setEnv({});
let f = fakeClient({ a: 1 });
check('switch unset: isFixtureActive is false', isFixtureActive() === false);
check('switch unset: withFixture returns the very same client object (no behaviour change in production)', withFixture(f) === f);

check('SANITY_FIXTURE_DIR alone (mode unset) does nothing: isFixtureActive false, withFixture is the identity', (() => { setEnv({ SANITY_FIXTURE_DIR: DIR }); const g = fakeClient({}); return isFixtureActive() === false && withFixture(g) === g; })());
check('SANITY_FIXTURE_MODE=off is the same as unset', (() => { setEnv({ SANITY_FIXTURE_DIR: DIR, SANITY_FIXTURE_MODE: 'off' }); const g = fakeClient({}); return isFixtureActive() === false && withFixture(g) === g; })());
const throwsFn = (fn) => { try { fn(); return false; } catch { return true; } };
check('FAIL-CLOSED: assertFixtureEnv throws on the hosted runtime (K_SERVICE) when the mode is replay', throwsFn(() => assertFixtureEnv({ K_SERVICE: 'svc', SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: DIR })));
check('FAIL-CLOSED: assertFixtureEnv throws on the hosted runtime even for record WITH the confirm flag', throwsFn(() => assertFixtureEnv({ K_SERVICE: 'svc', SANITY_FIXTURE_MODE: 'record', SANITY_FIXTURE_RECORD_CONFIRM: '1', SANITY_FIXTURE_DIR: DIR })));
check('assertFixtureEnv does not throw on the hosted runtime when the mode is unset or off', !throwsFn(() => assertFixtureEnv({ K_SERVICE: 'svc' })) && !throwsFn(() => assertFixtureEnv({ K_SERVICE: 'svc', SANITY_FIXTURE_MODE: 'off', SANITY_FIXTURE_DIR: DIR })));
check('record mode refuses without SANITY_FIXTURE_RECORD_CONFIRM=1 (anywhere)', throwsFn(() => assertFixtureEnv({ SANITY_FIXTURE_MODE: 'record', SANITY_FIXTURE_DIR: DIR })) && !throwsFn(() => assertFixtureEnv({ SANITY_FIXTURE_MODE: 'record', SANITY_FIXTURE_RECORD_CONFIRM: '1', SANITY_FIXTURE_DIR: DIR })));
check('replay or record without SANITY_FIXTURE_DIR throws (the dir comes only from env)', throwsFn(() => assertFixtureEnv({ SANITY_FIXTURE_MODE: 'replay' })));
check('an unknown mode throws', throwsFn(() => assertFixtureEnv({ SANITY_FIXTURE_MODE: 'live', SANITY_FIXTURE_DIR: DIR })));
check('FAIL-CLOSED: withFixture itself re-asserts and throws on the hosted runtime', (() => { setEnv({ SANITY_FIXTURE_DIR: DIR, SANITY_FIXTURE_MODE: 'replay', K_SERVICE: 'svc' }); return throwsFn(() => withFixture(fakeClient({}))); })());

setEnv({ SANITY_FIXTURE_DIR: DIR, SANITY_FIXTURE_MODE: 'record', SANITY_FIXTURE_RECORD_CONFIRM: '1', SANITY_FIXTURE_LOGDIR: LOG });
f = fakeClient({ a: 1, nested: { b: [1, 2] } });
const rec = withFixture(f);
check('record: wrapper is a different object', rec !== f);
const r1 = await rec.fetch(Q, P, { perspective: 'published', useCdn: true, next: { tags: ['sanity'] } });
check('record: returns the live result', r1 && r1.a === 1);
check('record: the live read went through the API host (withConfig useCdn false, option useCdn false)', f.calls.withConfig.some((c) => c && c.useCdn === false) && f.calls.opts[0] && f.calls.opts[0].useCdn === false, JSON.stringify([f.calls.withConfig, f.calls.opts]));
const key = fixtureKey(Q, P);
check('record: <key>.json written', existsSync(`${DIR}/${key}.json`));
const saved = existsSync(`${DIR}/${key}.json`) ? JSON.parse(readFileSync(`${DIR}/${key}.json`, 'utf8')) : {};
check('record: file holds query, params, result and capturedAt only', JSON.stringify(Object.keys(saved).sort()) === JSON.stringify(['capturedAt', 'params', 'query', 'result']), Object.keys(saved).join(','));
check('record: _requests.log has one line', existsSync(`${LOG}/_requests.log`) && readFileSync(`${LOG}/_requests.log`, 'utf8').trim().split('\n').length === 1);
await rec.fetch(Q, P, {});
check('record: a second identical read is served from disk (one live request in total)', f.calls.fetch === 1, String(f.calls.fetch));

setEnv({ SANITY_FIXTURE_DIR: DIR, SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_LOGDIR: LOG });
const deadCalls = { fetch: 0 };
const dead = { fetch: async () => { deadCalls.fetch += 1; throw Object.assign(new Error('NETWORK TOUCHED (a CDN 402)'), { statusCode: 402 }); }, withConfig() { return dead; }, config() { return { useCdn: true }; }, clone() { return dead; } };
const rep = withFixture(dead);
const r2 = await rep.fetch(Q, P, { perspective: 'published', useCdn: true });
const r2b = await rep.fetch(Q, P, { perspective: 'published', useCdn: false });
check('the key ignores useCdn: a CDN-flavoured read and an API-flavoured read resolve to the same entry (so a CDN->API retry under withFixture both hit)', r2b && r2b.a === 1);
check('replay: returns the recorded result without calling the client', r2 && r2.a === 1 && r2.nested.b.length === 2);
r2.nested.b.push(99);
const r3 = await rep.fetch(Q, P);
check('replay: each read is a deep clone (a caller mutating a result cannot change the next read)', r3.nested.b.length === 2);
check('replay: _hits.log has the hits', existsSync(`${LOG}/_hits.log`) && readFileSync(`${LOG}/_hits.log`, 'utf8').trim().split('\n').length >= 2);
check('replay: _started.log records mode=replay and the dir', existsSync(`${LOG}/_started.log`) && /mode=replay/.test(readFileSync(`${LOG}/_started.log`, 'utf8')) && readFileSync(`${LOG}/_started.log`, 'utf8').includes(DIR));

let miss = null;
try { await rep.fetch('*[_type == "never-captured"]', {}); } catch (e) { miss = e; }
check('replay: a miss REJECTS (hard error, never a silent live fetch or null)', miss !== null);
check('replay: the miss is a SanityFixtureMiss', miss instanceof SanityFixtureMiss && miss.name === 'SanityFixtureMiss');
check('replay: the miss carries no HTTP status, so a 402/429/5xx fallback cannot treat it as a transient failure', miss && miss.statusCode === undefined && miss.status === undefined && miss.response === undefined);
check('replay: the miss is appended to _misses.log', existsSync(`${LOG}/_misses.log`) && readFileSync(`${LOG}/_misses.log`, 'utf8').includes('never-captured'));
let draft = null;
try { await rep.fetch(Q, P, { perspective: 'previewDrafts' }); } catch (e) { draft = e; }
check('replay: the draft perspective is a miss (fixtures are published reads only)', draft instanceof SanityFixtureMiss);
check('replay: no extra files appear in the fixture dir', readdirSync(DIR).every((n) => /^[0-9a-f]{64}\.json$/.test(n)));


// P0 shape (SAOC sanity/lib/cdn-fallback.ts, 34d079c0): client.ts = withCdnFallback(withFixture(createClient(...))). The fallback calls client.config().useCdn and retries with the
// SAME client's fetch, and it Proxies with bind(target); the fixture must therefore be a Proxy over the real client (not a spread: SanityClient methods live on the prototype),
// pass config() through, and hand back WRAPPED clients from withConfig() and clone(), or a retry/derived client would reach the network.
const wrapped = withFixture(dead);
check('withFixture preserves config() (the fallback reads client.config().useCdn)', typeof wrapped.config === 'function' && wrapped.config().useCdn === true);
const viaConfig = wrapped.withConfig({ useCdn: false });
check('withConfig() returns a WRAPPED client: a read through it is served from the fixture, never the network', viaConfig !== dead && (await viaConfig.fetch(Q, P).then((r) => r && r.a === 1, () => false)) && deadCalls.fetch === 0, `network calls ${deadCalls.fetch}`);
const viaClone = wrapped.clone();
check('clone() returns a WRAPPED client too', viaClone !== dead && (await viaClone.fetch(Q, P).then((r) => r && r.a === 1, () => false)) && deadCalls.fetch === 0);
const fbPath = pathToFileURL(path.resolve(process.env.NOS_STD_ROOT ?? process.cwd(), 'sanity/lib/cdn-fallback.ts')).href;
let fbMod = null; try { fbMod = await import(fbPath); } catch (e) { check('sanity/lib/cdn-fallback.ts (SAOC P0, 34d079c0) is present and imports', false, e.message); }
if (fbMod) {
  const fb = fbMod.withCdnFallback(withFixture(dead));
  const hit = await fb.fetch(Q, P, { perspective: 'published', useCdn: true }).catch((e) => e);
  check('withCdnFallback(withFixture(client)) in replay: a hit is served with zero network calls', hit && hit.a === 1 && deadCalls.fetch === 0, `network calls ${deadCalls.fetch}`);
  const missErr = await fb.fetch('*[_type == "never-captured-2"]', {}, { perspective: 'published', useCdn: true }).then(() => null, (e) => e);
  check('withCdnFallback(withFixture(client)) in replay: a miss is a SanityFixtureMiss and is NOT retried against the API host (no retry, zero network calls)', missErr instanceof SanityFixtureMiss && deadCalls.fetch === 0, `${missErr && missErr.name} network calls ${deadCalls.fetch}`);
  const missLines = readFileSync(`${LOG}/_misses.log`, 'utf8').split('\n').filter((l) => l.includes('never-captured-2'));
  check('the miss was logged exactly once (the fallback did not retry through the fixture)', missLines.length === 1, String(missLines.length));
  check('isCdnUnavailableError(miss) is false (a miss has no statusCode)', fbMod.isCdnUnavailableError(missErr) === false);
}
rmSync(SB, { recursive: true, force: true });
if (failures.length) { console.error(`A13 FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('A13 pass (sanity fixture unit behaviour, incl. fail-closed on the hosted runtime)');
