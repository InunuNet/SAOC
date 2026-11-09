// Static checks for the NOS home restore: the sourced module carries her strings verbatim and nothing else, the page no longer needs Sanity for them,
// and no editorial note or invented copy is in the source. Run from the repo root.
import { readFileSync, existsSync } from 'node:fs';
import { parseLanding, EDITORIAL_NOTES, SPEC } from './landing-strings.mjs';

const MODULE = 'lib/data/nos-home-landing.ts'; const PAGE = 'app/(nos)/national-show/page.tsx';
const fails = []; const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) fails.push(name); };
const L = parseLanding(); const inv = JSON.parse(readFileSync(`${SPEC}/goldens/invented-copy.json`, 'utf8')).banned;
check(`${MODULE} exists`, existsSync(MODULE)); if (!existsSync(MODULE)) process.exit(1);
const mod = readFileSync(MODULE, 'utf8'); const page = readFileSync(PAGE, 'utf8'); const flat = (s) => s.replace(/\s+/g, ' ');
// Quote style is the dev's; match each string inside any of ' " ` literals, JSON-escaped or not.
const inSrc = (src, s) => [s, s.replace(/'/g, "\\'"), s.replace(/"/g, '\\"'), JSON.stringify(s).slice(1, -1)].some((v) => flat(src).includes(flat(v)));
// The figures strip is removed (Brad 2026-11-09, her note item 3): L.figures is still parsed but no longer wanted; their absence is asserted below.
const wanted = [L.tagline, L.para1, L.para2, L.groupsHeading, L.plantEntryHeading, L.startPlanning, L.registerHere, L.cta,
  ...L.groups.flatMap((g) => [g.name, ...(g.description ? [g.description] : []), ...g.italics]), ...L.stages.flatMap((s) => [s.title, s.description])];
const missing = wanted.filter((s) => !inSrc(mod, s)); check(`module carries every restored string verbatim (${wanted.length} strings; missing: ${missing.slice(0, 3).join(' | ') || 'none'})`, missing.length === 0);
const figLabels = L.figures.map((f) => f.slice(f.indexOf(' ') + 1)); const figLeft = figLabels.filter((t) => new RegExp(`(['"\`])${t}\\1`).test(mod));
check(`the figures strip is gone from ${MODULE} (Brad 2026-11-09): no LANDING_FIGURES / LandingFigure, no quoted ${figLabels.join(' / ')} label (left: ${figLeft.join(' | ') || 'none'})`, !/LANDING_FIGURES|LandingFigure/.test(mod) && figLeft.length === 0);
check('the page renders no [data-hm-figure] and does not import LANDING_FIGURES (Brad 2026-11-09)', !/data-hm-figure|LANDING_FIGURES/.test(page));
const noDesc = L.groups.filter((g) => g.description === null).map((g) => g.name);
check(`groups with no description in her doc (${noDesc.join(', ')}) carry null/absent, not filler`, noDesc.every((n) => !new RegExp(`${n}[^\\n]{0,80}description:\\s*['"\`][^'"\`]`).test(mod)));
const notes = EDITORIAL_NOTES.filter((n) => flat(mod + page).includes(n)); check(`no editorial note in the module or the page (${notes.join(' | ') || 'none'})`, notes.length === 0);
const old = inv.filter((n) => flat(mod + page).includes(n)); check(`no invented copy in the module or the page (${old.join(' | ') || 'none'})`, old.length === 0);
check('page imports the sourced module', /from ['"]@\/lib\/data\/nos-home-landing['"]/.test(page));
check('page does not re-read showClass or showExhibitorStep from Sanity', !/showClassesQuery|showExhibitorStepsQuery|lib\/data\/showClasses|exhibitorStages/.test(page));
check('page has no dead Register Here link (no href="#" or empty href anywhere in the page)', !/href=["']#?["']/.test(page));
check('page uses StatusMarker for the missing form', /StatusMarker|ConfirmationBadge/.test(page));
const sw = readFileSync(`${SPEC}/goldens/sources/landing-page-v1.0.md`, 'utf8'); const orphanNotes = EDITORIAL_NOTES.filter((n) => !sw.includes(n)); check(`every banned editorial note is really in her doc (stale: ${orphanNotes.join(' | ') || 'none'})`, orphanNotes.length === 0);
process.exit(fails.length ? 1 : 0);
