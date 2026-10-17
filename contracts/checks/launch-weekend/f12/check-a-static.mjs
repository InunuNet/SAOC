#!/usr/bin/env node
// F12-A1 - code-level facts: the new component and its data, the CSS values R68-R70 name, no 900px template column left, no retyped
// council copy, no new colour literals, no font-size on running copy, legacy ShowSectionNav and the vendor/exhibitor 60ch caps untouched.
import { readFileSync, existsSync } from 'node:fs';
import { COPY, GROUPS, V, baseRef, gitLines } from './_lib.mjs';

const problems = [];
const need = (ok, msg) => { if (!ok) problems.push(msg); };
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : (problems.push(`missing file ${p}`), ''));
const squash = (s) => s.replace(/\s+/g, '');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const NS = 'app/(marketing)/national-show';
const css = stripComments(read(`${NS}/nos-theme.css`) + '\n' + read(`${NS}/nos-structure.css`));

// ---- R68-R70 values that are code-level (stylesheet or Tailwind classes in the owning component; whitespace and underscores ignored) ----
const surface = squash(css + stripComments(read(`${NS}/page.tsx`)) + stripComments(read('components/nos/NosHero.tsx')) + stripComments(read('components/nos/ShowPageProse.tsx')) + stripComments(read('components/show/nos/ShowContentState.tsx')) + stripComments(read('components/nos/NosShowIndex.tsx'))).replace(/_/g, '');
for (const [label, alts] of [
  ['hero title clamp', ['clamp(52px,4.9vw,96px)']],
  ['hero lede 46ch', ['46ch']],
  ['hero facts 4 max-content columns', ['repeat(4,max-content)']],
  ['hero title text-wrap balance', ['text-wrap:balance', 'text-balance']],
  ['symposium lede clamp', ['clamp(22px,2vw,30px)']],
  ['inner hero title clamp', ['clamp(48px,4.4vw,88px)']],
  ['inner hero lede 46ch', ['46ch']],
  ['symposium lede 30ch', ['30ch']],
  ['template 4fr:7fr columns', ['minmax(0,4fr)minmax(0,7fr)']],
]) need(alts.some((a) => surface.includes(a)), `no source carries ${label} (${alts.join(' | ')})`);

// ---- R69 component ----
const idx = read('components/nos/NosShowIndex.tsx');
need(/export\s+function\s+NosShowIndex\b/.test(idx), 'NosShowIndex is not exported from components/nos/NosShowIndex.tsx');
need(/aria-label=["']Explore the show pages["']/.test(idx), 'index is not <nav aria-label="Explore the show pages">');
need(idx.includes(COPY.rulingCopy.indexEyebrow), `index eyebrow "${COPY.rulingCopy.indexEyebrow}" missing`);
for (const h of COPY.rulingCopy.indexGroupHeadings) need(idx.includes(`'${h}'`) || idx.includes(`"${h}"`) || idx.includes(`>${h}<`), `group heading "${h}" missing`);
for (const g of GROUPS.groups) for (const href of g.hrefs) need(idx.includes(`'${href}'`) || idx.includes(`"${href}"`), `index lacks the href literal ${href}`);
need(/aria-current/.test(idx), 'index has no aria-current handling');
need(!/\bhint\b|description/i.test(stripComments(idx)), 'index carries per-item descriptions/hints (R69 drops them)');
need(/<h3\b/.test(idx), 'group headings are not h3');
need(!/ShowSectionNav/.test(idx), 'NosShowIndex must not reuse ShowSectionNav');
const hub = read(`${NS}/page.tsx`);
need(!/NosShowIndex/.test(hub), 'the hub page still renders NosShowIndex (F18 amendment, R74 #2: the Explore index is on the inner routes only)');
need(hub.includes(`'${V.hubHero.h1}'`) || hub.includes(`"${V.hubHero.h1}"`), `hub page lacks the h1 constant "${V.hubHero.h1}"`);
for (const f of gitLines('ls-files', 'app', 'components')) {
  if (!/\.(tsx?|css)$/.test(f) || /components\/show\/ShowSectionNav\.tsx$/.test(f) || f.startsWith('components/show/index.ts')) continue;
  if (f.startsWith(NS) || f.startsWith('components/nos/')) need(!/ShowSectionNav/.test(stripComments(read(f))), `${f} references ShowSectionNav (still dead on NOS routes)`);
}

// ---- R70: no 900px template column, no jump link, no SAOC-Symposium title strings, copy not retyped ----
const TEMPLATE_FILES = ['programme', 'symposium', 'wosa-conference', 'sa-exhibitors', 'international-guests', 'sponsors', 'faq'].map((s) => `${NS}/${s}/page.tsx`)
  .concat(['components/show/nos/ShowContentState.tsx', 'components/nos/ShowPageProse.tsx']);
for (const f of TEMPLATE_FILES) need(!/max-w-\[900px\]/.test(read(f)), `${f} still sets max-w-[900px]`);
// R71: ONE axis token pair, defined once from the header's own tokens; no second container literal left behind
const axisCss = css + '\n' + stripComments(read(`${NS}/presenters.css`));
need(/--nos-axis-max\s*:[^;]*var\(--nc-wide\)[^;]*var\(--nc-gutter\)/.test(axisCss), 'no --nos-axis-max defined from var(--nc-wide) and var(--nc-gutter) (the header container is the single source)');
need(/--nos-axis-pad\s*:\s*var\(--nc-gutter\)/.test(axisCss), 'no --nos-axis-pad defined from var(--nc-gutter)');
need((axisCss.match(/--nos-axis-max\s*:/g) ?? []).length === 1 && (axisCss.match(/--nos-axis-pad\s*:/g) ?? []).length === 1, 'the axis tokens must each be defined exactly once');
need((axisCss.match(/--nc-wide/g) ?? []).length === 1 && (axisCss.match(/--nc-gutter/g) ?? []).length === 2, 'the header tokens may be referenced only by the axis definition (consumers use --nos-axis-*)');
need(!/clamp\(16px,\s*4vw,\s*48px\)/.test(axisCss), 'a second container gutter clamp(16px, 4vw, 48px) is still defined (it must derive from the axis)');
need(/--nos-axis-/.test(stripComments(read(`${NS}/presenters.css`))), 'presenters.css does not use the axis tokens');
need(/--nos-axis-max/.test(css) && (css.match(/--nos-axis-max/g) ?? []).length >= 4, 'the axis token is not consumed by the wrap, hero copy, presenters and index rules (expected 4+ uses)');
const sym = stripComments(read(`${NS}/symposium/page.tsx`));
need(!/PresenterJumpLink/.test(sym), 'symposium page still renders PresenterJumpLink');
for (const line of sym.split('\n')) if (/\btitle\s*:|nosOgImage\(|heroTitle/.test(line)) need(!line.includes(V.symposium.removedTitleText), `symposium title/og line still says "SAOC Symposium": ${line.trim()}`);
need(sym.includes(V.symposium.h1), `symposium page lacks "${V.symposium.h1}"`);
const presentation = read('lib/data/show-page-presentation.ts');
const codeSurface = [sym, stripComments(presentation), stripComments(read('components/show/nos/ShowContentState.tsx')), stripComments(read('components/nos/ShowPageProse.tsx'))].join('\n');
need(codeSurface.includes(COPY.themeLine.text), 'the theme line constant is not present (verbatim) in the symposium page or lib/data/show-page-presentation.ts');
for (const f of [`${NS}/symposium/page.tsx`, 'lib/data/show-page-presentation.ts', 'components/show/nos/ShowContentState.tsx', 'components/nos/ShowPageProse.tsx', 'components/nos/NosShowIndex.tsx', 'components/nos/NosHero.tsx']) {
  const t = existsSync(f) ? readFileSync(f, 'utf8') : '';
  need(!t.includes('Uniting conservation'), `${f} retypes the council's description sentence (it must keep coming from the showPage data)`);
  need(!t.includes(V.symposium.removedLede), `${f} contains the removed Purpose-line lede`);
  for (const q of ['"' + COPY.themeLine.text, '“' + COPY.themeLine.text, '\\"' + COPY.themeLine.text]) need(!t.includes(q), `${f} wraps the theme line in quote characters`);
}
need(/theme|From Wild Origins/i.test(presentation) && /Symposium theme/.test(presentation), 'lib/data/show-page-presentation.ts does not set the "Symposium theme" heading');
need(/drive-source/.test(presentation + sym), 'the theme-line constant does not cite its Drive source path in a comment');
need(/show-page-presentation/.test(read('lib/data/show-pages.ts')), 'lib/data/show-pages.ts does not apply the presentation step');

// ---- F8 / G7 invariants (d) ----
const prose = read('components/nos/ShowPageProse.tsx');
need(/data-nos-content-gap/.test(prose), 'ShowPageProse lost data-nos-content-gap');
need(/nos-show-page-prose/.test(prose), 'ShowPageProse lost the nos-show-page-prose class');
need(/export interface ShowPageProseProps\s*\{\s*section:\s*ShowPageSection;?\s*\}/.test(prose), 'ShowPageProseProps must keep exactly one key (G7)');
need(prose.indexOf('nos-show-page-notice') !== -1 && prose.indexOf('nos-show-page-notice') < prose.indexOf('<h2'), 'ShowPageProse must render the notice before the heading in DOM order');

// ---- the diff: no new colour literal, no font-size on running copy (b), legacy and vendor 60ch files untouched (a) ----
const base = baseRef();
const added = (f) => { try { return gitLines('diff', '-U0', base, '--', f).filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1)); } catch { return []; } };
for (const f of [`${NS}/nos-theme.css`, `${NS}/nos-structure.css`]) {
  for (const l of added(f)) {
    if (/\/\*|^\s*\*/.test(l)) continue;
    need(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsl\(/.test(l), `${f}: added line introduces a colour literal (use the tokens): ${l.trim()}`);
  }
}
const addedCss = [`${NS}/nos-theme.css`, `${NS}/nos-structure.css`].flatMap(added).join('\n');
const blocks = addedCss.split('}');
for (const b of blocks) if (/(\.nos-show-page-prose\s+(p|li)\b|^\s*body\b|\.nos-theme\s+p\b)[^{]*\{[^}]*font-size/m.test(b + '}')) problems.push(`added CSS sets a font-size on running copy (R65 lands separately): ${b.trim().slice(0, 120)}`);
// F18 amendment: /vendors moved onto the F18 long-form template (F18-A1 owns its copy and layout), so only exhibitors stays under the r5 / F17 edit limits.
for (const f of [`${NS}/exhibitors/page.tsx`]) {
  need(/\[&_p\]:max-w-\[60ch\]/.test(read(f)), `${f} lost [&_p]:max-w-[60ch] (r5)`);
  // launch-weekend F17 (R73, G1): the only permitted edits are the event name ("SAOC National Show" -> "National Orchid Show") and the Explore-index mount (NosShowIndex import + element); any other changed word fails.
  const dl = gitLines('diff', '-U0', base, '--', f).filter((l) => /^[-+]/.test(l) && !/^(---|\+\+\+)/.test(l) && !/NosShowIndex/.test(l));
  const flat = (sign) => dl.filter((l) => l[0] === sign).map((l) => l.slice(1)).join(' ').replace(/\bSAOC National (Orchid )?Show\b/g, 'National Orchid Show').replace(/\s+/g, ' ').trim();
  need(flat('-') === flat('+'), `${f} was edited beyond the F17 event-name swap`);
}
need(gitLines('diff', '--name-only', base, '--', 'components/show/ShowSectionNav.tsx').length === 0, 'components/show/ShowSectionNav.tsx was edited (legacy, must stay byte-identical)');

// ---- no SAOC utility bar on NOS pages (v4 decision #2, nos-critique-r6 f9; was Brad 2026-10-16) ----
const bar = read('components/chrome/UtilityBar.tsx');
need(/variant/.test(bar) && /if \(isNos\) return null;/.test(bar), 'UtilityBar.tsx: the nos variant must return null (no utility bar on NOS pages)');
const layout = read('app/(marketing)/layout.tsx');
const nosTop = layout.slice(layout.indexOf('nos={{'));
need(/<UtilityBar[^>]*variant=\{?["']nos["']\}?/.test(nosTop), 'app/(marketing)/layout.tsx does not mount <UtilityBar variant="nos"> in the NOS chrome');
need(nosTop.indexOf('<UtilityBar') !== -1 && nosTop.indexOf('<UtilityBar') < nosTop.indexOf('<NosHeader'), 'the NOS utility bar is not mounted before NosHeader');
for (const f of gitLines('ls-files', 'components/nos-chrome')) if (/\.(tsx?|css)$/.test(f)) need(!/UtilityBar/.test(read(f)), `${f} references UtilityBar (mount it from the marketing layout only)`);

if (problems.length) { console.error(`FAIL F12-A1 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F12-A1 static');
