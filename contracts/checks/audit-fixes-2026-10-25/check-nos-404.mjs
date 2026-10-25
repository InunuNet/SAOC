#!/usr/bin/env node
// NOS 404 structure (NOS Design G6, final): the typographic fallback. NOS black hero, h1 in the serif at
// weight 300 (both come from NosHero's typographic variant, `.nos-hero-type` / `.nos-hero-title`), no photo,
// the existing strings only, under the unified NOS header (NosFrame). Source check; the served-HTML check
// (status, lang, one h1, no photo, NOS copy) is in live-probe.mjs.
import { readFileSync } from 'node:fs';

const FILE = 'app/(nos)/national-show/not-found.tsx';
const GROUP_FILE = 'app/(nos)/not-found.tsx';
const STRINGS = [
  '404 — Page not found',
  'This orchid has left the bench.',
  'The page you’re looking for doesn’t exist or may have moved.',
];
const FORBIDDEN_STRINGS = ['Find a society', 'Go home', 'Start from the home page'];
const problems = [];
const need = (ok, msg) => { if (!ok) problems.push(msg); };

const source = readFileSync(FILE, 'utf8');
const group = readFileSync(GROUP_FILE, 'utf8');
const heroes = readFileSync('components/nos/hero-photos.ts', 'utf8');

need(/from '@\/components\/nos\/NosHero'/.test(source), `${FILE} must render NosHero (typographic variant: NOS black, serif h1 at 300)`);
need(!/next\/image|<Image\b|<img\b/.test(source), `${FILE} must carry no photo`);
for (const s of STRINGS) need(source.includes(s), `${FILE} lost existing string: ${s}`);
for (const s of FORBIDDEN_STRINGS) need(!source.includes(s) && !group.includes(s), `NOS not-found must not use "${s}" (SAOC wording)`);

// The hero route must be one hero-photos.ts has no photo for, or NosHero picks the photo variant.
const route = /<NosHero[\s\S]*?route=["{'`]+([^"}'`]+)/.exec(source)?.[1];
need(Boolean(route), `${FILE}: NosHero has no literal route prop`);
need(!route || !heroes.includes(`'${route}'`), `${FILE}: route ${route} has a photo in hero-photos.ts`);

// The group-level not-found (tickets, vsp) must not fall back to the SAOC photo section.
need(!/from '\.\.\/not-found'/.test(group) && !/NotFoundSection/.test(group), `${GROUP_FILE} still renders the SAOC NotFoundSection (photo, SAOC copy)`);
need(/robots:\s*\{\s*index:\s*false/.test(source), `${FILE} lost robots noindex`);

if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('ok: NOS 404 is the typographic NosHero fallback with the existing strings');
