// societies-content F1 — rendered half. Needs a prior `pnpm build`. Starts `next start` on a fixed local port and GETs only.
// /societies links exactly the 21 slugs; the 16 hidden slugs 404; no "Not supplied" and no committee note reaches any page.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import http from 'node:http';

const PORT = 3219;
const HOST = `saoc.localhost:${PORT}`;
const AUTH = `Basic ${Buffer.from('s:p').toString('base64')}`;
const LOG_DIR = '.tmp/sandbox/societies-content';
const SPEC = '.agent/memory/project/specs/societies-content/goldens';
const listed = JSON.parse(readFileSync(`${SPEC}/sanity-docs.json`, 'utf8')).map((d) => d.slug.current);
const hidden = JSON.parse(readFileSync(`${SPEC}/disposition.json`, 'utf8')).hide.map((h) => h._id.replace(/^society-/, ''));

mkdirSync(LOG_DIR, { recursive: true });
const log = openSync(`${LOG_DIR}/http-check-start.log`, 'w');
const env = {
  ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: 's', BETA_BASIC_AUTH_PASSWORD: 'p', SITE_PUBLIC_LAUNCH: '',
  NEXT_PUBLIC_SAOC_SITE_URL: `http://${HOST}`, NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${PORT}`, SITE_URL: `http://${HOST}`,
};
const portBusy = await new Promise((resolve) => {
  const probe = http.request({ host: '127.0.0.1', port: PORT, path: '/', method: 'HEAD' }, () => resolve(true));
  probe.on('error', () => resolve(false));
  probe.end();
});
if (portBusy) throw new Error(`port ${PORT} is already serving; a stale server would answer instead of this build`);
const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], { stdio: ['ignore', log, log], env });

let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); if (!ok) failures += 1; };
const get = (path) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: PORT, path, headers: { host: HOST, authorization: AUTH } }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
  });
  req.on('error', reject);
  req.end();
});

try {
  for (let i = 0; i < 90; i += 1) { try { if ((await get('/robots.txt')).status) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 1000)); }
  const list = await get('/societies');
  check('/societies 200', list.status === 200, `status=${list.status}`);
  const linked = [...new Set([...list.body.matchAll(/href="\/societies\/([a-z0-9-]+)"/g)].map((m) => m[1]))].sort();
  check('/societies links exactly the 21 listed slugs', JSON.stringify(linked) === JSON.stringify([...listed].sort()), `linked=${linked.length}`);
  check('/societies shows none of the 16 hidden names', hidden.every((s) => !list.body.includes(`/societies/${s}"`)));
  let sentinel = /not supplied/i.test(list.body);
  let leaked = false;
  for (const s of listed) {
    const r = await get(`/societies/${s}`);
    check(`/societies/${s} 200`, r.status === 200, `status=${r.status}`);
    if (/not supplied/i.test(r.body)) sentinel = true;
    if (/Byron Gopper|Would it be possible/.test(r.body)) leaked = true;
  }
  check('no "Not supplied" in any of the 22 pages', !sentinel);
  check('the Tygerberg webmaster note is not on any page', !leaked);
  const notFound = [];
  for (const s of hidden) if ((await get(`/societies/${s}`)).status !== 404) notFound.push(s);
  check('all 16 hidden /societies/<slug> pages are 404', notFound.length === 0, notFound.join(','));
  const sm = await get('/sitemap.xml');
  check('sitemap lists no hidden society', hidden.every((s) => !sm.body.includes(`/societies/${s}<`)));
} catch (e) {
  console.log(`FAIL harness ${e.message}`);
  failures += 1;
} finally {
  server.kill('SIGTERM');
}
process.exit(failures === 0 ? 0 : 1);
