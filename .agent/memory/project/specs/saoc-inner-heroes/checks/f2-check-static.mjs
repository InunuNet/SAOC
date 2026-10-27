// Static rules for contract-f2 (HM-5, HM-6 (b), HM-7, HM-8, draft notice), read from the source. Usage: node f2-check-static.mjs
import { existsSync, readFileSync } from 'node:fs';
import { F2 } from './f2-lib.mjs';

const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const compact = (s) => s.replace(/\s+/g, '');

const hero = read('components/ui/PageHero.tsx');
// HM-5: the stops themselves are measured on the computed gradient (f2-gate-scrim-stops.mjs); here only that the old linear ramp is gone.
const SCRIM = compact(hero);
check('PageHero.tsx: the old linear 44%-52% ramp is gone', !/SCRIM_CLEAR_UNTIL\s*=\s*'44%'/.test(hero) && !/SCRIM_FULL_FROM\s*=\s*'52%'/.test(hero));
check('PageHero.tsx: scrim stays display:none below 768 (max-md:hidden)', /max-md:hidden/.test(hero));
// HM-8: the typographic band sizes to its content at >= 1024.
check(`PageHero.tsx carries padding-block ${F2.hm8.paddingBlock} for the typographic band`, SCRIM.includes(compact(F2.hm8.paddingBlock)));

const photos = read('lib/data/saoc-hero-photos.ts');
for (const route of ['/404', '/events/submit']) check(`saoc-hero-photos.ts: ${route} is typographic (HM-7)`, new RegExp(`'${route}':\\s*\\{\\s*typographic:\\s*true`).test(photos));
check("saoc-hero-photos.ts: /events/[slug] keeps its current hero (orchid-dark.jpg 72% 42%) until NOS Design picks (HM-7)", /'\/events\/\[slug\]':\s*\{[^}]*orchid-dark\.jpg[^}]*72% 42%/.test(photos));
check('saoc-hero-photos.ts: /societies/[slug] is typographic (HM-6 (b), NOS Design 2026-10-27)', /'\/societies\/\[slug\]':\s*\{\s*typographic:\s*true/.test(photos));

// Draft notice (NOS Design 2026-10-27): one shared component, imported by /members and /refunds; the old inline markup is gone.
const DN = F2.draftNotice;
check(`${DN.component} exists`, existsSync(DN.component));
for (const f of DN.importedBy) check(`${f} imports the shared DraftNotice`, /from\s+'@\/components\/ui\/DraftNotice'/.test(read(f)));
const members = read('app/(marketing)/members/page.tsx');
check('members/page.tsx: the filled bordered note box is gone (no "border border-rule bg-bone")', !/border border-rule bg-bone/.test(members));
const refunds = read('app/(shared)/refunds/page.tsx');
check('refunds/page.tsx: the inline 14px draft notice is gone (no text-[14px] text-muted on the notice)', !/text-\[14px\]\s+text-muted/.test(refunds));
for (const n of DN.notices) {
  const src = n.route === '/members' ? members : refunds;
  const body = compact(read(DN.component) + src);
  check(`${n.route}: the notice text is verbatim in the source`, body.includes(compact(n.text.replace(n.leadIn, '').trim().replace(/\u2019/g, '&rsquo;'))) || body.includes(compact(n.text.replace(n.leadIn, '').trim())));
}

const css = read('app/globals.css');
const facts = (css.match(/\.hero-facts\s*\{[^}]*\}/) ?? [''])[0];
const cell = (css.match(/\.hero-facts\s*>\s*div\s*\{[^}]*\}/) ?? [''])[0];
check('globals.css: .hero-facts is not centred (justify-content)', facts.length > 0 && !/justify-content:\s*center/.test(facts));
check('globals.css: .hero-facts cells are not centred (align-items, text-align)', cell.length > 0 && !/align-items:\s*center/.test(cell) && !/text-align:\s*center/.test(cell));

if (failures.length) { console.error(`f2-check-static FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('f2-check-static pass');
