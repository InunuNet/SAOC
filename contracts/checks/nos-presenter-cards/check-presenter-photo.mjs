// nos-presenter-cards F1 — 4:5 photo crops (golden §6). Functional: imports
// lib/view-models/presenter-photo.ts. Crops are keyed by the Sanity image ASSET reference
// (the crop belongs to the pixels, not to the person), with Codi's crop boxes (x0,y0,x1,y1)
// converted to Sanity `rect=x,y,w,h`. Tibbs is never requested wider than 1.3x his 201px
// crop (261px). An unknown asset (a photo replaced in Studio) gets no stale rect.
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

const known = [
  {
    who: 'Wijaya',
    ref: 'image-22d78f9df6c4a9188138aba0787ce2d21af8a636-2113x2113-png',
    url: `${CDN}22d78f9df6c4a9188138aba0787ce2d21af8a636-2113x2113.png`,
    box: { x0: 560, y0: 0, x1: 2113, y1: 1941 },
    qs: 'rect=560,0,1553,1941&w=320&h=400&auto=format',
    w: 320,
    h: 400,
  },
  {
    who: 'Crous',
    ref: 'image-dc5d8e33477da7e5f2aad746c49b989d5ff70c32-690x940-png',
    url: `${CDN}dc5d8e33477da7e5f2aad746c49b989d5ff70c32-690x940.png`,
    box: { x0: 0, y0: 0, x1: 690, y1: 862 },
    qs: 'rect=0,0,690,862&w=320&h=400&auto=format',
    w: 320,
    h: 400,
  },
  {
    who: 'Tibbs',
    ref: 'image-29f471e86c4fbc6854aef0598554b1cb3f197822-201x317-png',
    url: `${CDN}29f471e86c4fbc6854aef0598554b1cb3f197822-201x317.png`,
    box: { x0: 0, y0: 0, x1: 201, y1: 251 },
    qs: 'rect=0,0,201,251&w=261&h=326&auto=format',
    w: 261,
    h: 326,
  },
  {
    who: 'Fuchs',
    ref: 'image-02d56160c37ec45f6d752b1c836a7683df0c1899-2448x3264-jpg',
    url: `${CDN}02d56160c37ec45f6d752b1c836a7683df0c1899-2448x3264.jpg`,
    box: { x0: 473, y0: 74, x1: 2073, y1: 2074 },
    qs: 'rect=473,74,1600,2000&w=320&h=400&auto=format',
    w: 320,
    h: 400,
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
    const want = { src: `${k.url}?${k.qs}`, width: k.w, height: k.h };
    expect(JSON.stringify(got) === JSON.stringify(want), `${k.who}: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }

  const unknownUrl = `${CDN}ffffffffffffffffffffffffffffffffffffffff-1000x1000.jpg`;
  const unknown = presenterPhoto(unknownUrl, 'image-ffffffffffffffffffffffffffffffffffffffff-1000x1000-jpg');
  expect(
    JSON.stringify(unknown) === JSON.stringify({ src: `${unknownUrl}?w=320&h=400&fit=crop&auto=format`, width: 320, height: 400 }),
    `unknown asset: want centre 4:5 crop with no rect, got ${JSON.stringify(unknown)}`,
  );
  expect(presenterPhoto(null, null) === null, 'no photo (url null) must return null');
  expect(presenterPhoto(null, known[0].ref) === null, 'url null with a known ref must still return null');
}

finish('check-presenter-photo.mjs', failures, 'presenterPhoto: exact 4:5 rect crops per asset ref, Tibbs capped at 261px, unknown assets centre-cropped.');
