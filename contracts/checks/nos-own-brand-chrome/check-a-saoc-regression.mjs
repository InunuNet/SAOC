// A: SAOC header / footer / mobile-menu markup on /, /about, /societies, /contact is byte-identical
// to base c0e48c39 (goldens/f1/saoc-base/, captured from the base build).
import { readFileSync } from 'node:fs';
import { GOLDEN_DIR, main } from './_lib.mjs';
import { captureAll } from './capture-saoc-base.mjs';

await main('A saoc-regression', async (r) => {
  const now = await captureAll();
  for (const [name, body] of Object.entries(now)) {
    const want = readFileSync(`${GOLDEN_DIR}/saoc-base/${name}`, 'utf8');
    if (body === want) continue;
    let i = 0;
    while (i < want.length && body && body[i] === want[i]) i++;
    r.fail(`${name} differs from base at byte ${i}: base "${want.slice(Math.max(0, i - 40), i + 60)}" vs now "${(body ?? '').slice(Math.max(0, i - 40), i + 60)}"`);
  }
});
