// F1e (NOS Design arrow ruling, static half): no LITERAL arrow glyph (U+2190-21FF, U+27F0-27FF, U+2794-27BF, U+2900-297F, incl. the north-east arrow) in any source a SAOC route can render: arrows are aria-hidden currentColor SVGs.
// Scope follows the import graph (lib-nos-graph.mjs): NOS chrome and pages are out by path; components/show/ and TicketTypeCard are out only while no SAOC file reaches them, so VenueCard (rendered on /contact and /events/[slug]) is in.
// Admin surfaces (app/admin/, components/admin/) are out of scope (sort and shell glyphs, not the public arrow ruling). Comments are blanked first. A literal must be listed in goldens/arrow-literals.json (file + a `near` substring in the
// 300 characters before it + a reason); an entry matching no hit FAILS as stale. The runtime walks cannot see a link that fixtures do not render (VenueCard's map link needs venue.mapsUrl), so this scan is the gate for those.
import { readFileSync } from 'node:fs';
import { check, finish } from './lib.mjs';
import { buildGraph } from './lib-nos-graph.mjs';
const SPEC = process.env.DC_ARROW_LITERALS || '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/arrow-literals.json';
const allow = JSON.parse(readFileSync(SPEC, 'utf8')).allow; const used = new Set();
const ARROW = /[←-⇿⟰-⟿➔-➿⤀-⥿]/g;
const { files, TXT } = buildGraph(); const scope = files.filter((f) => !f.startsWith('app/admin/') && !f.startsWith('components/admin/')); let hits = 0;
for (const file of scope) { const src = TXT.get(file);
  for (const m of src.matchAll(ARROW)) { hits++; const line = src.slice(0, m.index).split('\n').length; const before = src.slice(Math.max(0, m.index - 300), m.index);
    const i = allow.findIndex((a) => a.file === file && before.includes(a.near)); if (i >= 0) { used.add(i); continue; }
    check(false, `${file}:${line}: literal arrow glyph U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} in SAOC-reachable source (use the aria-hidden currentColor svg): "${src.split('\n')[line - 1].trim().slice(0, 90)}"`); } }
// The allowlisted VenueCard button branch is only unreachable from SAOC while no SAOC file selects it.
for (const file of scope) for (const m of TXT.get(file).matchAll(/mapAction\s*=\s*\{?\s*['"]button['"]/g)) check(false, `${file}: passes mapAction="button" to VenueCard, which selects the branch the arrow allowlist exempts as NOS-only`);
allow.forEach((a, i) => check(used.has(i), `goldens/arrow-literals.json entry ${i + 1} (${a.file} / ${a.near}) matches no literal arrow: stale, remove it`));
console.log(`SAOC-reachable files scanned: ${scope.length}; literal arrows found: ${hits} (allowlisted entries used: ${used.size})`);
finish('arrow-literals-static');
