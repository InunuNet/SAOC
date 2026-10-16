#!/usr/bin/env node
// A6 - static config pins: images formats/deviceSizes, no unoptimized, Sanity auto=format, layout canonical,
// header keys, and no enforcing CSP key in next.config.ts.
import { readFileSync } from 'node:fs';
import { report } from './_lib.mjs';

const cfg = readFileSync('next.config.ts', 'utf8');
const image = readFileSync('sanity/lib/image.ts', 'utf8');
const layout = readFileSync('app/layout.tsx', 'utf8');
const problems = [];
const need = (ok, msg) => { if (!ok) problems.push(msg); };

need(/formats:\s*\[\s*'image\/avif'\s*,\s*'image\/webp'\s*\]/.test(cfg), "next.config.ts images.formats must be ['image/avif','image/webp']");
const widths = JSON.parse(readFileSync('lib/image-widths.json', 'utf8'));
need(/deviceSizes:\s*imageWidths\.deviceSizes/.test(cfg) && !widths.deviceSizes.includes(3840) && Math.max(...widths.deviceSizes) <= 2048, 'next.config.ts deviceSizes must come from lib/image-widths.json, capped at 2048, no 3840');
need(/loader:\s*'custom'/.test(cfg) && /loaderFile:\s*'\.\/lib\/image-loader\.ts'/.test(cfg), 'next.config.ts must set images.loader custom + loaderFile (App Hosting adapter forces unoptimized otherwise)');
need(!/unoptimized/.test(cfg), 'next.config.ts must not set unoptimized');
need(/async headers\(\)/.test(cfg), 'next.config.ts has no headers()');
need(/Content-Security-Policy-Report-Only/.test(cfg), 'next.config.ts has no Content-Security-Policy-Report-Only');
need(!/key:\s*'Content-Security-Policy'/.test(cfg), "next.config.ts sets an enforcing key 'Content-Security-Policy'");
need(!/Cross-Origin-Opener-Policy/.test(cfg), 'next.config.ts sets COOP');
need(/auto\(\s*'format'\s*\)/.test(image), "sanity/lib/image.ts urlFor must apply .auto('format')");
need(/alternates:\s*\{\s*canonical:\s*'\.\/'\s*\}/.test(layout), "app/layout.tsx metadata needs alternates: { canonical: './' }");
need(/redirects\(\)/.test(cfg) && /events\.ics/.test(cfg), 'existing /events.ics redirect must remain');
report(problems, 'static config pins hold');
