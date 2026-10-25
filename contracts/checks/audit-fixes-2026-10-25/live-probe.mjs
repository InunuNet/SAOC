#!/usr/bin/env node
// Live probe against `next dev` on a private port (3013), with the beta password wall lifted for this
// process only. Dev-server HTML equals built output for these checks: they read server-rendered markup.
// Needs .env.local (Sanity read access). Probes, by Host header:
//   NOS 404 is server-rendered (status 404, <html lang="en">, one h1, the NOS copy, typographic NosHero, no photo)
//   the four NOS pages that doubled their h1, plus home and a ticket page, each have exactly one h1
//   the NOS sitemap lists /contact and the ticket pages that /tickets links to, and no shared policy page
//   a SAOC society page says nothing of "biennial"
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';

const PORT = 3013;
const NOS_HOST = `nos.localhost:${PORT}`;
const SAOC_HOST = `localhost:${PORT}`;
const READY_TIMEOUT_MS = 180_000;
const REQUEST_TIMEOUT_MS = 180_000;

const agentsBefore = readFileSync('AGENTS.md', 'utf8'); // `next dev` rewrites it; restored on exit
const server = spawn('pnpm', ['exec', 'next', 'dev', '--port', String(PORT)], {
  env: { ...process.env, BETA_PASSWORD_WALL_OFF: 'true' },
  stdio: 'ignore',
});

function get(host, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: urlPath, headers: { Host: host }, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body, location: res.headers.location ?? '' }));
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout ${host}${urlPath}`)));
    req.on('error', reject);
    req.end();
  });
}

async function follow(host, urlPath) {
  let res = await get(host, urlPath);
  for (let hops = 0; hops < 3 && res.status >= 300 && res.status < 400 && res.location; hops += 1) {
    res = await get(host, new URL(res.location, `http://${host}`).pathname);
  }
  return res;
}

const count = (text, re) => (text.match(re) ?? []).length;
const problems = [];
const need = (ok, msg) => { if (!ok) problems.push(msg); };

async function waitReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try { await get(SAOC_HOST, '/robots.txt'); return; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error('next dev did not become ready');
}

function cleanup() {
  server.kill('SIGTERM');
  try {
    if (readFileSync('AGENTS.md', 'utf8') !== agentsBefore) writeFileSync('AGENTS.md', agentsBefore);
  } catch { /* AGENTS.md unreadable: nothing to restore */ }
}

try {
  await waitReady();

  const notFound = await get(NOS_HOST, '/nonexistent-xyz');
  need(notFound.status === 404, `NOS 404: status ${notFound.status}`);
  need(/<html[^>]*\slang="en"/.test(notFound.body), 'NOS 404: <html> has no lang="en" in server HTML');
  need(count(notFound.body, /<h1[\s>]/g) === 1, `NOS 404: ${count(notFound.body, /<h1[\s>]/g)} h1 (want 1)`);
  need(notFound.body.includes('This orchid has left the bench.'), 'NOS 404: not-found copy missing from server HTML');
  need(/nos-hero-type/.test(notFound.body) && /nos-hero-title/.test(notFound.body), 'NOS 404: not the typographic NosHero (nos-hero-type / nos-hero-title missing)');
  need(!/\/images\/(_opt\/)?orchid-/.test(notFound.body), 'NOS 404: carries a hero photograph');
  need(!notFound.body.includes('Find a society'), 'NOS 404: renders the SAOC not-found copy ("Find a society") inside NOS chrome');

  for (const route of ['/conferences', '/symposium', '/workshops', '/wosa-conference', '/', '/tickets/vip']) {
    const res = await follow(NOS_HOST, route);
    need(res.status === 200, `NOS ${route}: status ${res.status}`);
    const h1s = count(res.body, /<h1[\s>]/g);
    need(h1s === 1, `NOS ${route}: ${h1s} h1 (want 1)`);
  }

  const sitemap = await get(NOS_HOST, '/sitemap.xml');
  need(sitemap.status === 200, `NOS sitemap: status ${sitemap.status}`);
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  need(locs.includes('/contact'), 'NOS sitemap: /contact missing');
  for (const shared of ['/privacy', '/terms', '/refunds']) {
    need(!locs.includes(shared), `NOS sitemap: ${shared} listed (its canonical is the SAOC host)`);
  }
  const ticketLocs = locs.filter((p) => /^\/tickets\/[a-z0-9-]+$/.test(p) && !/^\/tickets\/(cancelled|confirmation|buy)$/.test(p));
  need(ticketLocs.length > 0, 'NOS sitemap: no /tickets/[slug] entries');
  const listing = await follow(NOS_HOST, '/tickets');
  const linked = new Set([...listing.body.matchAll(/href="(\/tickets\/[a-z0-9-]+)(?:\?[^"]*)?"/g)].map((m) => m[1]));
  for (const p of ticketLocs) need(linked.has(p), `NOS sitemap: ${p} is not linked from /tickets`);
  need(new Set(locs).size === locs.length, 'NOS sitemap: duplicate entries');

  const saocSitemap = await get(SAOC_HOST, '/sitemap.xml');
  const society = [...saocSitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname)
    .find((p) => p.startsWith('/societies/'));
  need(Boolean(society), 'SAOC sitemap: no society page to probe');
  if (society) {
    const page = await get(SAOC_HOST, society);
    need(page.status === 200, `SAOC ${society}: status ${page.status}`);
    need(!/biennial/i.test(page.body), `SAOC ${society}: still says "biennial"`);
    need(/triennial/i.test(page.body), `SAOC ${society}: does not say "triennial"`);
  }
} catch (error) {
  problems.push(`probe error: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  cleanup();
}

if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('ok: live probe green');
