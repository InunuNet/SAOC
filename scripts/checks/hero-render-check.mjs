// Mission nos-site-split — hero render gate (NOS Design hero-cards-ruling A1, A4, A6, plus the H4 plant clip).
// Starts `next start` (needs a prior `pnpm build`) on a fixed local port with sandbox-only env, then drives
// Chromium against the SAOC home, the NOS hub and /programme. Read-only: GET only, no writes.
//   A1  every hero photograph's naturalWidth covers its box at 2x (or is its native width)
//   A4  the copy scrim is transparent over the right of the frame (computed background of the scrim layer)
//   A6  per slide, the lightest pixel under the italic is >=3:1 against its colour, under the lede >=4.5:1
// Screenshots go to ../split-shots (relative to the worktree), hero-NAME.png. Exit 1 on any failed assertion.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 3218;
const SAOC_HOST = `saoc.localhost:${PORT}`;
const NOS_HOST = `nos.localhost:${PORT}`;
const CREDENTIALS = { username: 's', password: 'p' };
const SHOT_DIR = '../split-shots';
const LOG_DIR = '.tmp/sandbox/nos-split';
const NATIVE = JSON.parse(readFileSync('lib/hero-source-widths.json', 'utf8'));
const FADE_WAIT_MS = 1700;
const ITALIC_MIN = 3;
const LEDE_MIN = 4.5;
const IVORY = [244, 243, 236];
const ACCENT_SOFT = [194, 179, 147];
const LEDE_TEXT =
  'Uniting twenty-one affiliated societies in the cultivation, exhibition, and appreciation of orchids across South Africa since 1968.';

mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });
const log = openSync(`${LOG_DIR}/hero-check-start.log`, 'w');
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

function luminance([r, g, b]) {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
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
  throw new Error(`next start did not come up; see ${LOG_DIR}/hero-check-start.log`);
}

/** Lightest pixel (max R+G+B) of the PNG buffer region, via the page's own canvas. */
async function lightestUnder(page, png, rects) {
  return page.evaluate(
    async ({ b64, rects: boxes, dpr }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return boxes.map((r) => {
        const x = Math.max(0, Math.floor(r.x * dpr));
        const y = Math.max(0, Math.floor(r.y * dpr));
        const w = Math.max(1, Math.min(img.width - x, Math.ceil(r.width * dpr)));
        const h = Math.max(1, Math.min(img.height - y, Math.ceil(r.height * dpr)));
        const data = ctx.getImageData(x, y, w, h).data;
        let best = [0, 0, 0];
        let bestSum = -1;
        for (let i = 0; i < data.length; i += 4) {
          const sum = data[i] + data[i + 1] + data[i + 2];
          if (sum > bestSum) {
            bestSum = sum;
            best = [data[i], data[i + 1], data[i + 2]];
          }
        }
        return best;
      });
    },
    { b64: png.toString('base64'), rects, dpr: await page.evaluate(() => window.devicePixelRatio) },
  );
}

async function open(browser, host, path, viewport, dpr) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, httpCredentials: CREDENTIALS });
  const page = await context.newPage();
  await page.goto(`http://${host}${path}`, { waitUntil: 'networkidle' });
  return { context, page };
}

async function checkNaturalWidths(browser) {
  const viewport = { width: 2056, height: 1100 };
  const targets = [
    ['saoc-home', SAOC_HOST, '/', '[data-home-hero] img'],
    ['nos-hub', NOS_HOST, '/', '[data-nos-hero="hub"] img'],
    ['nos-programme', NOS_HOST, '/programme', '[data-nos-hero="inner"] img'],
  ];
  for (const [label, host, path, selector] of targets) {
    const { context, page } = await open(browser, host, path, viewport, 2);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    // naturalWidth is density-corrected for a w-descriptor srcset, so the real pixel width is read from the file itself.
    const rows = await page.$$eval(selector, async (imgs) =>
      Promise.all(
        imgs.map(async (img) => {
          const bitmap = await createImageBitmap(await (await fetch(img.currentSrc)).blob());
          return { src: img.currentSrc, natural: bitmap.width, box: img.getBoundingClientRect().width };
        }),
      ),
    );
    for (const row of rows) {
      const source = Object.keys(NATIVE).find((key) => row.src.includes(key.replace('/images/', '').replace('.jpg', '.jpg')));
      const native = source ? NATIVE[source] : Infinity;
      const need = Math.min(native, Math.round(row.box * 2));
      check(`A1 naturalWidth ${label} ${row.src.split('/').pop()}`, row.natural >= need - 2, `natural=${row.natural} box=${Math.round(row.box)} need>=${need}`);
    }
    await context.close();
  }
}

async function checkScrimAndContrast(browser) {
  const { context, page } = await open(browser, SAOC_HOST, '/', { width: 2056, height: 1100 }, 2);
  const scrim = await page.$eval('[data-hero-scrim="copy"]', (el) => getComputedStyle(el).backgroundImage);
  check('A4 scrim ends transparent at 76%', /transparent 76%/.test(scrim) || /rgba\(0, 0, 0, 0\) 76%/.test(scrim), scrim.slice(0, 200));
  const bands = await page.$$eval('[data-hero-scrim]', (els) => els.map((el) => el.getAttribute('data-hero-scrim')));
  check('A4 only the copy layer', bands.join() === 'copy', bands.join());
  await page.addStyleTag({ content: '[data-home-hero] h1, [data-home-hero] [data-hero-lede] { color: transparent !important; } [data-home-hero] h1 em { color: transparent !important; }' });
  const hasLede = (await page.locator('[data-hero-lede]').count()) > 0;
  if (!hasLede) {
    await page.evaluate((text) => {
      const lede = document.createElement('p');
      lede.setAttribute('data-hero-lede', '');
      lede.className = 'mt-4 max-w-[52ch] text-pretty font-sans text-[20px] leading-[1.5] md:mt-5';
      lede.textContent = text;
      document.querySelector('[data-home-hero] h1').insertAdjacentElement('afterend', lede);
    }, LEDE_TEXT);
  }
  const slideCount = await page.locator('[data-hero-slide]').count();
  for (let i = 0; i < slideCount; i += 1) {
    await page.locator('[data-hero-controls] [aria-label^="Show slide"]').nth(i).click();
    await page.waitForTimeout(FADE_WAIT_MS);
    await page.mouse.move(2, 2);
    const rects = await page.evaluate(() => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const lede = document.querySelector('[data-hero-lede]');
      return { italic: box(document.querySelector('[data-home-hero] h1 em')), lede: box(lede), key: document.querySelectorAll('[data-hero-slide]').length };
    });
    const png = await page.screenshot({ animations: 'allow' });
    const [italicPx, ledePx] = await lightestUnder(page, png, [rects.italic, rects.lede]);
    const italic = contrast(ACCENT_SOFT, italicPx);
    const lede = contrast(IVORY, ledePx);
    check(`A6 italic >=${ITALIC_MIN}:1 slide ${i + 1}`, italic >= ITALIC_MIN, `${italic.toFixed(2)} over rgb(${italicPx})`);
    check(`A6 lede >=${LEDE_MIN}:1 slide ${i + 1}`, lede >= LEDE_MIN, `${lede.toFixed(2)} over rgb(${ledePx})${hasLede ? '' : ' (lede injected: public build withholds it)'}`);
  }
  await context.close();
}

async function shoot(browser) {
  const shots = [
    ['saoc', SAOC_HOST, '/', [[390, 844, 1], [1280, 800, 1], [1440, 900, 1], [2056, 1100, 2]]],
    ['nos-hub', NOS_HOST, '/', [[390, 844, 1], [1280, 800, 1], [1440, 900, 1], [2056, 1100, 2]]],
    ['nos-programme', NOS_HOST, '/programme', [[390, 844, 1], [1440, 900, 1]]],
  ];
  for (const [name, host, path, sizes] of shots) {
    for (const [width, height, dpr] of sizes) {
      const { context, page } = await open(browser, host, path, { width, height }, dpr);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOT_DIR}/hero-${name}-${width}${dpr > 1 ? '@2' : ''}.png` });
      await context.close();
    }
  }
  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', httpCredentials: CREDENTIALS });
  const page = await reduced.newPage();
  await page.goto(`http://${SAOC_HOST}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const controls = await page.locator('[data-hero-controls]').count();
  const active = await page.$$eval('[data-hero-slide]', (els) => els.map((el) => (el.getAttribute('aria-hidden') ? 0 : 1)).join(''));
  check('A7 reduced motion: static S3 lead, no controls', controls === 0 && active === '10', `controls=${controls} active=${active}`);
  await page.screenshot({ path: `${SHOT_DIR}/hero-saoc-reduced-1440.png` });
  await reduced.close();
}

try {
  await waitUp();
  const browser = await chromium.launch();
  await checkNaturalWidths(browser);
  await checkScrimAndContrast(browser);
  await shoot(browser);
  await browser.close();
} finally {
  server.kill();
}
console.log(failures === 0 ? 'hero render check: all passed' : `hero render check: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
