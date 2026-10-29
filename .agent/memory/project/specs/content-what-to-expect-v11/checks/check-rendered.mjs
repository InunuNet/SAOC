// Rendered gate for content-what-to-expect-v11: run from the repo root after checks/build.sh. Serves the production build on the
// nos-content-standard gate port (offset 1, the port the build bakes in), loads the home, What to expect and Programme pages in
// Chromium and asserts every golden string is rendered verbatim and no old string remains.
import { readFileSync } from 'node:fs';

// Live Sanity (see build.sh): the shared helpers read this at import time, so set it before the dynamic import.
process.env.NOS_STD_FIXTURE = 'live';
const { startServer, waitReady, collector, launchChromium, newContext, gotoRoute, normalise } = await import('../../nos-content-standard/checks/_lib.mjs');

// _lib's withServer ends with the fixture proof, which fails by design in live mode; this gate runs the same server lifecycle without it.
async function withServer(offset, label, body) {
  const c = collector(label);
  const server = startServer(offset);
  server.proc.on('exit', (code, signal) => { if (!c.done) { console.error(`next start exited early (code ${code}, signal ${signal})`); process.exit(1); } });
  try { await waitReady(server); await body(server, c); } catch (e) { c.fail(e); console.error(e); }
  c.finish(server);
}

const G = JSON.parse(readFileSync('.agent/memory/project/specs/content-what-to-expect-v11/goldens/strings.json', 'utf8'));
const VIEWPORT = { width: 1280, height: 900, dsf: 1 };
const clean = (t) => normalise(t).replace(/[ ]/g, ' ');
const rowsOf = (page, selector) => page.$$eval(selector, (divs) => divs.map((d) => [...d.children].map((e) => e.textContent ?? '')));

await withServer(1, 'content-what-to-expect-v11', async (server, c) => {
  const browser = await launchChromium();
  try {
    const bodies = {};
    const open = async (key, route) => {
      const ctx = await newContext(browser, VIEWPORT); const page = await ctx.newPage();
      const tag = `[${key} ${route}]`;
      const res = await gotoRoute(page, server, route, c, tag);
      c.check(`${tag} loads`, Boolean(res) && res.status() < 400, res ? String(res.status()) : 'no response');
      bodies[key] = clean(await page.evaluate(() => document.querySelector('main')?.textContent ?? ''));
      return { page, tag };
    };
    const hoursRows = async (page, tag, selector, expected) => {
      const got = (await rowsOf(page, selector)).map((row) => row.map(clean));
      c.check(`${tag} no empty element in an opening-hours row (no empty dd, no dt-only row)`, got.every((row) => row.every((t) => t !== '')), JSON.stringify(got));
      const actual = got.map((row) => row.filter((t) => t !== ''));
      c.check(`${tag} opening-hours rows are exactly hers, in order`, JSON.stringify(actual) === JSON.stringify(expected.map((r) => r.parts)), JSON.stringify(actual));
      const words = G.wte.hours_rows.map((r) => r.line.replace(' – ', ' '));
      c.check(`${tag} each hours row reads exactly her words in order (label + value, separator hidden): Sunset reads "Sunset Cocktails 18.30 to 21.00"`, JSON.stringify(actual.map((row) => row.join(' '))) === JSON.stringify(words), JSON.stringify(actual.map((row) => row.join(' '))));
    };

    // What to expect
    {
      const { page, tag } = await open('wte', G.wte.route);
      for (const p of G.wte.paragraphs) c.check(`${tag} renders ${p.id} verbatim`, bodies.wte.includes(clean(p.text)));
      await hoursRows(page, tag, G.wte.hours_container, G.wte.hours_rows);
      const names = (await page.$$eval('dl[data-we-admission] > div > dt', (els) => els.map((e) => e.textContent ?? ''))).map(clean);
      const order = G.wte.admission_names_in_order;
      c.check(`${tag} admission names are hers and in her order`, names.every((n) => order.includes(n)) && JSON.stringify(names) === JSON.stringify(order.filter((n) => names.includes(n))), JSON.stringify(names));
      c.check(`${tag} admission list renders "Day Pass Ticket" (the Sanity day-visitor ticket is on sale and priced)`, names.includes('Day Pass Ticket'), JSON.stringify(names));
      c.check(`${tag} the Day Pass row is keyed to ${G.wte.day_pass_row.id}`, (await page.$$eval('dl[data-we-admission] > div', (els) => els.map((e) => e.getAttribute('data-ticket-id')))).includes(G.wte.day_pass_row.id));
      c.check(`${tag} the cloakroom section is absent as a heading`, !(await page.$$eval('h2,h3,h4', (els) => els.some((e) => /cloakroom/i.test(e.textContent ?? '')))));
    }
    // Home
    {
      const { page, tag } = await open('home', G.home.route);
      for (const p of G.home.paragraphs) c.check(`${tag} renders ${p.id} verbatim`, bodies.home.includes(clean(p.text)));
      await hoursRows(page, tag, G.home.hours_container, G.home.hours_rows);
    }
    // Programme
    {
      const { page, tag } = await open('programme', G.programme.route);
      const days = await page.$$eval('ol[data-programme-board] > li', (lis) => lis.map((li) => ({ wd: li.querySelector('.wd')?.textContent ?? '', hours: [...li.querySelectorAll('.nos-pg-hours .v')].map((v) => v.textContent ?? '') })));
      const byDay = Object.fromEntries(days.map((d) => [clean(d.wd), d.hours.map(clean)]));
      c.check(`${tag} Thursday hours spans are hers, in order`, JSON.stringify(byDay.Thursday) === JSON.stringify(G.programme.thursday_hours_spans_in_order.map((s) => s.text)), JSON.stringify(byDay.Thursday));
      for (const [day, hours] of Object.entries(G.programme.other_days_hours)) c.check(`${tag} ${day} hours are "${hours}"`, JSON.stringify(byDay[day]) === JSON.stringify([hours]), JSON.stringify(byDay[day]));
    }
    // Old strings gone from all three rendered pages
    for (const [key, body] of Object.entries(bodies)) for (const a of G.absent_everywhere) c.check(`[${key}] old/removed string not rendered: "${a}"`, !body.toLowerCase().includes(a.toLowerCase()));
  } finally { await browser.close(); }
});
