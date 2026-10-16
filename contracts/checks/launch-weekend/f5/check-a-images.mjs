#!/usr/bin/env node
// A1 - hero images carry a srcset through the custom loader (lib/image-loader.ts): no raw
// /images/orchid-*.jpg src, default src width capped at 2048, and every srcset candidate answers
// 200 image/webp under the size limit (runtime, BASE_URL). The /_next/image optimiser is not
// used: Firebase App Hosting's adapter disables it unless a custom loader is configured.
import { getPage, fetchRaw, report, BASE } from './_lib.mjs';

const problems = [];
const MAX_WIDTH = 2048;
const MAX_BYTES = 300_000;

for (const route of ['/', '/societies', '/judging']) {
  const { text } = await getPage(route);
  const imgs = [...text.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const heroes = imgs.filter((t) => /orchid-[a-z]+/.test(t) || /data-nimg="fill"/.test(t));
  if (heroes.length === 0) problems.push(`${route}: no fill/hero <img> found`);
  for (const tag of heroes) {
    const srcSet = (tag.match(/srcSet="([^"]+)"/i) || [])[1];
    if (!srcSet || !/\s\d+w/.test(srcSet)) {
      problems.push(`${route}: hero <img> has no srcset: ${tag.slice(0, 120)}`);
      continue;
    }
    const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1] || '';
    if (/^\/images\/(?!_opt\/)/.test(src)) problems.push(`${route}: raw unoptimised src ${src}`);
    const defaultWidth = Number((src.match(/-(\d+)\.webp/) || [])[1] || 0);
    if (defaultWidth > MAX_WIDTH) problems.push(`${route}: default src width ${defaultWidth} exceeds ${MAX_WIDTH}`);
    const candidates = srcSet.split(',').map((c) => c.trim().split(/\s+/)[0].replace(/&amp;/g, '&'));
    for (const candidate of candidates) {
      if (/^https:\/\/cdn\.sanity\.io\//.test(candidate)) {
        if (!/[?&]w=\d+/.test(candidate) || !/[?&]auto=format/.test(candidate)) {
          problems.push(`${route}: Sanity candidate lacks w/auto=format: ${candidate}`);
        }
        continue;
      }
      const res = await fetchRaw(candidate);
      if (res.status !== 200) {
        problems.push(`${route}: srcset candidate ${candidate} answered ${res.status}`);
        continue;
      }
      const type = res.headers.get('content-type') || '';
      if (!/image\/webp/.test(type)) problems.push(`${route}: ${candidate} is ${type}, expected image/webp`);
      const bytes = (await res.arrayBuffer()).byteLength;
      if (bytes > MAX_BYTES) problems.push(`${route}: ${candidate} is ${bytes} bytes, limit ${MAX_BYTES}`);
    }
  }
}
const optimiser = await fetchRaw('/_next/image?url=%2Fimages%2Forchid-purple.jpg&w=1920&q=75');
if (optimiser.status === 200) problems.push('/_next/image answers 200 locally: the custom loader must replace the optimiser');

report(problems, `hero images served via custom loader at ${BASE} with srcset, webp candidates, capped width`);
