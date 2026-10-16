// launch-weekend F11 (R66): the SAOC-header National Show mega-menu renders as the NOS-header one does.
// Runtime check against BASE_URL (default http://localhost:3612), a production build started with
// SITE_PUBLIC_LAUNCH=true and the beta basic-auth vars empty. Exit 2 = server unreachable, 1 = finding.
//
//   node check-f11.mjs                         assert both menus against the golden NOS baseline
//   node check-f11.mjs --capture <file.json>   write the NOS-header menu measurements (run on origin/main)
//   node check-f11.mjs --shots <dir>           also save 1280 screenshots of both menus
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL || 'http://localhost:3612').replace(/\/$/, '');
const BASELINE = 'contracts/checks/launch-weekend/f11/nos-menu-baseline.json';
const WIDTHS = [1280, 1920];
const MAX_DESCRIPTION_LINES = 3;
const EXPECTED_COLUMNS = 5;
const LEAD_TITLE = '19th SAOC National Orchid Show';
const RAIL_LINKS = ['Day Visitor', 'Weekend Pass'];

const argAfter = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
};
const captureTo = argAfter('--capture');
const shotsDir = argAfter('--shots');

const problems = [];
const fail = (msg) => problems.push(msg);

async function openPage(browser, width, route) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  try {
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`);
  } catch (e) {
    console.error(`INFRA: cannot load ${BASE}${route} (${e.message})`);
    process.exit(2);
  }
  return { ctx, page };
}

// In-page: the visible grid's direct children, measured. `gridSelector` names the grid element.
function measureGrid(gridSelector) {
  const grid = document.querySelector(gridSelector);
  const lineCount = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
  };
  const columns = [...grid.children].map((col) => {
    const r = col.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      text: col.textContent.replace(/\s+/g, ' ').trim(),
      hasImg: Boolean(col.querySelector('img')),
      links: [...col.querySelectorAll('a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
      maxLines: Math.max(
        0,
        ...[...col.querySelectorAll('span, a')]
          .filter((el) => !el.querySelector('span, a') && el.textContent.trim())
          .map(lineCount),
      ),
    };
  });
  return {
    columns,
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  };
}

async function measureSaoc(browser, width) {
  const { ctx, page } = await openPage(browser, width, '/about');
  await page.locator('header button[aria-haspopup="true"]', { hasText: 'National Show' }).click();
  const menu = page.locator('[role="menu"][aria-label="National Show"]');
  await menu.waitFor({ state: 'visible' });
  const grid = '[role="menu"][aria-label="National Show"] .grid';
  const m = await page.evaluate(measureGrid, grid);
  if (shotsDir && width === 1280) {
    mkdirSync(shotsDir, { recursive: true });
    await page.screenshot({ path: `${shotsDir}/saoc-header-menu-1280.png` });
  }
  await ctx.close();
  return m;
}

async function measureNos(browser, width) {
  const { ctx, page } = await openPage(browser, width, '/national-show');
  await page.locator('#nh-show-trigger').click();
  await page.locator('#nh-mega').waitFor({ state: 'visible' });
  const m = await page.evaluate(measureGrid, '#nh-mega .nh-mega-grid');
  if (shotsDir && width === 1280) {
    mkdirSync(shotsDir, { recursive: true });
    await page.screenshot({ path: `${shotsDir}/nos-header-menu-1280.png` });
  }
  await ctx.close();
  return m;
}

function assertSaoc(width, m) {
  const tag = `SAOC menu @${width}`;
  if (m.columns.length !== EXPECTED_COLUMNS) {
    fail(`${tag}: ${m.columns.length} columns, expected ${EXPECTED_COLUMNS}`);
  }
  m.columns.forEach((c, i) => {
    if (c.left < 0 || c.right > m.innerWidth) {
      fail(`${tag}: column ${i + 1} spans ${c.left}..${c.right}, outside viewport ${m.innerWidth}`);
    }
    if (c.maxLines > MAX_DESCRIPTION_LINES) {
      fail(`${tag}: column ${i + 1} has text wrapping to ${c.maxLines} lines`);
    }
  });
  if (m.scrollWidth > m.innerWidth) {
    fail(`${tag}: horizontal overflow, scrollWidth ${m.scrollWidth} > ${m.innerWidth}`);
  }
  const lead = m.columns[0];
  if (!lead || !lead.links.includes(LEAD_TITLE)) fail(`${tag}: lead column lacks the "${LEAD_TITLE}" link`);
  if (lead?.hasImg) fail(`${tag}: lead column still renders an image instead of the title`);
  const rail = m.columns[m.columns.length - 1];
  const hasRail = rail && /Tickets/.test(rail.text) && RAIL_LINKS.every((l) => rail.links.includes(l));
  if (!hasRail) fail(`${tag}: Tickets panel (heading, Day Visitor, Weekend Pass) missing from last column`);
}

const browser = await chromium.launch();
try {
  const nos = {};
  for (const width of WIDTHS) nos[width] = await measureNos(browser, width);

  if (captureTo) {
    writeFileSync(captureTo, JSON.stringify(nos, null, 2) + '\n');
    console.log(`captured NOS menu baseline -> ${captureTo}`);
  } else {
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
    for (const width of WIDTHS) {
      const was = baseline[width].columns.map((c) => [c.left, c.width, c.text]);
      const now = nos[width].columns.map((c) => [c.left, c.width, c.text]);
      if (JSON.stringify(was) !== JSON.stringify(now)) {
        fail(`NOS menu @${width}: column positions/widths/text differ from baseline`);
      }
    }
    console.log(`NOS menu identical to baseline at ${WIDTHS.join(', ')}`);
  }

  for (const width of WIDTHS) {
    const m = await measureSaoc(browser, width);
    console.log(
      `SAOC menu @${width}: columns=${m.columns.length} maxLines=${Math.max(...m.columns.map((c) => c.maxLines))} ` +
        `scrollWidth=${m.scrollWidth}/${m.innerWidth}`,
    );
    if (!captureTo) assertSaoc(width, m);
  }
} finally {
  await browser.close();
}

if (problems.length) {
  for (const p of problems) console.error(`FAIL: ${p}`);
  process.exit(1);
}
console.log('F11 OK');
