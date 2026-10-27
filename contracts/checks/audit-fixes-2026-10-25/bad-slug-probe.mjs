#!/usr/bin/env node
// Production probe (needs a prior `pnpm build`): starts `next start` on a private port and requests an
// unknown value for every route that has generateStaticParams plus notFound(), on both hosts. The host-aware
// root not-found reads the request headers, and a statically generated route whose not-found turns dynamic
// answers 500, so each of these must answer 404. The NOS 404 head must not carry SAOC branding.
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 3017;
const NOS_HOST = 'nos.saoc.co.za';
const SAOC_HOST = 'beta.saoc.co.za';
const READY_TIMEOUT_MS = 60_000;
const server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(PORT)], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    BETA_PASSWORD_WALL_OFF: 'true',
    NEXT_PUBLIC_SAOC_SITE_URL: `https://${SAOC_HOST}`,
    NEXT_PUBLIC_NOS_SITE_URL: `https://${NOS_HOST}`,
  },
  stdio: 'ignore',
});

function get(host, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: urlPath, headers: { Host: host }, timeout: 60_000 },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout ${host}${urlPath}`)));
    req.on('error', reject);
    req.end();
  });
}

const problems = [];
const need = (ok, msg) => { if (!ok) problems.push(msg); };
const title = (body) => /<title>([^<]*)<\/title>/.exec(body)?.[1] ?? '';

try {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    try { await get(SAOC_HOST, '/robots.txt'); break; } catch {
      if (Date.now() > deadline) throw new Error('next start did not become ready (run pnpm build first)');
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const cases = [
    [NOS_HOST, '/archive/1900'],
    [NOS_HOST, '/archive/abc'],
    [NOS_HOST, '/nonexistent-xyz'],
    [SAOC_HOST, '/societies/zzz-bad-slug'],
    [SAOC_HOST, '/events/zzz-bad-slug'],
    [SAOC_HOST, '/nonexistent-xyz'],
  ];
  for (const [host, path] of cases) {
    const res = await get(host, path);
    need(res.status === 404, `${host}${path}: status ${res.status} (want 404)`);
    if (host === NOS_HOST) {
      need(!/South African Orchid Council/.test(title(res.body)), `${host}${path}: title carries SAOC branding: ${title(res.body)}`);
      need(!/find a society/i.test(res.body.slice(0, 6000)), `${host}${path}: head carries the SAOC description`);
    }
  }
} catch (error) {
  problems.push(`probe error: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  server.kill('SIGTERM');
}

if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('ok: bad slugs answer 404 on both hosts, NOS 404 head is NOS-branded');
