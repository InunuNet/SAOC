// A8: every route with a frozen Drive source renders it word for word (whitespace normalised only), per the route's mode:
//   full         every block of her document, in order (through `until` when set)
//   range        every block from `from` to `until` inclusive, in order; `edits` applied to the expected text (e.g. her "(Needs Surnames)")
//   listed       each `mustPresent` string is rendered (and each is proven to be in her document, so the list cannot drift from her words)
//   full+listed  full through `until`, then the `mustPresent` strings
// Struck text (~~x~~ in her document) is deleted copy: it is dropped from the expected blocks and, where strikeAbsence is "all", must be ABSENT
// from the page (spans in strikeAbsenceExempt are Sanity-held and excluded, per the lead's no-Sanity-write limit). mustAbsentSelectors must match nothing.
// A missing, edited-after-freeze (sha256), empty or [ERROR] source FAILS. A route with no source prints GAP; privacy/terms print verified-by-SAOC.
import { ROUTES, STD, driveState, launchChromium, newContext, normalise, withServer } from './_lib.mjs';

const unmd = (block) => normalise(block
  .replace(/\\([.\-_*#>()[\]!])/g, '$1').replace(/^\s{0,3}#{1,6}\s+/gm, '').replace(/^\s*[-*]\s+/gm, '')
  .replace(/\*\*|__/g, '').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));

function blocksOf(text, plainLists) {
  const unstruck = text.replace(/~~[\s\S]*?~~/g, '');
  const out = [];
  for (const raw of unstruck.split(/\n\s*\n/)) {
    const lines = raw.split('\n');
    if (lines.every((l) => l.trim().startsWith('|') || l.trim() === '')) {
      for (const l of lines) {
        if (!l.trim() || /^\|\s*-+/.test(l.trim())) continue;
        for (const cell of l.split('|').map((x) => unmd(x)).filter(Boolean)) out.push(cell);
      }
      continue;
    }
    if (plainLists && lines.length > 1 && lines.every((l) => /^\s*[-*]\s+/.test(l))) { for (const l of lines) out.push(unmd(l)); continue; }
    const b = unmd(raw);
    if (b) out.push(b);
  }
  return out;
}

await withServer(2, 'verbatim', async (server, c) => {
  const listed = ROUTES.map((r) => `${r.nos}=${driveState(r).state}`);
  c.note(`sources: ${listed.join(' ')}`);
  const browser = await launchChromium();
  try {
    for (const route of ROUTES) {
      const st = driveState(route);
      if (st.state === 'gap' || st.state === 'verified-by-saoc') continue;
      const d = route.drive; const tag = `[${route.nos} ${d.version}]`;
      c.check(`${tag} frozen Drive source is intact (${st.state}: ${d.path})`, st.state === 'ok');
      if (st.state !== 'ok') continue;

      let blocks = blocksOf(st.text, d.asPlainLists);
      const edit = (b) => (d.edits ?? []).reduce((acc, e) => acc.split(e.find).join(e.replace), b);
      const at = (needle) => blocks.findIndex((b) => b.includes(unmd(needle)));
      if (d.from) { const i = at(d.from); c.check(`${tag} range start "${d.from}" exists in her document`, i >= 0); if (i >= 0) blocks = blocks.slice(i); }
      if (d.until) { const i = at(d.until); c.check(`${tag} range end "${d.until}" exists in her document`, i >= 0); if (i >= 0) blocks = blocks.slice(0, i + 1); }
      blocks = blocks.filter((b) => !(d.dropBlocks ?? []).some((x) => b.includes(unmd(x))));
      const expected = d.mode === 'listed' ? [] : blocks.map(edit);
      for (const m of d.mustPresent ?? []) c.check(`${tag} mustPresent is a real passage of her document: "${m.slice(0, 50)}"`, blocksOf(st.text, false).some((b) => b.includes(unmd(m))));

      const context = await newContext(browser, STD.firstScreen[0]); const page = await context.newPage();
      await page.goto(`${server.nos}${route.nos}`, { waitUntil: 'load' });
      let body = normalise(await page.evaluate(() => `${document.querySelector('section[data-nos-hero]')?.textContent ?? ''} ${document.querySelector('main')?.textContent ?? ''}`));
      if (d.numberSpans) body = body.replace(/(\d+\.)(?=[A-Za-z])/g, '$1 ');
      const bodyLc = body.toLowerCase(); let cursor = 0; let missing = 0;
      for (const [i, b] of expected.entries()) {
        const ci = i === 0 && route.headings?.h1CaseInsensitive; // the h1 text only follows the route table's sentence-case title
        const found = ci ? bodyLc.indexOf(b.toLowerCase(), cursor) : body.indexOf(b, cursor);
        if (found === -1) { missing += 1; if (missing <= 5) c.check(`${tag} block ${i + 1} is rendered verbatim and in order: "${b.slice(0, 70)}"`, false, (ci ? bodyLc.includes(b.toLowerCase()) : body.includes(b)) ? 'present but out of order' : 'absent or altered'); } else cursor = found + b.length;
      }
      if (expected.length) c.check(`${tag} all ${expected.length} blocks rendered verbatim in order (${missing} missing)`, missing === 0);
      for (const m of d.mustAbsentText ?? []) c.check(`${tag} deleted or pending copy is not rendered: "${m}"`, !body.toLowerCase().includes(m.toLowerCase()));
      for (const m of d.mustPresent ?? []) c.check(`${tag} renders: "${m.slice(0, 60)}"`, body.includes(unmd(m)));

      if (d.strikeAbsence === 'all') {
        const spans = [...st.text.matchAll(/~~([\s\S]*?)~~/g)].map((m) => unmd(m[1])).filter((s) => s.length >= 12 && !(d.strikeAbsenceExempt ?? []).some((x) => s.includes(x)));
        for (const s of spans) c.check(`${tag} struck (deleted) text is not rendered: "${s.slice(0, 60)}"`, !body.includes(s));
        c.note(`${tag} ${spans.length} struck span(s) asserted absent, ${(d.strikeAbsenceExempt ?? []).length} exempt (Sanity-held)`);
      } else c.note(`${tag} struck text not asserted absent (${d.strikeNote ?? 'Sanity-held; listed under Sanity edits in research.md'})`);
      if (route.headings) {
        const hd = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent ?? '', h2: [...document.querySelectorAll('main h2')].map((e) => e.textContent), h3: [...document.querySelectorAll('main h3')].map((e) => e.textContent), h4: [...document.querySelectorAll('main h4')].map((e) => e.textContent), loneStrong: [...document.querySelectorAll('main p')].filter((x) => x.children.length === 1 && /^(STRONG|B)$/.test(x.firstElementChild.tagName) && x.textContent.trim() === x.firstElementChild.textContent.trim()).length }));
        const H = route.headings; const n = (t) => normalise(t).replace(/^(\d+\.)\s*(?=\S)/, '$1 ');
        c.check(`${tag} h1 reads "${H.h1}"`, H.h1CaseInsensitive ? n(hd.h1).toLowerCase() === n(H.h1).toLowerCase() : n(hd.h1) === n(H.h1));
        if (H.h2) c.check(`${tag} the h2s are her numbered headings, in order (${H.h2.length})`, JSON.stringify(hd.h2.map(n)) === JSON.stringify(H.h2.map(n)), hd.h2.map(n).join(' | '));
        if (H.h3) c.check(`${tag} her bold sub-lines are h3 (${H.h3.length}), in order`, JSON.stringify(hd.h3.map(n)) === JSON.stringify(H.h3.map(n)), hd.h3.map(n).join(' | '));
        if (H.h4) c.check(`${tag} her list items are h4 (${H.h4.length}), in order`, JSON.stringify(hd.h4.map(n)) === JSON.stringify(H.h4.map(n)), hd.h4.map(n).join(' | '));
        c.check(`${tag} zero <p> whose sole child is <strong>`, hd.loneStrong === 0, String(hd.loneStrong));
        const lede = await page.evaluate(() => document.querySelector('[data-nos-hero-lede]')?.textContent ?? '');
        if (H.noLede) c.check(`${tag} the hero has no lede (crumb + h1 + facts)`, n(lede) === '');
        else if (H.lede) c.check(`${tag} hero lede is her line 3 verbatim`, n(lede).includes(n(H.lede)));
        const sf = await page.evaluate(() => document.querySelector('[data-doc-main]')?.textContent ?? '');
        if (H.standfirst) c.check(`${tag} body standfirst is her line 5 verbatim`, n(sf).startsWith(n(H.standfirst)) || n(sf).includes(n(H.standfirst)));
      }
      const nav = normalise(await page.evaluate(() => document.querySelector('header, .nh')?.textContent ?? ''));
      for (const m of d.mustPresentNav ?? []) c.check(`${tag} the nav carries her label "${m}" (nos-nav.ts and every reuse)`, nav.includes(m));
      for (const m of d.mustAbsentNav ?? []) c.check(`${tag} the nav no longer carries the struck label "${m}"`, !nav.includes(m));
      for (const sel of d.mustAbsentSelectors ?? []) c.check(`${tag} nothing matches ${sel}`, (await page.locator(sel).count()) === 0);
      await context.close();
    }
  } finally { await browser.close(); }
}, { preview: true });
