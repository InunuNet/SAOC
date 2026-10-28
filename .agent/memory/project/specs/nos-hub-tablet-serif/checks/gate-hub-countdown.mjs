// P1 countdown gate (NOS Design, 2026-10-27): the "Opens in" label must never render without its countdown value. Usage: node gate-hub-countdown.mjs after build.sh.
// Fixture replay only. At 768@2 and 820@2, in preview and public mode:
//   1. server paint: with JavaScript disabled (the HTML as first painted) the label is never visible without a visible value beside it;
//   2. from the first frame of a normal load, through hydration and a settle window, a sampler (MutationObserver plus every animation frame) records every state in which the
//      label is visible and no visible, non-empty value is in the same block; there must be none and the sampler must have seen the label;
//   3. the page hydrates and the value shows (so a shot taken after settleCountdown is never the label alone).
import { VALUES, fixtureProof, launchChromium, newContext, settleCountdown, startServer, waitReady, withServer } from './_lib.mjs';
import { labelWithoutValue } from './header-verdict.mjs';

const C = VALUES.hub.countdown;
const PUBLIC_OFFSET = 11;

// Evaluated in the page: is the label shown, and does a shown, non-empty value sit in its block?
const STATE = ({ label, value }) => {
  const shown = (el) => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility === 'visible' && Number(cs.opacity) > 0 && b.width > 0 && b.height > 0; };
  const l = document.querySelector(label);
  const labelShown = Boolean(l) && shown(l) && [...(function* up(n) { for (; n; n = n.parentElement) yield n; })(l)].every((a) => getComputedStyle(a).display !== 'none' && getComputedStyle(a).visibility !== 'hidden' && Number(getComputedStyle(a).opacity) > 0);
  const block = l ? l.parentElement : null;
  const v = block ? [...block.querySelectorAll(value)] : [];
  const valueShown = v.some((el) => (el.textContent ?? '').trim() !== '' && shown(el) && Number(getComputedStyle(el).opacity) > 0);
  return { label: labelShown, value: valueShown };
};

const SAMPLER = ({ label, value, state }) => {
  const fn = new Function('arg', `return (${state})(arg);`);
  window.__cdStates = [];
  window.__cdSeenLabel = false;
  const sample = () => {
    const s = fn({ label, value });
    if (s.label) window.__cdSeenLabel = true;
    if (s.label && !s.value && window.__cdStates.length < 50) window.__cdStates.push({ at: Math.round(performance.now()), ...s });
  };
  new MutationObserver(sample).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  const tick = () => { sample(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};

async function checkMode(server, mode, browser, c) {
  const arg = { label: C.labelSelector, value: C.valueSelector };
  for (const vp of C.viewports) {
    const tag = `[${mode} ${vp.name}]`;
    // 1. server paint, JavaScript disabled
    const noJs = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, javaScriptEnabled: false, httpCredentials: { username: 'sandbox', password: 'sandbox-pass' } });
    const nj = await noJs.newPage();
    await nj.goto(`${server.nos}${VALUES.hub.route}`, { waitUntil: 'load' });
    const s0 = await nj.evaluate(new Function('arg', `return (${STATE})(arg);`), arg);
    c.check(`${tag} server paint (no JavaScript): the label is not shown without a value`, labelWithoutValue([s0]).length === 0, JSON.stringify(s0));
    await noJs.close();
    // 2 and 3. hydration timeline
    const context = await newContext(browser, vp);
    const page = await context.newPage();
    await page.addInitScript(SAMPLER, { ...arg, state: STATE.toString() });
    await page.goto(`${server.nos}${VALUES.hub.route}`, { waitUntil: 'commit' });
    c.check(`${tag} the page hydrated and the countdown shows a value`, await settleCountdown(page, C.settleTimeoutMs));
    await page.waitForTimeout(C.sampleWindowMs);
    const seen = await page.evaluate(() => window.__cdSeenLabel);
    const viol = await page.evaluate(() => window.__cdStates);
    c.check(`${tag} the sampler saw the label`, seen === true);
    c.check(`${tag} no state shows the label without its value (${viol.length} violating state(s))`, labelWithoutValue(viol).length === 0, JSON.stringify(viol.slice(0, 3)));
    await context.close();
  }
}

await withServer(10, 'hub countdown', async (server, c) => {
  const browser = await launchChromium();
  try {
    await checkMode(server, 'preview', browser, c);
    const pub = startServer(PUBLIC_OFFSET, { preview: false });
    try { await waitReady(pub); await checkMode(pub, 'public', browser, c); fixtureProof(pub, c); } finally { pub.proc.kill(); }
  } finally { await browser.close(); }
});
