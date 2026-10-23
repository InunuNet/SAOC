// Mission nos-site-split — card render gate (NOS Design hero-cards-ruling B3 plus the final NavCards ruling).
// Starts `next start` (needs a prior `pnpm build`) on a fixed local port with sandbox-only env, then drives
// Chromium against the SAOC home and the NOS hub. Read-only: GET only, no writes.
//   B3     per card, the served file's pixel width covers the card box at the viewport's density
//   crop   the displayed window is at least minWindowWidth source px wide and shows 0% of any exclude region
//          (About: the plant clip), computed from lib/card-crops.json and the cover-fit math at each viewport
// Screenshots go to ../split-shots (relative to the worktree), cards-NAME.png. Exit 1 on any failed assertion.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 3218;
const SAOC_HOST = `saoc.localhost:${PORT}`;
const NOS_HOST = `nos.localhost:${PORT}`;
const CREDENTIALS = { username: 's', password: 'p' };
const SHOT_DIR = '../split-shots';
const LOG_DIR = '.tmp/sandbox/nos-split';
const VIEWPORTS = [[390, 844, 2], [1280, 800, 2], [1440, 900, 2], [2056, 1100, 2]];
const SHOT_VIEWPORTS = [[390, 844, 1], [1280, 800, 1], [1440, 900, 1], [2056, 1100, 2]];
const PIXEL_TOLERANCE = 2;
const { minWindowWidth, crops } = JSON.parse(readFileSync('lib/card-crops.json', 'utf8'));

mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });
const log = openSync(`${LOG_DIR}/cards-check-start.log`, 'w');
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
  throw new Error(`next start did not come up; see ${LOG_DIR}/cards-check-start.log`);
}

async function open(browser, host, path, [width, height, dpr]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, httpCredentials: CREDENTIALS });
  const page = await context.newPage();
  await page.goto(`http://${host}${path}`, { waitUntil: 'networkidle' });
  return { context, page };
}

/** The crop a served variant came from: /images/_opt/cards/about.jpg-1080.webp -> /images/cards/about.jpg. */
function cropKeyOf(src) {
  const match = /\/images\/_opt\/(cards\/[^/]+\.jpg)-\d+/.exec(src);
  return match ? `/images/${match[1]}` : null;
}

const overlapArea = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Cover-fit, object-position 50% 50%: the part of the file the box shows, as a fraction of the file. */
function visibleFraction(file, box) {
  const scale = Math.max(box.w / file.w, box.h / file.h);
  return { w: box.w / scale / file.w, h: box.h / scale / file.h };
}

async function checkCards(browser) {
  for (const viewport of VIEWPORTS) {
    const [width, , dpr] = viewport;
    const { context, page } = await open(browser, SAOC_HOST, '/', viewport);
    await page.locator('[data-home-section="nav-cards"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    // naturalWidth is density-corrected for a w-descriptor srcset, so the real pixel width is read from the file itself.
    const rows = await page.$$eval('[data-nav-card] img', async (imgs) =>
      Promise.all(
        imgs.map(async (img) => {
          const bitmap = await createImageBitmap(await (await fetch(img.currentSrc)).blob());
          const rect = img.getBoundingClientRect();
          return { src: img.currentSrc, natural: { w: bitmap.width, h: bitmap.height }, box: { w: rect.width, h: rect.height } };
        }),
      ),
    );
    check(`cards: four photographs at ${width}`, rows.length === 4, `found ${rows.length}`);
    for (const row of rows) {
      const name = row.src.split('/').pop();
      const need = Math.round(row.box.w * dpr);
      check(`B3 naturalWidth ${name} at ${width}@${dpr}`, row.natural.w >= need - PIXEL_TOLERANCE, `natural=${row.natural.w} box=${Math.round(row.box.w)} need>=${need}`);
      const key = cropKeyOf(row.src);
      const crop = key ? crops[key] : null;
      check(`crop: ${name} is a manifest crop`, crop !== null, row.src);
      if (!crop) continue;
      const shown = visibleFraction(row.natural, row.box);
      // object-position 50% 50%: the shown window is centred in the crop rect.
      const window = { w: crop.rect.w * shown.w, h: crop.rect.h * shown.h };
      window.x = crop.rect.x + (crop.rect.w - window.w) / 2;
      window.y = crop.rect.y + (crop.rect.h - window.h) / 2;
      check(`crop: ${name} window >=${minWindowWidth}px at ${width}`, window.w >= minWindowWidth, `window=${Math.round(window.w)}px`);
      for (const region of crop.exclude ?? []) {
        const share = overlapArea(window, region) / (region.w * region.h);
        check(`crop: ${name} shows 0% of ${region.name} at ${width}`, share === 0, `share=${(share * 100).toFixed(1)}%`);
      }
    }
    await context.close();
  }
}

async function shoot(browser) {
  for (const viewport of SHOT_VIEWPORTS) {
    const [width, , dpr] = viewport;
    const suffix = `${width}${dpr > 1 ? '@2' : ''}`;
    const saoc = await open(browser, SAOC_HOST, '/', viewport);
    const section = saoc.page.locator('[data-home-section="nav-cards"]');
    await section.scrollIntoViewIfNeeded();
    await saoc.page.waitForTimeout(600);
    await section.screenshot({ path: `${SHOT_DIR}/cards-saoc-${suffix}.png` });
    await saoc.context.close();
    const nos = await open(browser, NOS_HOST, '/', viewport);
    check(`nos: petal cards present at ${width}`, (await nos.page.locator('.nos-petal').count()) > 0);
    const nosSection = nos.page.locator('section', { has: nos.page.locator('.nos-petal') }).first();
    await nosSection.scrollIntoViewIfNeeded();
    await nos.page.waitForTimeout(400);
    await nosSection.screenshot({ path: `${SHOT_DIR}/cards-nos-${suffix}.png` });
    await nos.context.close();
  }
}

try {
  await waitUp();
  const browser = await chromium.launch();
  await checkCards(browser);
  await shoot(browser);
  await browser.close();
} finally {
  server.kill();
}
console.log(failures === 0 ? 'cards render check: all passed' : `cards render check: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
