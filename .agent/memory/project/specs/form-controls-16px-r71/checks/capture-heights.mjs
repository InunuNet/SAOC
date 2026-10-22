// form-controls-16px-r71: writes goldens/heights-base.json from a render of the UNMODIFIED base (run once at BASE 85cf0814, before any fix; the file is
// then hash-locked). Also prints every control under 16px, which is the inventory the sweep must clear. Usage: FC16_MODES=public,preview node capture-heights.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { goldenJson, specDir } from './_lib.mjs';
import { walk } from './_walk.mjs';

const G = goldenJson('edits.json');
const MODES = (process.env.FC16_MODES ?? 'public,preview').split(',').filter(Boolean);
const target = path.join(specDir, 'goldens', 'heights-base.json');
const out = JSON.parse(readFileSync(target, 'utf8')); // keeps the modes this run does not capture
for (const mode of MODES) {
  const { observations, pages, failures } = await walk(mode);
  if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
  out[mode] = Object.fromEntries(observations.map((o) => [`${o.route}|${o.key}`, o.height]));
  for (const p of pages) console.log(`${mode} ${p.route} status ${p.status} controls ${p.controls}`);
  for (const o of observations.filter((x) => !(x.fontSize >= G.minFontPx))) console.log(`SMALL ${mode} ${o.route} ${o.key} ${o.fontSize}px h=${o.height}`);
}
writeFileSync(target, `${JSON.stringify(out, null, 1)}\n`);
console.log('wrote goldens/heights-base.json');
