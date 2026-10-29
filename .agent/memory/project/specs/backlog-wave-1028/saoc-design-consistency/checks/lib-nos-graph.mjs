// Shared NOS import graph for the static checks (check-focus-classes-static.mjs, check-arrow-literals-static.mjs). SEED_EXCLUDED (NOS chrome and pages) is NOS by path; DERIVED_EXCLUDED (components/show/, TicketTypeCard) is NOS
// only while the import graph shows no SAOC file reaches it. Run from the project root.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
export const ROOTS = ['app', 'components']; export const SEED_EXCLUDED = ['components/nos-chrome/', 'components/nos/', 'app/(nos)/']; export const DERIVED_EXCLUDED = ['components/tickets/TicketTypeCard.tsx', 'components/show/'];
export const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === 'node_modules' ? [] : walk(p)) : /\.tsx?$/.test(n) && !/\.(d|test|spec)\.tsx?$/.test(n) ? [p] : []; });
export const blank = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^(\s*)\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length));
export function buildGraph() {
const ALL = [...ROOTS.flatMap(walk)]; const importers = new Map(ALL.map((f) => [f, new Set()])); const TXT = new Map(ALL.map((f) => [f, blank(readFileSync(f, 'utf8'))]));
const resolveImp = (from, spec) => { const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('.') ? join(from, '..', spec) : null; if (!base) return null; for (const c of [base + '.tsx', base + '.ts', join(base, 'index.tsx'), join(base, 'index.ts')]) if (importers.has(c)) return c; return null; };
const barrelMap = (barrel) => { const map = new Map(); const all = new Set(); const t = TXT.get(barrel); for (const m of t.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) { const f = resolveImp(barrel, m[2]); if (!f) continue; for (const n of m[1].split(',')) { const nm = n.trim().split(/\s+as\s+/).pop(); if (nm) map.set(nm, f); } } for (const m of t.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) { const f = resolveImp(barrel, m[1]); if (f) all.add(f); } return { map, all }; };
for (const f of ALL) for (const m of TXT.get(f).matchAll(/import\s+(?:type\s+)?([^;'"]*?)\s*from\s*['"]([^'"]+)['"]|export\s*(?:\{[^}]*\}|\*)\s*from\s*['"]([^'"]+)['"]/g)) {
  if (/\/index\.tsx?$/.test(f) && m[3] !== undefined) continue; // a barrel's own re-exports are not imports: the real importers reach the files by name through it
  if (/^import\s+type\b/.test(m[0])) continue; // type-only imports are erased, they render nothing
  const spec = m[2] ?? m[3]; const t = resolveImp(f, spec); if (!t || t === f) continue;
  if (/\/index\.tsx?$/.test(t) && m[1] !== undefined && /\{/.test(m[1])) { const { map, all } = barrelMap(t); const names = [...m[1].matchAll(/([A-Za-z_$][\w$]*)\s*(?:,|\}|$)/g)].map((x) => x[1]); const hit = new Set(); for (const n of m[1].replace(/[{}]/g, '').split(',')) { if (/^\s*type\s/.test(n)) continue; const nm = n.trim().split(/\s+as\s+/)[0]; if (map.has(nm)) hit.add(map.get(nm)); } if (names.length && hit.size === 0 && all.size === 0) importers.get(t).add(f); for (const h of hit) importers.get(h).add(f); for (const h of all) importers.get(h).add(f); }
  else importers.get(t).add(f);
}
const seedFile = (f) => SEED_EXCLUDED.some((x) => f.startsWith(x)); const derivedCand = (f) => DERIVED_EXCLUDED.some((x) => f.startsWith(x)); const nosOnly = new Set();
for (let changed = true; changed;) { changed = false; for (const [f, imps] of importers) if (!nosOnly.has(f) && !seedFile(f) && imps.size > 0 && [...imps].every((i) => seedFile(i) || nosOnly.has(i))) { nosOnly.add(f); changed = true; } }
const files = ALL.filter((f) => !seedFile(f) && !(derivedCand(f) && (nosOnly.has(f) || importers.get(f).size === 0)));
  return { ALL, TXT, importers, nosOnly, seedFile, derivedCand, files };
}
