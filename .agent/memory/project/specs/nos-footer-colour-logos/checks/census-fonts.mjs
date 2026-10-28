// Live gate: the family census. On the NOS host, for /, /faq and /tickets at 1440 and 390, the FIRST family of the computed
// font-family of every rendered text node must be Fraunces or Karla (no Lora, JetBrains Mono, Manrope). Text inside script, style,
// noscript, template, display:none or visibility:hidden is not rendered and is skipped; sr-only text IS rendered and is counted.
import { mkdirSync, writeFileSync } from 'node:fs';
import { OUT, VALUES, WALK_TEXT_NODES, firstFamily, launchChromium, newContext, withServer } from './_lib.mjs';

mkdirSync(OUT, { recursive: true });
const report = {};

await withServer(2, 'NOS family census', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const route of VALUES.nosRoutes) {
      for (const vp of VALUES.viewports) {
        const tag = `[nos ${route} ${vp.name}]`;
        const context = await newContext(browser, vp, 1);
        const page = await context.newPage();
        const res = await page.goto(`${server.nos}${route}`, { waitUntil: 'load' });
        c.check(`${tag} responds 200`, res?.status() === 200, String(res?.status()));
        await page.waitForTimeout(800);
        const nodes = await page.evaluate(WALK_TEXT_NODES);
        c.check(`${tag} text nodes were found`, nodes.length > 20, String(nodes.length));
        c.check(`${tag} footer text nodes were found`, nodes.some((x) => x.inFooter));
        const seen = {};
        for (const nd of nodes) {
          const fam = firstFamily(nd.fontFamily);
          seen[fam] = (seen[fam] ?? 0) + 1;
          c.check(`${tag} "${nd.text}" first family ${fam} is Fraunces or Karla`, VALUES.allowedFirstFamilies.includes(fam), nd.fontFamily);
        }
        report[`${route} ${vp.name}`] = seen;
        await context.close();
      }
    }
  } finally { await browser.close(); }
  writeFileSync(`${OUT}/census.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
});
