#!/usr/bin/env node
// A1 - hero images are served through the optimiser: srcset present, no raw /images/orchid-*.jpg src,
// default src width capped at 2048, modern format on request, resized payload small (runtime, BASE_URL).
import { getPage, fetchRaw, report, BASE } from './_lib.mjs';

const problems = [];
const MAX_WIDTH = 2048;
const MAX_BYTES = 300_000;

for (const route of ['/', '/societies', '/judging']) {
  const { text } = await getPage(route);
  const imgs = [...text.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const heroes = imgs.filter((t) => /orchid-[a-z]+\.jpg/.test(t) || /data-nimg="fill"/.test(t));
  if (heroes.length === 0) problems.push(`${route}: no fill/hero <img> found`);
  for (const tag of heroes) {
    if (!/srcSet="[^"]*\s\d+w/i.test(tag)) problems.push(`${route}: hero <img> has no srcset: ${tag.slice(0, 120)}`);
    const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1] || '';
    if (/^\/images\//.test(src)) problems.push(`${route}: raw unoptimised src ${src}`);
    const w = Number((src.match(/[?&]w=(\d+)/) || [])[1] || 0);
    if (w > MAX_WIDTH) problems.push(`${route}: default src width ${w} exceeds ${MAX_WIDTH}`);
  }
}

const probe = '/_next/image?url=%2Fimages%2Forchid-purple.jpg&w=1920&q=75';
for (const accept of ['image/avif,image/webp,*/*', 'image/webp,*/*']) {
  const res = await fetchRaw(probe, { headers: { accept } });
  if (res.status !== 200) { problems.push(`${probe} answered ${res.status} for Accept ${accept}`); continue; }
  const type = res.headers.get('content-type') || '';
  if (!/image\/(avif|webp)/.test(type)) problems.push(`optimiser returned ${type} for Accept ${accept}`);
  const bytes = (await res.arrayBuffer()).byteLength;
  if (bytes > MAX_BYTES) problems.push(`optimised hero is ${bytes} bytes, limit ${MAX_BYTES}`);
}
const tooWide = await fetchRaw('/_next/image?url=%2Fimages%2Forchid-purple.jpg&w=3840&q=75');
if (tooWide.status === 200) problems.push('w=3840 still accepted: deviceSizes must cap at 2048');

report(problems, `hero images optimised via ${BASE}/_next/image with srcset, modern format, capped width`);
