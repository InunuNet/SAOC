// A5: zero U+2190 (and its escaped spellings) in the rendered HTML of NOS-host pages, each fetched on the NOS host with a 200 and a marker proving the real page rendered.
import { AUTH, V, withServer } from './_lib.mjs';

const MARKERS = { '/archive/2024': 'data-nos-backlink', '/archive/2023': 'data-nos-backlink' };

await withServer('gate-html', async (server, c) => {
  for (const route of V.htmlPages) {
    const res = await fetch(`${server.nos}${route}`, { headers: { authorization: AUTH } });
    const html = await res.text();
    c.check(`${route} responds 200 on the NOS host (got ${res.status})`, res.status === 200);
    if (MARKERS[route]) c.check(`${route} rendered the archive year page (marker ${MARKERS[route]})`, html.includes(MARKERS[route]));
    for (const g of V.forbiddenGlyphs) {
      const count = html.toLowerCase().split(g.toLowerCase()).length - 1;
      c.check(`${route} has no ${JSON.stringify(g)}`, count === 0, `${count} occurrence(s)`);
    }
  }
});
