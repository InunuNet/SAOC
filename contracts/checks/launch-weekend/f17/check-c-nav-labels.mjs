#!/usr/bin/env node
// F17-A3 (R74-3, R74-6, B1): nav-config labels are sentence case with the same words, the Symposium label drops "SAOC", and the Show sponsors
// descriptor is "The sponsors behind the National Show." in the mega and the mobile menu.
//  STATIC  components/chrome/nav-config.ts equals goldens/f17/nav-labels.json (ids, hrefs, labels, descriptors, top level, lead, rail); the manifest row,
//          its generator and the sponsors page fallback carry the new sentence (so descriptor = trimmed prefix of purpose still holds).
//  RUNTIME /national-show: the desktop mega (.nh-mega-head groups) and the mobile drawer (#nd .nd-group, opened by a real click at 390) render exactly those
//          labels and descriptors; the inner-page sub-nav on /national-show/sponsors, /programme and /sa-exhibitors uses them (labels verbatim from nav-config).
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/check-c-nav-labels.mjs
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser, LABELS, VP, norm } from './_lib.mjs';
import { NAV } from '../../../../components/chrome/nav-config.ts';

const mega = NAV.find((n) => n.type === 'mega');

await main('F17-A3 nav labels', async (r) => {
  // ---- static
  const top = NAV.map((n) => ({ id: n.id, label: n.label, href: n.href, type: n.type }));
  if (JSON.stringify(top) !== JSON.stringify(LABELS.topLevel)) r.fail(`top-level nav items changed: ${JSON.stringify(top)}`);
  if (mega.lead.eyebrow !== LABELS.lead.eyebrow || mega.lead.leadLabel !== LABELS.lead.leadLabel || mega.lead.leadHref !== LABELS.lead.leadHref) r.fail(`the mega lead block changed (the "19th National Orchid Show" title is kept by ruling): ${JSON.stringify(mega.lead)}`);
  const groups = [mega.lead.theShow, ...mega.columns];
  if (groups.length !== LABELS.groups.length) r.fail(`${groups.length} groups, want ${LABELS.groups.length}`);
  LABELS.groups.forEach((g, i) => {
    const got = groups[i];
    if (!got) return;
    if (got.id !== g.id || got.heading !== g.heading) r.fail(`group ${g.id}: heading "${got.heading}", want "${g.heading}"`);
    if (got.links.length !== g.links.length) r.fail(`group ${g.id}: ${got.links.length} links, want ${g.links.length}`);
    g.links.forEach((l, j) => {
      const x = got.links[j];
      if (!x) return;
      if (x.id !== l.id || x.href !== l.href) r.fail(`${g.id}/${l.id}: id or href changed (${x.id} ${x.href})`);
      if (x.label !== l.label) r.fail(`${l.id}: label "${x.label}", want "${l.label}"`);
      if (x.descriptor !== l.descriptor) r.fail(`${l.id}: descriptor "${x.descriptor}", want "${l.descriptor}"`);
    });
  });
  const rail = mega.featureRail;
  if (rail.heading !== LABELS.featureRail.heading || JSON.stringify(rail.destinations.map((d) => ({ id: d.id, label: d.label, href: d.href }))) !== JSON.stringify(LABELS.featureRail.destinations)) r.fail('the Tickets feature rail changed (its destinations are ticket product names and stay as they are)');
  // sponsors sentence in the three places that must agree
  const S = LABELS.sponsorsDescriptor;
  const manifest = JSON.parse(readFileSync('content/national-show-routes.json', 'utf8'));
  const row = (manifest.routes ?? manifest).find?.((x) => x.slug === S.manifestRow);
  if (!row || row.purpose !== S.text) r.fail(`content/national-show-routes.json ${S.manifestRow} purpose is "${row?.purpose}", want "${S.text}"`);
  if (!readFileSync('scripts/generate-nos-route-manifest.ts', 'utf8').includes(`purpose: "${S.text}"`) && !readFileSync('scripts/generate-nos-route-manifest.ts', 'utf8').includes(`purpose: '${S.text}'`)) r.fail(`scripts/generate-nos-route-manifest.ts does not carry the new sponsors purpose`);
  if (!readFileSync('app/(marketing)/national-show/sponsors/page.tsx', 'utf8').includes(S.text)) r.fail('the sponsors page fallback purpose does not carry the new sentence');
  for (const [file, text] of [['content/national-show-routes.json', S.before], ['scripts/generate-nos-route-manifest.ts', S.before], ['app/(marketing)/national-show/sponsors/page.tsx', S.before], ['components/chrome/nav-config.ts', S.before]]) {
    if (readFileSync(file, 'utf8').includes(text)) r.fail(`${file} still carries the old sponsors sentence`);
  }

  // ---- runtime
  const read = () => {
    const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const leafOf = (a) => { const kids = [...a.children]; return { label: t(kids[0]), descriptor: kids.slice(1).map(t).join(' ').trim() }; };
    const heads = (root, sel) => [...root.querySelectorAll(sel)].map((h) => ({ heading: t(h), links: [...(h.nextElementSibling?.querySelectorAll('a') ?? [])].map(leafOf) }));
    const desk = heads(document, 'h3.nh-mega-head');
    const nd = document.querySelector('#nd');
    const mob = nd ? heads(nd, '.nd-group h3') : [];
    return { desk, mob };
  };
  const want = LABELS.groups.map((g) => ({ heading: g.heading, links: g.links.map((l) => ({ label: l.label, descriptor: l.descriptor })) }));
  await withBrowser(async (browser) => {
    const { ctx, page, status } = await openPage(browser, VP.desktop, '/national-show');
    if (status !== 200) { r.fail(`/national-show: HTTP ${status}`); await ctx.close(); return; }
    const m = await page.evaluate(read);
    if (JSON.stringify(m.desk) !== JSON.stringify(want)) r.fail(`desktop mega renders ${JSON.stringify(m.desk).slice(0, 400)}`);
    if (JSON.stringify(m.mob.slice(0, want.length)) !== JSON.stringify(want)) r.fail(`mobile drawer renders ${JSON.stringify(m.mob).slice(0, 400)}`);
    if (m.mob[want.length]?.heading !== LABELS.featureRail.heading) r.fail(`mobile drawer rail heading is "${m.mob[want.length]?.heading}", want "${LABELS.featureRail.heading}"`);
    await page.setViewportSize(VP.phone);
    await page.waitForTimeout(150);
    const trigger = page.locator('button[aria-controls="nd"]').first();
    if (!(await trigger.count())) r.fail('no mobile menu button[aria-controls="nd"] at 390');
    else {
      await trigger.click();
      await page.waitForTimeout(350);
      const visible = await page.evaluate(() => {
        const nd = document.querySelector('#nd');
        const shown = nd && !nd.hasAttribute('hidden') && getComputedStyle(nd).display !== 'none';
        const row = [...(nd?.querySelectorAll('a') ?? [])].find((a) => /^Show sponsors/.test((a.textContent ?? '').trim()));
        return { shown, text: (row?.textContent ?? '').replace(/\s+/g, ' ').trim() };
      });
      if (!visible.shown) r.fail('the mobile drawer did not open on a real click at 390');
      if (visible.text !== `Show sponsors${LABELS.sponsorsDescriptor.text}`) r.fail(`mobile drawer "Show sponsors" row reads "${visible.text}", want "Show sponsors${LABELS.sponsorsDescriptor.text}"`);
    }
    await ctx.close();

    for (const [route, group] of [['/national-show/sponsors', 'the-show'], ['/national-show/programme', 'programme'], ['/national-show/sa-exhibitors', 'exhibit-trade']]) {
      const g = LABELS.groups.find((x) => x.id === group);
      const { ctx: c2, page: p2, status: s2 } = await openPage(browser, VP.desktop, route);
      if (s2 !== 200) { r.fail(`${route}: HTTP ${s2}`); await c2.close(); continue; }
      const sub = await p2.evaluate(() => { const n = [...document.querySelectorAll('nav')].find((x) => / pages$/.test(x.getAttribute('aria-label') ?? '') && !x.closest('#nh, #nd, #nf')); return n ? { label: n.getAttribute('aria-label'), links: [...n.querySelectorAll('a')].map((a) => (a.textContent ?? '').replace(/\s+/g, ' ').trim()) } : null; });
      if (!sub) r.fail(`${route}: no "<group> pages" sub-nav`);
      else {
        if (sub.label !== `${g.heading} pages`) r.fail(`${route}: sub-nav aria-label "${sub.label}", want "${g.heading} pages"`);
        if (JSON.stringify(sub.links.map(norm)) !== JSON.stringify(g.links.map((l) => l.label))) r.fail(`${route}: sub-nav links ${JSON.stringify(sub.links)}, want ${JSON.stringify(g.links.map((l) => l.label))}`);
      }
      await c2.close();
    }
  });
});
