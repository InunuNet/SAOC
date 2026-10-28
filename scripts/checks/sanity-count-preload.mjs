import { appendFileSync } from 'node:fs';
const LOG = process.env.SANITY_COUNT_LOG;
const real = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (LOG && /\.(apicdn|api)\.sanity\.io/.test(url)) {
    const u = new URL(url);
    appendFileSync(LOG, `${Date.now()} ${u.hostname.split('.').slice(-3).join('.')} ${decodeURIComponent(u.search).slice(0, 90).replace(/\s+/g, ' ')}\n`);
    return new Response(JSON.stringify({ ms: 1, query: '', result: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return real(input, init);
};
