#!/usr/bin/env node
// nos-provenance-fix F2 (H1) — the trimmed traces still serve the pages that read files.
//
// Usage: node contracts/checks/trace-excludes/check-runtime.mjs [projectRoot]
//
// Requires a STANDALONE build (NEXT_PRIVATE_STANDALONE=true pnpm build), which is what
// Firebase App Hosting deploys: only traced files exist under .next/standalone, and the server's
// process.cwd() is that directory, so a runtime read of an excluded-but-needed file fails here
// exactly as it would on beta. A plain `next start` runs from the project root, where every
// file exists, and would prove nothing about the trace.
//
// Starts .next/standalone/server.js on 127.0.0.1:3017 behind the beta wall (throwaway probe
// credentials, sent back in the Authorization header), checks three routes, then stops ONLY
// the process group it spawned. Exit 0 = pass, 1 = assertion failed, 2 = could not run.
import { spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const PORT = 3017;
const HOST = '127.0.0.1';
const BOOT_TIMEOUT_MS = 90_000;
const PROBE_USER = 'trace-probe';
const PROBE_PASS = 'trace-probe-local-only';
const standalone = path.join(root, '.next', 'standalone');
const server = path.join(standalone, 'server.js');

if (!existsSync(server)) {
  console.error('check-runtime: no .next/standalone/server.js — build with NEXT_PRIVATE_STANDALONE=true pnpm build');
  process.exit(2);
}

const portBusy = await new Promise((resolve) => {
  const s = net.createConnection({ host: HOST, port: PORT });
  s.once('connect', () => { s.destroy(); resolve(true); });
  s.once('error', () => resolve(false));
});
if (portBusy) {
  console.error(`check-runtime: port ${PORT} already in use — refusing to touch a process this check did not start`);
  process.exit(2);
}

// App Hosting's adapter copies these alongside the standalone server; mirror it.
cpSync(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });
if (existsSync(path.join(root, 'public'))) cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });

const child = spawn(process.execPath, ['server.js'], {
  cwd: standalone,
  detached: true,
  stdio: ['ignore', 'ignore', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: HOST,
    BETA_BASIC_AUTH_USER: PROBE_USER,
    BETA_BASIC_AUTH_PASSWORD: PROBE_PASS,
  },
});
let stderrTail = '';
child.stderr.on('data', (d) => { stderrTail = (stderrTail + d.toString()).slice(-2000); });

function stop() {
  if (child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } }, 3000).unref();
}
process.on('exit', stop);

const auth = 'Basic ' + Buffer.from(`${PROBE_USER}:${PROBE_PASS}`).toString('base64');
const get = (p) => fetch(`http://${HOST}:${PORT}${p}`, { headers: { authorization: auth }, redirect: 'manual' });

const deadline = Date.now() + BOOT_TIMEOUT_MS;
let up = false;
while (Date.now() < deadline) {
  if (child.exitCode !== null) break;
  try { await get('/national-show/faq'); up = true; break; } catch { await new Promise((r) => setTimeout(r, 500)); }
}
if (!up) {
  console.error(`check-runtime: server did not come up on ${PORT} (pid ${child.pid}). stderr tail:\n${stderrTail}`);
  stop();
  process.exit(2);
}

const CHECKS = [
  {
    route: '/national-show/sa-exhibitors',
    must: [/data-section-key="/],
  },
  {
    route: '/national-show/symposium',
    // The theme section is council-supplied from content/drive-recovered. Rendering it WITHOUT a
    // notice proves the standalone server could read the traced source file at runtime.
    must: [/class="nos-show-page-prose" data-section-key="theme"/],
  },
  {
    route: '/national-show/faq',
    must: [/frequently asked questions/i],
  },
];
const FORBIDDEN = [/Application error/i, /This page could not be found/i, /Internal Server Error/i];

let failed = false;
for (const { route, must } of CHECKS) {
  const res = await get(route);
  const html = await res.text();
  const problems = [];
  if (res.status !== 200) problems.push(`status ${res.status}`);
  for (const re of must) if (!re.test(html)) problems.push(`missing ${re}`);
  for (const re of FORBIDDEN) if (re.test(html)) problems.push(`contains ${re}`);
  if (problems.length) { failed = true; console.log(`FAIL ${route}: ${problems.join('; ')}`); }
  else console.log(`ok   ${route}: 200, sections rendered`);
}
stop();
console.log(`check-runtime: stopped pid ${child.pid}`);
process.exit(failed ? 1 : 0);
