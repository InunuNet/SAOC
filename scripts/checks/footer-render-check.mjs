// Mission nos-site-split — footer render gate (NOS Design footer-serif-ruling FT1-FT8).
// Starts `next start` (needs a prior `pnpm build`) on a fixed local port with sandbox-only env, then drives
// Chromium against the SAOC and NOS footers. Read-only: GET only; the admin pill's whoami call is stubbed
// in the browser, nothing is sent to the server.
//   FT1  at 1280 and 1440 the three gaps between the four columns are equal within 1px
//   FT2/3 each column's heading and first link share its left x; headings share a top line; the first
//        item sits 16px under the heading; list rows are a 44px pitch
//   FT4  WOSA appears once per footer (one link, one mention)
//   FT6  the SAOC tagline is 11px
//   FT7  the admin pill's box never intersects the bottom bar, at the page end and part-way
// Screenshots go to ../split-shots (relative to the worktree), footer-NAME.png. Exit 1 on any failed assertion.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 3218;
const SAOC_HOST = `saoc.localhost:${PORT}`;
const NOS_HOST = `nos.localhost:${PORT}`;
const CREDENTIALS = { username: 's', password: 'p' };
const SHOT_DIR = '../split-shots';
const LOG_DIR = '.tmp/sandbox/nos-split';
const WIDE_VIEWPORTS = [1280, 1440];
const SHOT_VIEWPORTS = [[390, 844], [1280, 800], [1440, 900]];
const GAP_TOLERANCE = 1;
const ROW_PITCH = 44;
const HEADING_TO_FIRST_ITEM = 16;
const ITEM_TOLERANCE = 2;
const TAGLINE_PX = 11;
const SITES = [
  ['saoc', SAOC_HOST, 'footer', '[data-footer-bar]'],
  ['nos', NOS_HOST, '#nf', '[data-footer-bar]'],
];

mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });
const log = openSync(`${LOG_DIR}/footer-check-start.log`, 'w');
const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], {
  stdio: ['ignore', log, log],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    BETA_BASIC_AUTH_USER: CREDENTIALS.username,
    BETA_BASIC_AUTH_PASSWORD: CREDENTIALS.password,
    SITE_PUBLIC_LAUNCH: '',
    NEXT_PUBLIC_SAOC_SITE_URL: `http://${SAOC_HOST}`,
    NEXT_PUBLIC_NOS_SITE_URL: `http://${NOS_HOST}`,
    SITE_URL: `http://${SAOC_HOST}`,
  },
});

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function waitUp() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`, { headers: { Host: SAOC_HOST, Authorization: `Basic ${Buffer.from('s:p').toString('base64')}` } });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`next start did not come up; see ${LOG_DIR}/footer-check-start.log`);
}

async function open(browser, host, [width, height], { admin = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, httpCredentials: CREDENTIALS });
  const page = await context.newPage();
  if (admin) await page.route('**/api/admin/whoami', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto(`http://${host}/`, { waitUntil: 'networkidle' });
  return { context, page };
}

/** Geometry of every footer column: box, heading, first link or field, first item top. */
function measureColumns(root) {
  const footer = document.querySelector(root);
  const grid = footer.firstElementChild;
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  };
  return [...grid.children].map((col) => {
    const heading = col.querySelector('.nf-head, div.font-mono');
    const first = col.querySelector('a, input');
    const rows = [...col.querySelectorAll('ul > li')].map((li) => li.getBoundingClientRect().top);
    return {
      box: rect(col),
      heading: heading ? rect(heading) : null,
      first: first ? rect(first) : null,
      block: col.querySelector('p') ? rect(col.querySelector('p')) : null,
      rows,
    };
  });
}

async function checkColumns(browser) {
  for (const width of WIDE_VIEWPORTS) {
    for (const [site, host, root] of SITES) {
      const { context, page } = await open(browser, host, [width, 900]);
      const cols = await page.evaluate(measureColumns, root);
      const tag = `${site} ${width}`;
      check(`FT1 ${tag}: four columns`, cols.length === 4, `found ${cols.length}`);
      const gaps = [1, 2, 3].map((i) => cols[i].box.left - cols[i - 1].box.right);
      check(`FT1 ${tag}: gaps equal within ${GAP_TOLERANCE}px`, Math.max(...gaps) - Math.min(...gaps) <= GAP_TOLERANCE, gaps.map((g) => g.toFixed(1)).join(' / '));
      cols.slice(1).forEach((col, i) => {
        if (col.heading) check(`FT2 ${tag}: column ${i + 2} heading left == column left`, Math.abs(col.heading.left - col.box.left) <= GAP_TOLERANCE, `${col.heading.left.toFixed(1)} vs ${col.box.left.toFixed(1)}`);
        if (col.first) check(`FT2 ${tag}: column ${i + 2} first link left == column left`, Math.abs(col.first.left - col.box.left) <= GAP_TOLERANCE, `${col.first.left.toFixed(1)} vs ${col.box.left.toFixed(1)}`);
        if (col.heading && col.rows[0] !== undefined) {
          const drop = col.rows[0] - col.heading.bottom;
          check(`FT3 ${tag}: column ${i + 2} first row ${HEADING_TO_FIRST_ITEM}px under heading`, Math.abs(drop - HEADING_TO_FIRST_ITEM) <= ITEM_TOLERANCE, `${drop.toFixed(1)}px`);
        }
        const pitches = col.rows.slice(1).map((top, k) => top - col.rows[k]);
        if (pitches.length) check(`FT3 ${tag}: column ${i + 2} row pitch ${ROW_PITCH}px`, pitches.every((p) => Math.abs(p - ROW_PITCH) <= GAP_TOLERANCE), pitches.map((p) => p.toFixed(1)).join(','));
      });
      const touch = cols[3];
      if (touch.heading && touch.block) {
        const drop = touch.block.top - touch.heading.bottom;
        check(`FT3 ${tag}: blurb ${HEADING_TO_FIRST_ITEM}px under its heading`, Math.abs(drop - HEADING_TO_FIRST_ITEM) <= ITEM_TOLERANCE, `${drop.toFixed(1)}px`);
      }
      const headingTops = cols.slice(1).filter((c) => c.heading).map((c) => c.heading.top);
      if (headingTops.length > 1) check(`FT3 ${tag}: headings share a top line`, Math.max(...headingTops) - Math.min(...headingTops) <= GAP_TOLERANCE, headingTops.map((t) => t.toFixed(1)).join(','));
      await context.close();
    }
  }
}

async function checkWosaAndTagline(browser) {
  for (const [site, host, root] of SITES) {
    const { context, page } = await open(browser, host, [1440, 900]);
    const wosa = await page.evaluate((selector) => {
      const footer = document.querySelector(selector);
      return {
        links: footer.querySelectorAll('a[href*="wildorchids.co.za"]').length,
        mentions: (footer.textContent.match(/Wild Orchids/g) ?? []).length,
        heading: /Looking for wild orchids/i.test(footer.textContent),
      };
    }, root);
    check(`FT4 ${site}: one WOSA link`, wosa.links === 1, `links=${wosa.links}`);
    check(`FT4 ${site}: one WOSA mention, no second block`, wosa.mentions === 1 && !wosa.heading, `mentions=${wosa.mentions}`);
    if (site === 'saoc') {
      const size = await page.evaluate((selector) => {
        const tag = [...document.querySelector(selector).querySelectorAll('span')].find((el) => /MAKING A DIFFERENCE/i.test(el.textContent) && el.children.length === 0);
        return tag ? parseFloat(getComputedStyle(tag).fontSize) : null;
      }, root);
      check(`FT6 ${site}: tagline ${TAGLINE_PX}px`, size === TAGLINE_PX, `${size}px`);
    }
    await context.close();
  }
}

const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

async function checkAdminPill(browser) {
  for (const [site, host, , barSelector] of SITES) {
    for (const [width, height] of SHOT_VIEWPORTS) {
      const { context, page } = await open(browser, host, [width, height], { admin: true });
      const pill = page.locator('div.fixed.right-4.z-40');
      await pill.waitFor({ state: 'attached' });
      const bar = page.locator(barSelector);
      for (const [label, at] of [['page end', 1], ['half bar', 0.5]]) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        if (at < 1) {
          const barHeight = await bar.evaluate((el) => el.getBoundingClientRect().height);
          await page.evaluate((px) => window.scrollBy(0, -px), barHeight * (1 - at));
        }
        await page.waitForTimeout(250);
        const [visiblePill, barBox] = await Promise.all([pill.boundingBox(), bar.boundingBox()]);
        const a = { left: visiblePill.x, right: visiblePill.x + visiblePill.width, top: visiblePill.y, bottom: visiblePill.y + visiblePill.height };
        const b = { left: barBox.x, right: barBox.x + barBox.width, top: barBox.y, bottom: barBox.y + barBox.height };
        check(`FT7 ${site} ${width}: pill clear of the bottom bar (${label})`, !intersects(a, b), `pill y=${Math.round(a.top)}-${Math.round(a.bottom)} bar y=${Math.round(b.top)}-${Math.round(b.bottom)}`);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${SHOT_DIR}/footer-${site}-pill-${width}.png` });
      await context.close();
    }
  }
}

async function shoot(browser) {
  for (const [site, host, root] of SITES) {
    for (const viewport of SHOT_VIEWPORTS) {
      const { context, page } = await open(browser, host, viewport);
      const footer = page.locator(root);
      await footer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await footer.screenshot({ path: `${SHOT_DIR}/footer-${site}-${viewport[0]}.png` });
      await context.close();
    }
  }
}

try {
  await waitUp();
  const browser = await chromium.launch();
  await checkColumns(browser);
  await checkWosaAndTagline(browser);
  await checkAdminPill(browser);
  await shoot(browser);
  await browser.close();
} finally {
  server.kill();
}
console.log(failures === 0 ? 'footer render check: all passed' : `footer render check: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
