// Candidate sheet for the /events/[slug] hero cut (mission saoc-inner-heroes F2, NOS Design 2026-10-26 HM-7).
// Nothing is implemented: this writes the evidence NOS Design picks from into .tmp/sandbox/heroes2-sheets/:
// an in-situ capture at 1440@2 (eased scrim, h1, chip) and the 1:1 crop of the left 44% showing the veining,
// plus manifest.json. Usage: node scripts/heroes-sheets.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(`${process.cwd()}/package.json`);
const sharp = require('sharp');
const { chromium } = require('playwright');

const DIR = '.tmp/sandbox/heroes2-sheets';
const VIEW = { width: 1440, height: 480 };
const DSF = 2;
const LEFT_ZONE = 0.44;
const SCRIM_STOPS = [[0, 34], [0.06, 38], [0.16, 42], [0.32, 45], [0.52, 48], [0.7, 50.5], [0.8, 52]];
const SAGE = '34 40 31';
// One candidate: the large veined bloom of orchid-dark.jpg, unflipped. Its rect is a 3:1 window over the
// bloom's face, so the left 44% is petal veining; it overlaps neither home's dark nor /sponsors' dark-flip.
const CANDIDATE = {
  id: 'events-slug-c1',
  route: '/events/[slug]',
  kind: 'photo',
  source: 'orchid-dark.jpg',
  flip: false,
  rect: { x0: 2300, y0: 1150, x1: 5184, y1: 2111 },
  objectPosition: '0% 50%',
};

const font = (family, file, weight = '300 600') => {
  const b64 = readFileSync(path.join('app/fonts', file)).toString('base64');
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
};

const scrim = `linear-gradient(90deg, transparent 0, ${SCRIM_STOPS.map(([a, p]) => `rgb(${SAGE} / ${a}) ${p}%`).join(', ')})`;
const html = (photo) => `<!doctype html><meta charset="utf-8"><style>
${font('Crimson', 'crimson-pro/CrimsonPro-latin-normal.woff2')}
${font('Karla', 'karla/Karla-latin-normal.woff2')}
${font('Mono', 'jetbrains-mono/JetBrainsMono-latin-normal.woff2')}
html,body{margin:0}
section{position:relative;isolation:isolate;overflow:hidden;width:${VIEW.width}px;height:${VIEW.height}px;background:rgb(${SAGE});display:flex;align-items:center}
.photo{position:absolute;inset:0;background:url(${photo}) 0% 50%/cover}
.scrim{position:absolute;inset:0;background-image:${scrim}}
.copy{position:relative;z-index:1;margin-left:52%;width:48%;display:flex;flex-direction:column;align-items:flex-start;padding:64px 0}
.chip{font:10.5px/1 Mono;letter-spacing:.18em;text-transform:uppercase;color:#f4f3ec;border:1px solid rgb(255 255 255/.25);background:rgb(${SAGE}/.6);border-radius:999px;padding:6px 14px}
h1{margin:20px 0 0;font:300 62px/1.05 Crimson;letter-spacing:-.015em;color:#f4f3ec;max-width:48rem}
</style><section><div class="photo"></div><div class="scrim"></div>
<div class="copy"><span class="chip">Event kind</span><h1>Event title</h1></div></section>`;

mkdirSync(DIR, { recursive: true });
const { rect: r } = CANDIDATE;
const photoFile = path.resolve(DIR, `${CANDIDATE.id}-source.jpg`);
await sharp('public/images/orchid-dark.jpg')
  .extract({ left: r.x0, top: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0 })
  .jpeg({ quality: 90 })
  .toFile(photoFile);

const htmlFile = path.resolve(DIR, `${CANDIDATE.id}.html`);
writeFileSync(htmlFile, html(`file://${photoFile}`));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
  const page = await context.newPage();
  await page.goto(`file://${htmlFile}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const sheet = `${CANDIDATE.id}-sheet.png`;
  await page.locator('section').screenshot({ path: path.join(DIR, sheet) });
  const crop = `${CANDIDATE.id}-crop.png`;
  // The 1:1 left-44% crop is the hero without copy: the bare photograph under the scrim's clear edge.
  await page.addStyleTag({ content: '.copy{display:none}' });
  await page.screenshot({
    path: path.join(DIR, crop),
    clip: { x: 0, y: 0, width: Math.round(VIEW.width * LEFT_ZONE), height: VIEW.height },
  });
  writeFileSync(
    path.join(DIR, 'manifest.json'),
    `${JSON.stringify({ candidates: [{ ...CANDIDATE, sheet, crop }] }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
console.log(`heroes-sheets: wrote ${DIR}/manifest.json`);
