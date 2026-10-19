// nos-critique-r18 F1 static (QA input, hash-locked). Goldens: goldens/f1-edits.json, f1-footprint.json, f1-spec.md.
//   S1  components/tickets/TicketPurchaseForm.tsx equals BASE with exactly the golden edits: aria-live="polite" and aria-atomic="true" leave
//       the [data-catalogue-total] div and go on the Total <p> alone, so the submit button is outside the live region (WCAG 4.1.3).
//   S2  components/tickets/keepsake/TicketCard.tsx equals BASE with exactly lines 43-44 changed: headingLevel becomes 'h3' | 'p' (P3 option a).
//   S2b app/(marketing)/national-show/nos-structure.css equals BASE plus `flex-wrap: wrap;` in the .nos-theme .nk-crumbs rule (f1-spec.md 4).
//   S2c components/tickets/keepsake/TicketsMasthead.tsx equals BASE with the hub's separator + current item wrapped in one span.nk-crumb (amendment).
//   S3  app/(marketing)/tickets/[slug]/page.tsx: BASE with line 191 headingLevel="h2" -> "p", plus insertions only (every other BASE line
//       survives, in order). The insertions carry the hub breadcrumb pattern (nav.nk-crumbs aria-label="Breadcrumb", /national-show,
//       /national-show/tickets, aria-current="page", each nk-sep opening a span.nk-crumb unit) and a breadcrumbJsonLd BreadcrumbList.
//   S4  components/nos/NosHero.tsx: BASE plus insertions only; a `crumbs` prop rendered before the h1.
//   S5  NO INVENTION: no new prose literal in the F1 files that is not already in BASE.
//   S6  docs/nos-critique-r18.md has a "## F1" section.
import { DOC, additions, finish, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f1-static.mjs';
const G = goldenJson('f1-edits.json');
const FP = goldenJson('f1-footprint.json');
const failures = [];

// S1, S2
failures.push(...exactEdits(G.form.file, G.form.lineEdits, G.form.drops, 'S1'));
failures.push(...exactEdits(G.card.file, G.card.lineEdits, G.card.drops, 'S2'));
failures.push(...exactEdits(G.css.file, G.css.lineEdits, G.css.drops, 'S2b'));
failures.push(...exactEdits(G.masthead.file, G.masthead.lineEdits, G.masthead.drops, 'S2c'));

function insertOnly(file, lineEdits, tag) {
  const base = readBaseFile(file);
  const head = readRepoFile(file);
  if (base === null || head === null) return { out: [`${file}: missing at ${base === null ? 'BASE' : 'HEAD'} (${tag})`], head: '' };
  const lines = base.split('\n');
  const out = [];
  for (const e of lineEdits) {
    if (lines[e.line - 1] !== e.from) out.push(`${file}:${e.line}: BASE line is not the golden \`from\` (${tag})`);
    lines[e.line - 1] = e.to;
  }
  const { missing } = additions(head, lines.join('\n'));
  if (missing.length) out.push(`${file}: not BASE (+ golden edits) plus insertions only; lost or changed BASE lines: ${missing.slice(0, 3).map((l) => JSON.stringify(l.trim())).join(', ')} (${tag})`);
  return { out, head };
}

// S3
const page = insertOnly(G.page.file, G.page.lineEdits, 'S3');
failures.push(...page.out);
for (const [what, re] of [
  ['nav.nk-crumbs', /className="nk-crumbs"/],
  ['aria-label="Breadcrumb"', /aria-label="Breadcrumb"/],
  ['a link to /national-show', /href="\/national-show"/],
  ['a link to /national-show/tickets', /href="\/national-show\/tickets"/],
  ['the nk-sep separator', /className="nk-sep"/],
  ['aria-current="page"', /aria-current="page"/],
  ['a breadcrumbJsonLd BreadcrumbList', /breadcrumbJsonLd\(/],
]) if (!re.test(page.head)) failures.push(`${G.page.file}: no ${what} (S3)`);
const seps = (page.head.match(/className="nk-sep"/g) ?? []).length;
const bound = (page.head.match(/<span className="nk-crumb">\s*<span className="nk-sep" aria-hidden="true" \/>/g) ?? []).length;
if (seps !== 2 || bound !== 2) failures.push(`${G.page.file}: ${seps} separators, ${bound} opening a span.nk-crumb unit; want both separators each opening one (S3, amendment)`);
if (/headingLevel="h2"/.test(page.head)) failures.push(`${G.page.file}: the summary card still asks for an h2 (S3)`);

// S4
const hero = insertOnly(G.hero.file, [], 'S4');
failures.push(...hero.out);
if (!/\bcrumbs\?: ReactNode;/.test(hero.head)) failures.push(`${G.hero.file}: no optional \`crumbs?: ReactNode\` prop (S4)`);
const at = hero.head.indexOf('<h1 className="nos-hero-title">');
const copy = at < 0 ? -1 : hero.head.lastIndexOf('<div className="nos-hero-copy">', at);
if (copy < 0 || !/\{crumbs\b/.test(hero.head.slice(copy, at))) failures.push(`${G.hero.file}: {crumbs} is not rendered inside .nos-hero-copy before the h1 (S4)`);

// S5
for (const f of FP) failures.push(...newProse(f, [...FP, 'components/tickets/keepsake/TicketsMasthead.tsx'], { allow: G.allowCopy ?? [] }));

// S6
if (!/^## F1\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F1" section (S6)`);

finish(NAME, failures, 'F1 static: the Total line alone is live, the summary card name is a <p>, the checkout hero carries the hub breadcrumb pattern and BreadcrumbList as insertions only, no new copy, docs F1.');
