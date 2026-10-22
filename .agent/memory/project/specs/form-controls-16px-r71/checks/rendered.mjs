// form-controls-16px-r71 rendered: PUBLIC and PREVIEW production builds walked at 390px (_walk.mjs; ports 3010-3019 minus 3002, 3013, 3016). QA input, hash-locked.
// Goldens: goldens/edits.json (routes, width, tolerance) and goldens/heights-base.json (box heights captured from the unmodified base render by capture-heights.mjs).
// Rule under test (Codi, r71): no visible text input, select or textarea computes a font-size below 16px at 390 (iOS zooms the page on focus below 16),
// and the fix changes nothing else: every control's box height equals its base height.
//   F1  every visible text-entry control on every walked route computes font-size >= 16px.
//   H1  every control seen at base is still there and keeps its border-box height (within heightTolerancePx).
//   C1  the walk is not empty: each mode walked controls on the form routes (a walker that finds nothing must not pass).
// Admin: /admin/login is real and unauthenticated; the other admin surfaces render through /admin-fixtures (static data, no session). Admin pages that
// need a real session and are not in the fixtures are covered by static.mjs only.
import { finish, goldenJson } from './_lib.mjs';
import { walk } from './_walk.mjs';

const G = goldenJson('edits.json');
const BASE = goldenJson('heights-base.json');
const MODES = (process.env.FC16_MODES ?? 'public,preview').split(',').filter(Boolean);
const MUST_WALK = ['synthetic:/events/submit#SubmitEventForm', '/contact', '/admin/login', '/admin-fixtures/tickets', '/admin-fixtures/vendors?view=fixture-vendor-1'];
const failures = [];
const summary = [];

for (const mode of MODES) {
  const { observations, pages, failures: infra } = await walk(mode);
  failures.push(...infra);
  if (infra.length && observations.length === 0) continue;
  const small = observations.filter((o) => !(o.fontSize >= G.minFontPx));
  for (const o of small) failures.push(`${mode} ${o.route} ${o.key}: computed font-size ${o.fontSize}px, needs >= ${G.minFontPx}px (F1)`);

  const now = new Map(observations.map((o) => [`${o.route}|${o.key}`, o.height]));
  const base = BASE[mode] ?? {};
  for (const [id, h] of Object.entries(base)) {
    if (!now.has(id)) failures.push(`${mode} ${id}: seen at base, not found now (H1)`);
    else if (Math.abs(now.get(id) - h) > G.heightTolerancePx) failures.push(`${mode} ${id}: box height ${now.get(id)}px, base ${h}px (H1)`);
  }
  const walked = new Map(pages.map((p) => [p.route, p]));
  for (const r of MUST_WALK) if (!(walked.get(r)?.controls > 0)) failures.push(`${mode} ${r}: the walk found no visible control (status ${walked.get(r)?.status ?? 'not walked'}) (C1)`);
  summary.push(`${mode}: ${observations.length} controls on ${pages.length} pages`);
}
finish('rendered.mjs', failures, `no visible text control is below ${G.minFontPx}px at ${G.width}, heights equal base (${summary.join('; ')}).`);
