#!/usr/bin/env node
/**
 * Text-layer renderer for scripts/generate-saoc-media-kit.py.
 *
 * Reads a JSON job from the file named in argv[2]:
 *   { "mode": "measure" | "render", "outDir": "<dir>", "runs": [ { id, text, family, weight,
 *     sizePx, letterSpacingPx, lineHeight, color } ] }
 * and prints a JSON array of { id, width, canvasWidth, canvasHeight } to stdout. In render mode it
 * also writes <outDir>/<id>.png, a transparent canvas holding the single run, left aligned, with
 * the trailing letter-space trimmed so the visible width is the measured width.
 *
 * The two typefaces (Crimson Pro 600 for the wordmark, JetBrains Mono 400 for the tagline) are the
 * ones the presentation's Wordmark specification names. They load from the exact-pinned @fontsource
 * devDependencies on disk, so the output never depends on the network. A failed font load aborts:
 * nothing is substituted.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const FONTSOURCE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/@fontsource',
);
const FONT_FILES = [
  { family: 'Crimson Pro', weight: 600, file: 'crimson-pro/files/crimson-pro-latin-600-normal.woff2' },
  {
    family: 'JetBrains Mono',
    weight: 400,
    file: 'jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
  },
];

function fontFaceCss() {
  return FONT_FILES.map(({ family, weight, file }) => {
    const data = readFileSync(path.join(FONTSOURCE_DIR, file)).toString('base64');
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2');}`;
  }).join('\n');
}

const job = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// The bundled Chromium is preferred; a machine whose Playwright browser cache is stale falls back
// to the installed Google Chrome, which renders the same web fonts.
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
try {
  const page = await browser.newPage();
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss()}</style></head><body></body></html>`,
    { waitUntil: 'networkidle' },
  );
  const results = await page.evaluate(async (runs) => {
    const out = [];
    for (const r of runs) {
      const font = `${r.weight} ${r.sizePx}px '${r.family}'`;
      await document.fonts.load(font, r.text);
      if (!document.fonts.check(font, r.text)) throw new Error(`font failed to load: ${font}`);
      const c = document.createElement('canvas');
      const x = c.getContext('2d');
      x.font = font;
      x.letterSpacing = `${r.letterSpacingPx}px`;
      const width = x.measureText(r.text).width - r.letterSpacingPx;
      const canvasWidth = Math.ceil(width);
      const canvasHeight = Math.ceil(r.sizePx * r.lineHeight);
      c.width = canvasWidth;
      c.height = canvasHeight;
      x.font = font;
      x.letterSpacing = `${r.letterSpacingPx}px`;
      x.fillStyle = r.color;
      x.textBaseline = 'middle';
      x.textAlign = 'left';
      x.fillText(r.text, 0, canvasHeight / 2);
      out.push({ id: r.id, width, canvasWidth, canvasHeight, png: c.toDataURL('image/png') });
    }
    return out;
  }, job.runs);

  if (job.mode === 'render') mkdirSync(job.outDir, { recursive: true });
  for (const r of results) {
    if (job.mode === 'render') {
      writeFileSync(path.join(job.outDir, `${r.id}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    }
    delete r.png;
  }
  process.stdout.write(JSON.stringify(results));
} finally {
  await browser.close();
}
