#!/usr/bin/env node
// F18-A7 (R76b, runtime): in a public build no builder-brief summary of goldens/f18/lede-verdicts.json (verdict "drop") appears anywhere in the server HTML of any NOS route
// (hero lede, meta description, og:description, JSON-LD all count: the text reaches visitors and search results), and the kept public summaries are not broken by the change.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-g-ledes.mjs
import { main, readGolden, fetchHtml, flat } from './_lib.mjs';

const V = readGolden('lede-verdicts.json');
const ROUTES = ['/national-show', '/national-show/about', '/national-show/what-to-expect', '/national-show/plan-your-visit', '/national-show/faq', '/national-show/programme', '/national-show/workshops', '/national-show/symposium', '/national-show/wosa-conference', '/national-show/conferences', '/national-show/sa-exhibitors', '/national-show/international-guests', '/national-show/exhibitors', '/national-show/vendors', '/national-show/tickets', '/national-show/sponsors', '/national-show/archive'];
const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

await main('F18-A7 no builder-brief ledes in public HTML', async (r) => {
  const drops = V.pages.filter((p) => p.verdict === 'drop').map((p) => ({ key: p.pageKey, text: flat(p.summary) }));
  for (const route of ROUTES) {
    const { status, html } = await fetchHtml(route);
    if (status !== 200) { r.fail(`${route}: HTTP ${status}`); continue; }
    const body = flat(decode(html));
    for (const d of drops) if (body.includes(d.text)) r.fail(`${route}: the dropped builder brief of ${d.key} is in the public HTML: "${d.text.slice(0, 70)}..."`);
  }
});
