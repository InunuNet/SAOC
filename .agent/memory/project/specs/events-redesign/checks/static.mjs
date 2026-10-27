// events-redesign static checks against goldens/ev-spec.md. QA input, hash-locked. Pure text, no build.
import { BASE, addedLines, changedPaths, finish, git, goldenJson, readRepoFile } from './_lib.mjs';

const failures = [];
const need = (rel) => {
  const t = readRepoFile(rel);
  if (t === null) failures.push(`${rel}: missing`);
  return t ?? '';
};
const must = (label, text, re) => { if (!re.test(text)) failures.push(`${label}: expected ${re}`); };
const mustNot = (label, text, re) => { if (re.test(text)) failures.push(`${label}: must not match ${re}`); };

// --- S1 events page: gate, band, list, zero-listed state
const page = need('app/(marketing)/events/page.tsx');
must('events page uses the preview/public gate', page, /withholdPlaceholderProse\(\)/);
must('events page imports ShowBand from the home components', page, /import\s*\{[^}]*\bShowBand\b[^}]*\}\s*from\s*'@\/components\/home/);
must('events page renders <ShowBand', page, /<ShowBand\b/);
must('events page fetches the national show identity', page, /nationalShowQuery/);
must('events page reads the eventsPage singleton', page, /eventsPageQuery/);
must('events page uses lib/events-list', page, /from\s*'@\/lib\/events-list'/);
must('events page passes detailsHref to the band', page, /detailsHref=/);
mustNot('events page has no zero-listed box or invented sentence', page, /No upcoming events scheduled/);
mustNot('events page has no separate featured-card section', page, /Featured events/);
must('events page keeps one JSON-LD Event node per real event', page, /eventJsonLd/);
mustNot('placeholders never feed JSON-LD (events.map keeps the Sanity-only array)', page, /placeholders\.map|listed\.map\([^)]*JsonLd/);
must('events page keeps PageHero eyebrow + h1 (EV-1)', page, /eyebrow="SAOC calendar"[\s\S]*heading="Events"/);
must('events page keeps the lede', page, /Shows, workshops, and council meetings across South Africa's affiliated orchid societies\./);

// --- S2 ShowBand: untouched labels/hrefs; optional override only
const band = need('components/home/ShowBand.tsx');
for (const [label, href] of [['Book tickets', "nosUrl('/tickets')"], ['Show details', "nosUrl('/')"], ['Exhibitor info', "nosUrl('/exhibitors')"]]) {
  must(`ShowBand keeps "${label}"`, band, new RegExp(`>\\s*${label}\\s*<`));
  must(`ShowBand keeps the ${label} default href`, band, new RegExp(href.replace(/[()/']/g, '\\$&')));
}
must('ShowBand has an optional detailsHref prop', band, /detailsHref\?\s*:\s*string/);
must('ShowBand keeps the data-show-band-cta hooks', band, /data-show-band-cta="primary"[\s\S]*data-show-band-cta="secondary"[\s\S]*data-show-band-cta="tertiary"/);

// --- S3 date-only query fix
const queries = need('sanity/queries.ts');
const q = (queries.match(/export const upcomingEventsQuery = defineQuery\(`([\s\S]*?)`\);/) ?? [])[1] ?? '';
must('upcoming query keeps the dateTime filter', q, /dateTime\(coalesce\(endDate, date\)\) >= dateTime\(\$todayStart\)/);
must('upcoming query admits a date-only last day', q, /!defined\(dateTime\(coalesce\(endDate, date\)\)\)\s*&&\s*coalesce\(endDate, date\) >= \$todayDate/);
mustNot('upcoming query never uses now()', q, /now\(\)/);
const sast = need('lib/sast-date.ts');
must('upcomingEventsParams returns todayDate', sast, /todayDate/);

// --- S4 eventsPage.intro (isolated, minimal)
const schema = need('sanity/schemas/documents/eventsPage.ts');
must('eventsPage schema name', schema, /name:\s*'eventsPage'/);
must('eventsPage.intro is portableText', schema, /name:\s*'intro'[^)]*type:\s*'portableText'/);
mustNot('eventsPage schema holds only the intro field', schema, /name:\s*'(?!eventsPage'|intro'|title')[a-zA-Z]+'.*type:/);
const idx = need('sanity/schemas/index.ts');
must('eventsPage imported', idx, /import\s*\{\s*eventsPage\s*\}\s*from\s*'\.\/documents\/eventsPage'/);
must('eventsPage registered', idx, /^\s*eventsPage,\s*$/m);
must('eventsPage is a singleton in the desk', need('sanity/structure.ts'), /'eventsPage'/);
must('eventsPageQuery exists', queries, /export const eventsPageQuery = defineQuery\(`[^`]*_type == "eventsPage"[^`]*intro/);

// --- S5 write-up + actions slot
const about = need('components/events/EventsAbout.tsx');
must('subscribe label is a null constant (COPY GAP)', about, /EVENTS_CALENDAR_SUBSCRIBE_LABEL\s*:\s*string\s*\|\s*null\s*=\s*null/);
must('subscribe button is gated on the constant', about, /EVENTS_CALENDAR_SUBSCRIBE_LABEL\s*(!==\s*null|!=\s*null|\?|&&)/);
must('subscribe href is /api/events.ics', about, /\/api\/events\.ics/);
must('Find your society links to /societies', about, /\/societies/);
must('Find your society label', about, /Find your society/);
must('write-up column is capped at 62ch', about, /max-w-\[62ch\]/);
must('awaiting-copy marker in preview only', about, /ConfirmationBadge/);
must('write-up is gated on the same public/preview switch', about + page, /withholdPlaceholderProse\(\)/);
mustNot('no subscribe label string anywhere', about + page, /['"`]Subscribe[^'"`]*['"`]/);

// --- S6 month h2, event row, controls
const month = need('components/events/MonthGroup.tsx');
const h2 = (month.match(/<h2[^>]*>/) ?? [''])[0];
must('month heading is an h2', month, /<h2\b/);
must('month h2 is serif', h2, /font-serif/);
must('month h2 is 24px', h2, /text-\[24px\]/);
must('month h2 is weight 400', h2, /font-normal/);
mustNot('month h2 is not the mono label', h2, /font-mono|uppercase|text-\[11px\]/);
const row = need('components/events/EventCard.tsx');
must('row is one link to /events/[slug]', row, /<Link[\s\S]*href=\{[^}]*(slug|eventHref)/);
must('row is min-height 44', row, /min-h-11|min-h-\[44px\]/);
must('row shows kind · province', row, /·/);
must('row has the arrow', row, /→/);
must('row host is right-aligned', row, /text-right/);
must('row title underlines on hover and focus', row, /group-hover:underline/);
must('row title underlines on focus-visible', row, /group-focus-visible:underline/);
must('row has a 2px left accent bar', row, /border-l-2|w-0\.5|w-\[2px\]/);
mustNot('row has no hover box, ring or shadow', row, /hover:bg-|hover:shadow|\bring-|focus-visible:ring|focus-visible:outline/);
mustNot('row uses the date block helper, not an inline date build', row, /toLocaleString\('en-ZA', \{ month: 'short'/);
must('row reads the date block from lib/events-list', row, /eventDateBlock/);
must('row keeps the placeholder marker (preview)', row, /PlaceholderMarker/);
const list = need('components/events/EventsList.tsx');
must('EventsList is a client component', list.split('\n').slice(0, 3).join('\n'), /'use client'/);
must('controls gated by showEventControls', list, /showEventControls\(/);
must('controls reuse the handoff labels', list, /All kinds[\s\S]*Month[\s\S]*All months|Month[\s\S]*All months[\s\S]*All kinds/);
must('controls are 44px targets', list, /min-h-11|min-h-\[44px\]/);
must('month select is a native select', list, /<select\b/);
must('components/events index exports the list', need('components/events/index.ts'), /EventsList/);
const link = need('components/events/event-link.ts');
must('event-link shares the national-show predicate', link, /events-list/);

// --- S7 no new copy
const copy = goldenJson('copy.json');
const allowed = new Set(copy.allowed.map((a) => a.text));
const UI = ['app/(marketing)/events/page.tsx', 'components/events/EventCard.tsx', 'components/events/MonthGroup.tsx', 'components/events/EventsList.tsx', 'components/events/EventsAbout.tsx', 'components/home/ShowBand.tsx'];
const seen = (s) => { try { git('grep', '-qF', '--', s, BASE, '--', 'components', 'app', 'lib'); return true; } catch { return false; } };
for (const rel of UI) {
  const text = readRepoFile(rel);
  if (text === null) continue;
  const cands = new Set();
  for (const l of addedLines(rel)) {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('import ')) continue;
    for (const m of t.matchAll(/>([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g)) cands.add(m[1].trim());
    for (const m of t.matchAll(/(["'`])((?:(?!\1)[^\\\n])*)\1/g)) if (/^[A-Z][A-Za-z]{2,}/.test(m[2]) && !/^[A-Z][A-Za-z]*$/.test(m[2]) || /^[A-Z][a-z]{3,}$/.test(m[2])) cands.add(m[2]);
    if (/^[A-Z][A-Za-z ,.'’&·–-]{2,}$/.test(t)) cands.add(t);
  }
  for (const c of cands) if (!allowed.has(c) && !seen(c)) failures.push(`${rel}: new user-visible string ${JSON.stringify(c)} has no source (docs/rules/no-invention.md); add it to goldens/copy.json with a source or remove it`);
}
for (const bad of copy.forbidden) {
  for (const rel of UI) { const t = readRepoFile(rel); if (t && new RegExp(`['"\`>]\\s*${bad}[^'"\`<]*['"\`<]`).test(t)) failures.push(`${rel}: forbidden copy ${JSON.stringify(bad)}`); }
}

// --- S8 docs
const doc = need('docs/events-redesign.md');
for (const re of [/COPY GAP/, /EVENTS_CALENDAR_SUBSCRIBE_LABEL/, /eventsPage\.intro/, /date-only/, /SHOW_PLACEHOLDER_PREVIEW/, /no-invention/, /EV-6|zero-listed|zero listed/i]) must('docs/events-redesign.md', doc, re);

// --- S9 lib module is erasable TypeScript (runs under Node type stripping) and carries the constant
const lib = need('lib/events-list.ts');
must('lib/events-list.ts EVENT_CONTROLS_MIN = 6', lib, /EVENT_CONTROLS_MIN\s*=\s*6\b/);
mustNot('lib/events-list.ts has no path-alias imports (type stripping)', lib, /from\s*'@\//);
mustNot('lib/events-list.ts has no enums or parameter properties', lib, /\benum\s|constructor\s*\(\s*(public|private)/);

finish('static.mjs', failures, `static checks green (${changedPaths().size} changed path(s)).`);
