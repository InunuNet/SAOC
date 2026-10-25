// nos-presenter-cards F1 — 4:5 photo crops (golden §6). Functional: imports
// lib/view-models/presenter-photo.ts. Crops are keyed by the Sanity image ASSET reference
// (the crop belongs to the pixels, not to the person), with Codi's crop boxes (x0,y0,x1,y1)
// converted to Sanity `rect=x,y,w,h` (commas percent-encoded, the CDN returns the same bytes).
// nos-sweep-fixes SP-1 supersedes the 1.3x ceiling: every URL carries fit=max and no requested
// width exceeds the asset's available width (crop rect, else the width in the asset ref), with a
// 1x and 2x srcSet at the 160px and 320px plate widths. Tibbs (201px crop) is 160 and 201. An
// unknown asset (a photo replaced in Studio) gets no stale rect and keeps the fit=crop 4:5 centre
// crop: each rung is capped at min(requested, W, floor(H*4/5)) from the asset ref, so the crop
// never upscales, and a rung that would upscale is dropped rather than repeated. An unparseable
// ref gets one 160 fit=crop rung.
//
// Run as: node contracts/checks/nos-presenter-cards/check-presenter-photo.mjs
import { finish, loadRepoModule } from './_lib.mjs';

const REL = 'lib/view-models/presenter-photo.ts';
const CDN = 'https://cdn.sanity.io/images/26yfbug4/production/';
const failures = [];
const expect = (ok, msg) => {
  if (!ok) failures.push(msg);
};

let mod;
try {
  mod = await loadRepoModule(REL);
} catch (error) {
  finish('check-presenter-photo.mjs', [`cannot import ${REL}: ${error.message}`]);
}
const { presenterPhoto, PRESENTER_PHOTO_CROPS } = mod;

const PLATE_1X = 160;
const PLATE_2X = 320;
const heightFor = (w) => Math.round((w * 5) / 4);
const urlAt = (base, rect, w) => `${base}?${rect ? `rect=${rect}&` : ''}w=${w}&h=${heightFor(w)}&fit=max&auto=format`;
const expectedPhoto = (base, rect, avail) => {
  const w1 = Math.min(PLATE_1X, avail);
  const src = urlAt(base, rect, w1);
  return { src, srcSet: `${src} 1x, ${urlAt(base, rect, Math.min(PLATE_2X, avail))} 2x`, width: w1, height: heightFor(w1) };
};

const known = [
  {
    who: 'Wijaya',
    ref: 'image-22d78f9df6c4a9188138aba0787ce2d21af8a636-2113x2113-png',
    url: `${CDN}22d78f9df6c4a9188138aba0787ce2d21af8a636-2113x2113.png`,
    box: { x0: 560, y0: 0, x1: 2113, y1: 1941 },
    rect: '560%2C0%2C1553%2C1941',
    avail: 1553,
  },
  {
    who: 'Crous',
    ref: 'image-dc5d8e33477da7e5f2aad746c49b989d5ff70c32-690x940-png',
    url: `${CDN}dc5d8e33477da7e5f2aad746c49b989d5ff70c32-690x940.png`,
    box: { x0: 0, y0: 0, x1: 690, y1: 862 },
    rect: '0%2C0%2C690%2C862',
    avail: 690,
  },
  {
    who: 'Tibbs',
    ref: 'image-29f471e86c4fbc6854aef0598554b1cb3f197822-201x317-png',
    url: `${CDN}29f471e86c4fbc6854aef0598554b1cb3f197822-201x317.png`,
    box: { x0: 0, y0: 0, x1: 201, y1: 251 },
    rect: '0%2C0%2C201%2C251',
    avail: 201,
  },
  {
    who: 'Fuchs',
    ref: 'image-02d56160c37ec45f6d752b1c836a7683df0c1899-2448x3264-jpg',
    url: `${CDN}02d56160c37ec45f6d752b1c836a7683df0c1899-2448x3264.jpg`,
    box: { x0: 473, y0: 74, x1: 2073, y1: 2074 },
    rect: '473%2C74%2C1600%2C2000',
    avail: 1600,
  },
];

expect(typeof presenterPhoto === 'function', `${REL} must export function presenterPhoto(url, assetRef)`);
expect(
  PRESENTER_PHOTO_CROPS && typeof PRESENTER_PHOTO_CROPS === 'object' && Object.keys(PRESENTER_PHOTO_CROPS).length === 4,
  `${REL} must export PRESENTER_PHOTO_CROPS with exactly the 4 asset refs`,
);

if (typeof presenterPhoto === 'function') {
  for (const k of known) {
    expect(
      JSON.stringify(PRESENTER_PHOTO_CROPS?.[k.ref]) === JSON.stringify(k.box),
      `${k.who}: PRESENTER_PHOTO_CROPS['${k.ref}'] must be ${JSON.stringify(k.box)}, got ${JSON.stringify(PRESENTER_PHOTO_CROPS?.[k.ref])}`,
    );
    const got = presenterPhoto(k.url, k.ref);
    const want = expectedPhoto(k.url, k.rect, k.avail);
    expect(JSON.stringify(got) === JSON.stringify(want), `${k.who}: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }

  const fbUrl = (base, w) => `${base}?w=${w}&h=${heightFor(w)}&fit=crop&auto=format`;
  const fallbackPhoto = (base, widths) => {
    const urls = widths.map((w) => fbUrl(base, w));
    return { src: urls[0], srcSet: urls.map((u, i) => `${u} ${i + 1}x`).join(', '), width: widths[0], height: heightFor(widths[0]) };
  };
  const fbBase = `${CDN}ffffffffffffffffffffffffffffffffffffffff-1000x1000.jpg`;
  const fbRef = (W, H) => `image-ffffffffffffffffffffffffffffffffffffffff-${W}x${H}-jpg`;
  // [W, H, expected rung widths]: cap = min(W, floor(H*4/5)); 1x = min(160, cap); 2x = 320 only when cap >= 320.
  const fallbacks = [
    [1000, 1000, [160, 320]],
    [4000, 2000, [160, 320]],
    [600, 300, [160]],
    [1000, 1500, [160, 320]],
    [200, 1000, [160]],
    [120, 150, [120]],
    [100, 400, [100]],
    [320, 400, [160, 320]],
    [319, 399, [160]],
  ];
  for (const [W, H, widths] of fallbacks) {
    const got = presenterPhoto(fbBase, fbRef(W, H));
    expect(
      JSON.stringify(got) === JSON.stringify(fallbackPhoto(fbBase, widths)),
      `fallback ${W}x${H}: want fit=crop rungs ${widths.join('/')} with no rect, got ${JSON.stringify(got)}`,
    );
    const cap = Math.min(W, Math.floor((H * 4) / 5));
    const ws = [...(got?.srcSet ?? '').matchAll(/[?&]w=(\d+)&h=(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(
      ws.length > 0 && ws.every(([w, h]) => w <= cap && h <= H) && new Set(ws.map(([w]) => w)).size === ws.length,
      `fallback ${W}x${H}: no rung may exceed what the source delivers at 4:5 (cap ${cap}) or repeat a width, got ${got?.srcSet}`,
    );
    expect(!/fit=max|rect=/.test(got?.srcSet ?? ''), `fallback ${W}x${H}: must be fit=crop with no rect, got ${got?.srcSet}`);
  }
  const unparseable = presenterPhoto(fbBase, 'image-not-a-sized-ref');
  expect(
    JSON.stringify(unparseable) === JSON.stringify(fallbackPhoto(fbBase, [PLATE_1X])),
    `unparseable ref: want one ${PLATE_1X}px fit=crop rung (never upscale blind), got ${JSON.stringify(unparseable)}`,
  );
  const tibbsPhoto = presenterPhoto(known[2].url, known[2].ref);
  expect(
    tibbsPhoto !== null && tibbsPhoto.width === 160 && tibbsPhoto.srcSet.includes('w=201&') && !tibbsPhoto.srcSet.includes('w=261'),
    `Tibbs must be 160 (1x) and 201 (2x), never 261, got ${tibbsPhoto?.srcSet}`,
  );
  expect(presenterPhoto(null, null) === null, 'no photo (url null) must return null');
  expect(presenterPhoto(null, known[0].ref) === null, 'url null with a known ref must still return null');
}

finish('check-presenter-photo.mjs', failures, 'presenterPhoto: exact 4:5 rect crops per asset ref, mapped crops fit=max capped at the available width with a 1x/2x srcSet (Tibbs 160/201), unknown refs fit=crop 4:5 centre crops capped at min(W, floor(H*4/5)) with upscaling rungs dropped.');
