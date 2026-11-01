import { appendFileSync } from 'node:fs';

import { formatCountLine } from './lib/groq-fingerprint.mjs';

const LOG = process.env.SANITY_COUNT_LOG;
const real = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (LOG && /\.(apicdn|api)\.sanity\.io/.test(url)) {
    appendFileSync(LOG, formatCountLine(url));
    return new Response(JSON.stringify({ ms: 1, query: '', result: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return real(input, init);
};
