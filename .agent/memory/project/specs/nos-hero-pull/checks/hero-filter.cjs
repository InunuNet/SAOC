// TEST HARNESS ONLY (QA input, hash-locked; never shipped code). Preloaded with NODE_OPTIONS --require into `next build` and `next start`
// by _server.mjs, so the live Sanity homePage reaches the page without the starved yellow hero asset, as it will once the lead removes it
// from the rotation in Sanity after rHB is live (Codi's ruling, 2026-10-22). It wraps globalThis.fetch: a response from a *.sanity.io
// host whose body names the asset has every array element that names it removed; nothing else is touched. Next patches fetch after this
// preload runs, so its data cache stores the filtered body.
const ASSET = process.env.NOS_RHB_DROP_ASSET || 'a620a97f';
const original = globalThis.fetch;

function drop(value) {
  if (Array.isArray(value)) return value.filter((v) => !JSON.stringify(v).includes(ASSET)).map(drop);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, drop(v)]));
  return value;
}

globalThis.fetch = async function filteredFetch(input, init) {
  const res = await original(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
  let host = '';
  try { host = new URL(url).hostname; } catch { return res; }
  if (!host.endsWith('.sanity.io')) return res;
  const text = await res.clone().text();
  if (!text.includes(ASSET)) return res;
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('x-nos-rhb-filtered', ASSET);
  return new Response(JSON.stringify(drop(JSON.parse(text))), { status: res.status, statusText: res.statusText, headers });
};
