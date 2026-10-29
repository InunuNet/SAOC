import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import http from 'node:http';
const W = process.argv[2]; const B = `${W}/.tmp/sandbox/sanity-baseline`; const PORT = 3218; const LOG = `${B}/run.log`;
writeFileSync(LOG, '');
const srv = spawn(`${W}/node_modules/.bin/next`, ['start', '-p', String(PORT)], { cwd: W, stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, NODE_ENV: 'production', SANITY_COUNT_LOG: LOG, NODE_OPTIONS: `--import ${B}/count-preload.mjs`,
    NEXT_PUBLIC_SANITY_PROJECT_ID: 'fakeproj', NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${PORT}`, NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${PORT}`, SITE_URL: `http://saoc.localhost:${PORT}`, SITE_PUBLIC_LAUNCH: 'true' } });
const get = (host, path) => new Promise((res) => { const r = http.request({ host: '127.0.0.1', port: PORT, path, headers: { host } }, (x) => { x.resume(); x.on('end', () => res({ s: x.statusCode, cc: x.headers['cache-control'] })); }); r.on('error', () => res({ s: 0 })); r.setTimeout(60000, () => r.destroy()); r.end(); });
const count = () => (existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).length : 0);
for (let i = 0; i < 60; i++) { if ((await get(`saoc.localhost:${PORT}`, '/privacy')).s) break; await new Promise((r) => setTimeout(r, 1000)); }
const S = `saoc.localhost:${PORT}`, N = `nos.localhost:${PORT}`;
const routes = [[S, '/'], [S, '/about'], [S, '/societies'], [S, '/events'], [S, '/judging'], [S, '/contact'], [S, '/sponsors'], [S, '/sitemap.xml'],
  [N, '/'], [N, '/about'], [N, '/faq'], [N, '/programme'], [N, '/what-to-expect'],
  [N, '/tickets'], [N, '/workshops'], [N, '/symposium'], [N, '/conferences'], [N, '/wosa-conference'], [N, '/sponsors'], [N, '/vendors'], [N, '/tickets']];
const out = [];
for (const [h, p] of routes) { const a0 = count(); const r1 = await get(h, p); const a1 = count(); await get(h, p); const a2 = count(); out.push(`${h.split('.')[0]} ${p} status=${r1.s} cold=${a1 - a0} warm=${a2 - a1} cc="${r1.cc}"`); }
console.log(out.join('\n')); srv.kill();
