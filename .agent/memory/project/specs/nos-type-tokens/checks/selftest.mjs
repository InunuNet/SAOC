// Proves the gate's own arithmetic before anything is built: the clamps reproduce the ruling's section 1 table, the weight band, the contrast numbers, the label tuples.
import { readFileSync } from 'node:fs';
import { clampPx, wantWeight, contrast, opszOf, labelKind } from './type-rules.mjs';
import { fileURLToPath } from 'node:url';
const V = JSON.parse(readFileSync(fileURLToPath(new URL('../goldens/values.json', import.meta.url)), 'utf8'));
const bad = [];
const eq = (name, got, want, tol = 0.5) => { if (!(Math.abs(got - want) <= tol)) bad.push(`${name}: got ${got}, want ${want}`); };
// NOS Design section 1 table: [role, 390, 1440, 2056]
const table = { display: [40, 72, 84], h2: [32, 40, 44], name: [32, 36, 38], h3: [22, 25, 26], title: [20, 22, 22], standfirst: [20, 23, 24], body: [16, 17.3, 18], meta: [14, 15, 15], heroLedeHub: [20, 24, 26], themeLine: [20, 26, 28], heroFactDd: [20, 22, 23.2] };
// heroFactDd: NOS Design answer 2 - the clamp is kept, 20 / 22 / 23.2 at 390 / 1440 / 2056; 24 is only the cap.
for (const [role, [a, b, c]] of Object.entries(table)) { eq(`${role}@390`, clampPx(V.clamps[role], 390), a); eq(`${role}@1440`, clampPx(V.clamps[role], 1440), b); eq(`${role}@2056`, clampPx(V.clamps[role], 2056), c); }
// NOS Design answer 5: no Fraunces role clamp may straddle a band edge. Evaluated at 390, 1440, 2056 and at the clamp's own min and max, every size must map to the role's weight.
for (const [role, k] of Object.entries(V.clamps)) {
  if (!k.fraunces) continue;
  for (const size of [clampPx(k, 390), clampPx(k, 1440), clampPx(k, 2056), k.min, k.max]) {
    if (wantWeight(size, V.weightBand) !== k.weight) bad.push(`${role}: size ${size.toFixed(2)} is in the ${wantWeight(size, V.weightBand)} band but the role weight is ${k.weight}; raise the floor to 32 instead of switching weight`);
  }
}
if (!(V.clamps.heroFactDd.expect && Math.abs(clampPx(V.clamps.heroFactDd, 2056) - V.clamps.heroFactDd.expect['2056']) <= V.clamps.heroFactDd.expect.tolPx)) bad.push('heroFactDd expect');
eq('W 31.99', wantWeight(31.99, V.weightBand), 400, 0); eq('W 32', wantWeight(32, V.weightBand), 300, 0); eq('W 20', wantWeight(20, V.weightBand), 400, 0); eq('W 19.99', wantWeight(19.99, V.weightBand), 500, 0);
eq('olive on bone', contrast('rgb(106, 104, 41)', 'rgb(251, 250, 240)'), 5.53, 0.05);
eq('old numeral', contrast('rgb(127, 125, 51)', 'rgb(251, 250, 240)'), 4.10, 0.05);
eq('ratio 1440', clampPx(V.clamps.standfirst, 1440) / clampPx(V.clamps.body, 1440), 1.33, 0.02);
eq('opsz', opszOf('"opsz" 72'), 72, 0); if (opszOf('normal') !== null) bad.push('opsz normal should be null');
const L = V.labels;
const node = (o) => ({ size: 14, wt: '600', ls: 'normal', tt: 'none', ...o });
if (labelKind(node({}), L) !== 'label') bad.push('Label tuple');
if (labelKind(node({ wt: '500' }), L) !== 'formLabel') bad.push('Form label tuple');
if (labelKind(node({ wt: '700', ls: '1.68px', tt: 'uppercase' }), L) !== 'caps') bad.push('Caps 14 tuple');
if (labelKind(node({ size: 13, wt: '700', ls: '1.56px', tt: 'uppercase' }), L) !== null) bad.push('Caps 13 must not pass: caps are 14 everywhere');
if (labelKind(node({ size: 12, wt: '600', ls: '1.68px', tt: 'uppercase' }), L) !== null) bad.push('12px tracked caps must not pass');
if (labelKind(node({ size: 14.5 }), L) !== null) bad.push('14.5px label must not pass');
if (bad.length) { console.error(`selftest FAILED:\n- ${bad.join('\n- ')}`); process.exit(1); }
console.log('selftest pass');
