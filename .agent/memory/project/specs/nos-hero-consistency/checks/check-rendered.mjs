#!/usr/bin/env node
// nos-hero-consistency (Brad, 25 Nov 2026): rendered checks against a NOS server you started yourself.
// This script never builds or starts a server (sweep-safety rule 1). Point it at one:
//   NOS_BASE=http://nos.localhost:<port> node check-rendered.mjs <heights|contrast|nav>
// Exit 0 pass, 1 finding, 2 infrastructure (no NOS_BASE, unreachable server, unknown mode).
//
//   heights   every inner photo route's hero box is the same height at 1440, 1024, 768 and 390, equal to
//             the breakpoint's formula, and its copy fits inside it.
//   contrast  at 1024, 1440 and 2056 every hero text run clears WCAG AA (4.5:1, 3:1 for the large h1) against the
//             brightest pixel behind it, measured with the text hidden.
//   nav       a one-link nav group renders as a plain link to that page, in the top row and the menu panel.
import { chromium } from 'playwright';

const ROUTES = [
  '/about', '/what-to-expect', '/plan-your-visit', '/faq', '/programme', '/workshops',
  '/symposium', '/wosa-conference', '/conferences', '/plant-entry', '/vendors',
  '/vendors/apply', '/sponsors', '/contact', '/photo-credits', '/tickets/early-bird', '/tickets/vip',
];
// Outside the equal-height rule (lead rulings, 25 Nov 2026), so never listed in ROUTES:
//   /                 the hub keeps its own full-bleed hero.
//   /tickets          the tickets landing page keeps its approved fan masthead (TicketsMasthead), like the hub,
//                     days before the 1 Dec go-live.
//   typographic       a hero with no photograph (404, /tickets/recover, /archive) keeps its content-fit height:
//                     an equal-height box would be mostly an empty near-black block at 390.
//   /media-kit        follows the rule through NosHero, but is admin-gated, so this check cannot reach it.
const EXEMPT = ['/', '/tickets', '/tickets/recover', '/archive', '/media-kit'];
const WIDTHS = [1440, 1024, 768, 390];
// Below 1024 the hero text sits on the solid ground, so contrast is measured where it sits over the photo.
const CONTRAST_WIDTHS = [2056, 1440, 1024];
const DESKTOP_MIN = 1024;
const TABLET_MIN = 768;
const DESKTOP_FLOOR_PX = 420;
const DESKTOP_HEIGHT_VW = 29.3;
const TABLET_HEIGHT_PX = 320;
// Phone: the 2:1 band plus the title block (padding 32 + 32, crumbs 44, gap 16, two h1 lines).
const PHONE_BLOCK_PX = 124;
const PHONE_TITLE_FLOOR_PX = 48;
const ROOT_PX = 16;
const TOLERANCE_PX = 1;
const AA_TEXT = 4.5;
const AA_LARGE = 3;

const mode = process.argv[2];
const base = process.env.NOS_BASE;
if (!base) {
  console.error('INFRA: set NOS_BASE to a running NOS origin, e.g. http://nos.localhost:3041');
  process.exit(2);
}
if (!['heights', 'contrast', 'nav'].includes(mode)) {
  console.error(`INFRA: unknown mode '${mode}' (heights | contrast | nav)`);
  process.exit(2);
}

const failures = [];
const fail = (msg) => failures.push(msg);
for (const route of ROUTES.filter((r) => EXEMPT.includes(r))) fail(`${route} is both exempt and listed for the equal-height rule`);

function expectedHeight(width) {
  if (width >= DESKTOP_MIN) return Math.max(DESKTOP_FLOOR_PX, (DESKTOP_HEIGHT_VW / 100) * width);
  if (width >= TABLET_MIN) return TABLET_HEIGHT_PX;
  const title = Math.max(PHONE_TITLE_FLOOR_PX, 1.8 * ROOT_PX + 0.032 * width);
  return width / 2 + PHONE_BLOCK_PX + 2 * title;
}

async function open(browser, width, route) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  let res;
  try {
    res = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  } catch (error) {
    console.error(`INFRA: ${route} @${width}: ${error.constructor.name} ${error.message}`);
    process.exit(2);
  }
  await page.evaluate(() => document.fonts.ready);
  return { page, status: res?.status() ?? 0 };
}

function measureBox() {
  const hero = document.querySelector('[data-nos-hero="inner"]');
  if (!hero) return null;
  const r = hero.getBoundingClientRect();
  const head = hero.querySelector('[data-nos-hero-head]');
  const stacked = window.innerWidth < 1024;
  const box = stacked ? head.getBoundingClientRect().bottom - r.top : r.height;
  // The copy that must fit inside the box: everything below 1024 is the head; from 1024 the whole copy.
  const inner = stacked ? [...head.children] : [...hero.querySelectorAll('.nos-hero-copy *')];
  const bottom = Math.max(...inner.map((e) => e.getBoundingClientRect().bottom));
  const padBottom = stacked ? parseFloat(getComputedStyle(head).paddingBottom) : parseFloat(getComputedStyle(hero).paddingBottom);
  return { variant: hero.getAttribute('data-nos-hero-variant'), box, overflow: bottom - (r.top + box - padBottom) };
}

async function heights(browser) {
  for (const width of WIDTHS) {
    const want = expectedHeight(width);
    for (const route of ROUTES) {
      const { page, status } = await open(browser, width, route);
      const m = await page.evaluate(measureBox);
      await page.close();
      const tag = `${route} @${width}`;
      if (status !== 200) { fail(`${tag}: HTTP ${status}`); continue; }
      if (!m) { fail(`${tag}: no inner hero`); continue; }
      if (m.variant !== 'photo') { fail(`${tag}: hero variant ${m.variant}, want photo`); continue; }
      if (Math.abs(m.box - want) > TOLERANCE_PX) fail(`${tag}: hero box ${m.box.toFixed(1)}px, want ${want.toFixed(1)}px`);
      if (m.overflow > TOLERANCE_PX) fail(`${tag}: copy runs ${m.overflow.toFixed(1)}px past the box's padding`);
    }
  }
}

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function contrast(browser) {
  for (const width of CONTRAST_WIDTHS) {
    for (const route of ROUTES) {
      const { page, status } = await open(browser, width, route);
      if (status !== 200) { fail(`${route} @${width}: HTTP ${status}`); await page.close(); continue; }
      const runs = await page.evaluate(() => {
        const hero = document.querySelector('[data-nos-hero="inner"]');
        const sel = '.nk-crumbs a, .nk-crumbs [aria-current], h1, .nos-hero-lede, .hero-facts dt, .hero-facts dd';
        return [...hero.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return {
            tag: e.tagName.toLowerCase(), color: cs.color, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight),
            x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height,
          };
        });
      });
      // Hide the text (and the link underlines) so the screenshot is the ground behind it.
      await page.addStyleTag({ content: '[data-nos-hero] * { color: transparent !important; text-decoration-color: transparent !important; }' });
      for (const run of runs) {
        const png = await page.screenshot({ clip: { x: run.x, y: run.y, width: Math.max(1, run.w), height: Math.max(1, run.h) }, fullPage: true });
        const brightest = await page.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let best = [0, 0, 0];
          let bestSum = -1;
          for (let i = 0; i < d.length; i += 4) {
            const s = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            if (s > bestSum) { bestSum = s; best = [d[i], d[i + 1], d[i + 2]]; }
          }
          return best;
        }, png.toString('base64'));
        const fg = run.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
        const cr = ratio(luminance(fg), luminance(brightest));
        const large = run.size >= 24 || (run.size >= 18.66 && run.weight >= 700);
        const floor = large ? AA_LARGE : AA_TEXT;
        console.log(`${route} @${width} ${run.tag} ${cr.toFixed(2)}:1 (floor ${floor})`);
        if (cr < floor) fail(`${route} @${width}: ${run.tag} ${cr.toFixed(2)}:1 over rgb(${brightest}), want ${floor}:1`);
      }
      await page.close();
    }
  }
}

async function nav(browser) {
  // Desktop top row (from 1384 the full nav shows) and the menu panel below it.
  const { page } = await open(browser, 1440, '/');
  const top = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('#nh .nh-item')].map((li) => ({
      trigger: li.querySelector('[data-group-trigger]')?.textContent?.trim(),
      links: li.querySelectorAll('.nh-panel a').length,
    }));
    const vendors = [...document.querySelectorAll('#nh .nh-nav a')].find((a) => a.textContent.trim() === 'Vendors');
    return { groups, vendorsHref: vendors?.getAttribute('href') ?? null };
  });
  await page.close();
  for (const g of top.groups) if (g.links < 2) fail(`top row: "${g.trigger}" is a disclosure with ${g.links} link(s)`);
  if (top.vendorsHref !== '/vendors') fail(`top row: Vendors is not a plain link to /vendors (href ${top.vendorsHref})`);

  const phone = await open(browser, 390, '/vendors/apply');
  await phone.page.click('#nh-burger');
  const drawer = await phone.page.evaluate(() => {
    const items = [...document.querySelectorAll('#nd .nd-list > li')].map((li) => {
      const button = li.querySelector('button.nd-item');
      return { button: button?.textContent?.trim() ?? null, links: li.querySelectorAll('.nd-sub a').length };
    });
    const vendors = [...document.querySelectorAll('#nd a.nd-item')].find((a) => a.textContent.trim() === 'Vendors');
    return { items, href: vendors?.getAttribute('href') ?? null, current: vendors?.getAttribute('aria-current') ?? null };
  });
  await phone.page.close();
  for (const i of drawer.items) if (i.button && i.links < 2) fail(`menu panel: "${i.button}" is a disclosure with ${i.links} link(s)`);
  if (drawer.href !== '/vendors') fail(`menu panel: Vendors is not a plain link to /vendors (href ${drawer.href})`);
  if (drawer.current !== 'page') fail(`menu panel: Vendors on /vendors/apply has aria-current ${drawer.current}, want page`);

  // R27: the Vendors pages carry no group sub-nav (one-link group), the Programme pages still do.
  for (const [route, want] of [['/vendors/apply', 0], ['/symposium', 1]]) {
    const { page: p } = await open(browser, 1440, route);
    const count = await p.evaluate(() => document.querySelectorAll('.nos-subnav').length);
    await p.close();
    if (count !== want) fail(`${route}: ${count} group sub-nav(s), want ${want}`);
  }
}

const browser = await chromium.launch();
try {
  await { heights, contrast, nav }[mode](browser);
} finally {
  await browser.close();
}
if (failures.length) {
  console.log(`FAIL (${mode})`);
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
console.log(`nos-hero-consistency ${mode} pass`);
