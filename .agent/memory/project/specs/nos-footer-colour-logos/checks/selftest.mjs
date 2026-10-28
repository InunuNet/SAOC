// Bite proof for the browser gates, runnable without a build: the same measurement functions the live gates use (firstFamily,
// requiredPx from _lib.mjs) and the same in-page census walk, driven against fixture pages in headless Chromium. Each "bad" fixture is the
// mutation of its "good" twin and MUST be flagged; each good one MUST pass. Exit 1 if any gate fails to bite or any good fixture is flagged.
import { VALUES, WALK_TEXT_NODES, firstFamily, launchChromium, requiredPx } from './_lib.mjs';

const results = [];
const expect = (name, ok) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };

// 1. Pure functions.
expect('firstFamily strips next/font hash', firstFamily('__Karla_7a1b2c, "Karla", sans-serif') === 'karla');
expect('firstFamily strips fallback suffix', firstFamily('"__Fraunces_Fallback_9f8e7d", serif') === 'fraunces');
expect('firstFamily sees Manrope', firstFamily('Manrope, system-ui') === 'manrope');
expect('firstFamily sees Lora behind a hash', firstFamily('__Lora_3c4d5e6f, Times New Roman') === 'lora');
expect('requiredPx 248 box at 3x needs 744', requiredPx({ fit: 'fill', boxW: 248, boxH: 218, srcW: 3272, srcH: 2876, dpr: 3 }).required === 744);
expect('requiredPx 206 box at 3x needs 618', requiredPx({ fit: 'fill', boxW: 206, boxH: 165, srcW: 1915, srcH: 1531, dpr: 3 }).required === 618);

// 2. Census walk on fixture pages (the walk is WALK_TEXT_NODES from _lib.mjs, the one census-fonts.mjs runs).
const page = (labelFont, credit) => `<html><body style="font-family: Karla, sans-serif"><h1 style="font-family: Fraunces, serif">Show</h1><footer id="nf"><label style="font-family:${labelFont}">Newsletter</label>${credit}<p style="display:none;font-family:Lora">hidden</p></footer></body></html>`;
const offenders = (nodes) => nodes.map((n) => firstFamily(n.fontFamily)).filter((f) => !VALUES.allowedFirstFamilies.includes(f));

const browser = await launchChromium();
try {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.setContent(page('Karla, sans-serif', '<a>Plain credit</a>'));
  expect('census passes on the good page (hidden Lora ignored)', offenders(await p.evaluate(WALK_TEXT_NODES)).length === 0);
  await p.setContent(page('Manrope, sans-serif', '<a>Plain credit</a>'));
  expect('census bites on a Manrope footer label (the TYPE-11 bug)', offenders(await p.evaluate(WALK_TEXT_NODES)).join() === 'manrope');
  await p.setContent(page('Karla, sans-serif', '<a style="font-family: Lora, serif">South African Orchid Council</a><span style="font-family:\'JetBrains Mono\'">TAGLINE</span>'));
  expect('census bites on live Lora and JetBrains Mono credit text', offenders(await p.evaluate(WALK_TEXT_NODES)).join() === 'lora,jetbrains mono');

  // 3. Served-px gate on fixture imgs: a 248 box at 3x with a 640 candidate is SHORT, with a 750 candidate is ok.
  const served = async (candidateW) => {
    await ctx.setExtraHTTPHeaders({});
    const pg = await ctx.newPage();
    await pg.setViewportSize({ width: 390, height: 800 });
    const dataUrl = await pg.evaluate((w) => { const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * 2876 / 3272); return c.toDataURL('image/png'); }, candidateW);
    await pg.setContent(`<img id="i" src="${dataUrl}" style="display:block;width:248px;height:auto">`);
    const m = await pg.evaluate(async () => { const i = document.getElementById('i'); await i.decode(); const b = i.getBoundingClientRect(); return { boxW: b.width, boxH: b.height, srcW: i.naturalWidth, srcH: i.naturalHeight }; });
    await pg.close();
    return m.srcW >= requiredPx({ fit: 'fill', ...m, dpr: 3 }).required;
  };
  expect('served-px gate passes a 750 candidate for the 248 box at 3x', await served(750));
  expect('served-px gate bites a 640 candidate for the 248 box at 3x (the LG-1 under-serve)', !(await served(640)));
} finally { await browser.close(); }
const bad = results.filter((r) => !r.ok);
if (bad.length) { console.error(`selftest FAILED: ${bad.map((r) => r.name).join('; ')}`); process.exit(1); }
console.log('selftest pass');
