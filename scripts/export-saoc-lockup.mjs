#!/usr/bin/env node
/**
 * SAOC lockup — exact-reproduction exporter (mission saoc-emblem-lockup).
 *
 * Brad, verbatim (relayed by team-lead): "The lockup must be reproduced
 * EXACTLY, as one unit: its own font, colours, rule colour and proportions."
 * The method he specified is to run his own Claude Design artifact's own
 * exportPng() code (app.js:106-153) headless, not to re-derive the lockup
 * by hand a second time (as scripts/generate-saoc-emblem-web-assets.py did
 * for the emblem-only recolour — that script stays on disk, untouched, but
 * is no longer what produces the site's lockup images).
 *
 * This script:
 *   1. Starts a tiny local HTTP server serving scripts/lockup-export-harness/
 *      (index.html + app.js, the artifact's own code, copied verbatim) and,
 *      at the exact relative path app.js's own SRC constant expects
 *      (assets/logo/saoc-emblem-colour.png), a TRIMMED copy of the emblem
 *      source, built in-memory each run from the read-only branding file
 *      (never copied to disk, never modified) — see
 *      `buildTrimmedEmblemBuffer()` below for why trimming is necessary:
 *      the raw branding file is a 1254×1254 square carrying a wide margin
 *      of near-invisible "dust" alpha (same artifact round 1's
 *      scripts/generate-saoc-emblem-web-assets.py already documented and
 *      worked around a different way). app.js's own exportPng() never
 *      trims its input image — it just scales whatever `this.img` is into
 *      the emblem's allocated box — so feeding it the untrimmed file makes
 *      the visible flower fill only ~59% of that box's height (measured:
 *      291px of an expected 492.8px at the default es:140 state), which is
 *      the defect team-lead flagged ("emblem too small relative to the
 *      wordmark"). Trimming the INPUT to its real content bbox, not
 *      touching app.js, is what actually reproduces the artifact's
 *      intended default proportions.
 *   2. Drives each export variant with Playwright: navigates the harness
 *      page with the state overrides for that variant in the query string,
 *      waits for the real browser `download` event exportPng()'s own
 *      `download()` helper triggers, and saves it to the target path in
 *      public/images/.
 *   3. For the horizontal variant only (header/mobile menu), additionally
 *      crops the exported PNG's own 0.3×embH transparent canvas padding
 *      (app.js:125 — `pad = embH * 0.3`, applied on every side) down to its
 *      real alpha-content bbox, per team-lead's instruction that the header
 *      lockup must fill its box rather than carry that padding into a
 *      cramped header row. The vertical/footer variant keeps its padding —
 *      "it's part of the look."
 *   4. Never touches the existing saoc-emblem-* assets (round 1 of this
 *      mission) — those stay on disk, per Brad's instruction, even though
 *      nothing on the site references them after this round's wiring.
 *
 * Usage: node scripts/export-saoc-lockup.mjs
 */
import { createReadStream, existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const HARNESS_DIR = path.join(__dirname, 'lockup-export-harness');
const EMBLEM_SOURCE = path.join(
  REPO_ROOT,
  'branding',
  'SA Orchid Council',
  'emblem',
  'Eulophia-speciosa-emblem.png',
);
const OUTPUT_DIR = path.join(REPO_ROOT, 'public', 'images');

// Variant 1 — header/mobile-menu horizontal lockup. Every field here is the
// artifact's own documented default state (app.js:46) — WM:0, P:2, N:7,
// F:0, T:0, rule:true, G:'light', E:0, transparent:true — so no overrides
// beyond `kind` are strictly needed, but E/G/transparent are passed
// explicitly anyway so this script's own intent is legible without having
// to cross-reference app.js's defaults.
const HORIZONTAL = {
  kind: 'h',
  E: 0,
  G: 'light',
  transparent: true,
  trimOuterPadding: true,
  out: path.join(OUTPUT_DIR, 'saoc-lockup-horizontal.png'),
};

// Variant 2 — footer vertical lockup. Brad's instruction: E:3 (Lapis
// monotone — TREAT[3].id is 'E4', label 'Lapis monotone'; the state field
// is the array INDEX, 3, not the id string), G:'dark', and
// transparent:false so the navy ground (palette P2's `dark` colour,
// '#172a5c') is baked into the exported pixels rather than composited by
// CSS — see his second message's "Export it with transparent:false, so the
// navy ground is part of the image and the lockup is pixel-exact."
const VERTICAL_DARK = {
  kind: 'v',
  E: 3,
  G: 'dark',
  transparent: false,
  trimOuterPadding: false,
  out: path.join(OUTPUT_DIR, 'saoc-lockup-vertical-dark.png'),
};

// Real-content alpha threshold for both trim operations below. Anything at
// or below this is the source file's own "dust" (round 1 of this mission
// measured it going as low as alpha=1), not visible artwork.
const CONTENT_ALPHA_THRESHOLD = 10;

/**
 * Crops a PNG buffer, in a throwaway page's canvas, to its own real-content
 * alpha bbox (alpha > CONTENT_ALPHA_THRESHOLD, ignoring near-invisible
 * "dust"). Shared by both trim call sites below — the emblem SOURCE input
 * (so app.js's own exportPng() fills its allocated box with real artwork
 * instead of dust margin) and the exported HEADER output (so its own
 * 0.3×embH canvas padding doesn't survive into the site). Returns a PNG
 * Buffer; nothing is written to disk here.
 */
async function trimBufferToContentBbox(browser, buffer) {
  const page = await browser.newPage();
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  const trimmedDataUrl = await page.evaluate(
    async ({ src, threshold }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = src;
      });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let minRow = Infinity,
        maxRow = -Infinity,
        minCol = Infinity,
        maxCol = -Infinity;
      for (let row = 0; row < c.height; row++) {
        for (let col = 0; col < c.width; col++) {
          if (d[(row * c.width + col) * 4 + 3] > threshold) {
            if (row < minRow) minRow = row;
            if (row > maxRow) maxRow = row;
            if (col < minCol) minCol = col;
            if (col > maxCol) maxCol = col;
          }
        }
      }
      const w = maxCol - minCol + 1,
        h = maxRow - minRow + 1;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      out.getContext('2d').drawImage(c, minCol, minRow, w, h, 0, 0, w, h);
      return out.toDataURL('image/png');
    },
    { src: dataUrl, threshold: CONTENT_ALPHA_THRESHOLD },
  );
  await page.close();
  return Buffer.from(trimmedDataUrl.split(',')[1], 'base64');
}

/** Loads the raw branding emblem (read-only) and trims it — see above. */
async function buildTrimmedEmblemBuffer(browser) {
  const rawBuffer = await readFile(EMBLEM_SOURCE);
  return trimBufferToContentBbox(browser, rawBuffer);
}

/** Trims an already-exported PNG file's outer padding, in place. */
async function trimPngFileToContentBbox(browser, filePath) {
  const trimmed = await trimBufferToContentBbox(browser, await readFile(filePath));
  await writeFile(filePath, trimmed);
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function startServer(trimmedEmblemBuffer) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/assets/logo/saoc-emblem-colour.png') {
      // The trimmed-in-memory buffer (see buildTrimmedEmblemBuffer) — never
      // the raw branding file, and never written to disk.
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(trimmedEmblemBuffer);
      return;
    }
    let filePath;
    if (url.pathname === '/' || url.pathname === '/index.html') {
      filePath = path.join(HARNESS_DIR, 'index.html');
    } else if (url.pathname === '/app.js') {
      filePath = path.join(HARNESS_DIR, 'app.js');
    } else {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('not found: ' + filePath);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function exportVariant(browser, context, baseUrl, variant) {
  const page = await context.newPage();
  const qs = new URLSearchParams({
    kind: variant.kind,
    E: String(variant.E),
    G: variant.G,
    transparent: String(variant.transparent),
  });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.goto(`${baseUrl}/index.html?${qs}`, { waitUntil: 'load' }),
  ]);
  await download.saveAs(variant.out);
  await page.close();
  if (variant.trimOuterPadding) {
    await trimPngFileToContentBbox(browser, variant.out);
  }
  return variant.out;
}

async function main() {
  const browser = await chromium.launch();
  const trimmedEmblemBuffer = await buildTrimmedEmblemBuffer(browser);

  const server = await startServer(trimmedEmblemBuffer);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const context = await browser.newContext({ acceptDownloads: true });

  try {
    for (const variant of [HORIZONTAL, VERTICAL_DARK]) {
      const outPath = await exportVariant(browser, context, baseUrl, variant);
      const bytes = (await readFile(outPath)).length;
      console.log(`wrote ${outPath} (${bytes} bytes)`);
    }
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
