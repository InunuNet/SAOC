// Golden generator (not a gate): writes the arrow-link baseline JSON from whatever build it runs against. The committed baseline is from the F1d build at 7ee06e9a (text arrows).
// Usage: DC_PROD=1 node measure-arrow-links.mjs <out.json>   (cwd = the build's worktree). Targets that do not render on the fixture build are listed as gaps.
import { writeFileSync } from 'node:fs';
import { withSite } from './lib.mjs';
import { collectArrowLinks } from './lib-arrow-links.mjs';
const out = process.argv[2]; if (!out) throw new Error('usage: measure-arrow-links.mjs <out.json>'); let data;
await withSite(async (site) => { data = await collectArrowLinks(site); });
writeFileSync(out, JSON.stringify({ source: 'F1d build 7ee06e9a (feat/sdc-f1d-lcp), DC_PROD=1 saoc.localhost / nos.localhost, text arrows', targets: data }, null, 1) + '\n');
let rows = 0; for (const [k, v] of Object.entries(data)) { rows += v.links.length; console.log(`${k}: ${v.gap ? 'GAP ' + v.gap : v.links.length}`); } console.log('total rows', rows);
