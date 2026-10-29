// Pure helpers for gate-render.mjs, exercised by selftest.mjs.

/** Follows redirects by hand, re-sending the Authorization header on every hop (fetch drops it on a cross-host redirect). Returns { status, url, hops }. */
export async function followWithAuth(url, auth, maxHops = 5, fetchImpl = fetch) {
  let current = url;
  for (let hops = 0; hops <= maxHops; hops += 1) {
    const res = await fetchImpl(current, { headers: { authorization: auth }, redirect: 'manual' });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) { current = new URL(location, current).toString(); continue; }
    return { status: res.status, url: current, hops };
  }
  return { status: 0, url: current, hops: maxHops + 1 };
}

/** Links to the award-entries path whose text is not the page title. Same-page fragment links (the skip link, href="#main") and empty-text links are not navigation labels. */
export function awardLinkViolations(links, target, title) {
  const toTarget = links.filter((l) => l.path === target && !(l.href ?? '').startsWith('#') && l.text);
  return { found: toTarget.length, bad: toTarget.filter((l) => l.text !== title) };
}
