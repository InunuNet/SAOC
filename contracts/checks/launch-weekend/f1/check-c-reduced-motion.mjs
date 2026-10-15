#!/usr/bin/env node
// A3 — prefers-reduced-motion. Under emulated `reduce` no element or pseudo-element has a non-trivial
// transition or animation duration, no infinite animation runs, and nothing sets scroll-behavior: smooth.
// Control: under `no-preference` motion is NOT globally removed (transition count >= the golden baseline
// captured on the untouched tree; scroll-behavior unchanged), so the guard is scoped to the preference.
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f1/check-c-reduced-motion.mjs
import { BASE, VIEWPORTS, launch, newPage, open, loadGolden, report } from './_lib.mjs';

const ROUTES = ['/', '/societies', '/about', '/events', '/national-show', '/national-show/tickets'];
const EPSILON_S = 0.001;
const problems = [];
const golden = loadGolden('motion-baseline.json');
const vp = VIEWPORTS[1];

const measure = () => {
  const secs = (v) => v.split(',').map((s) => { s = s.trim(); return s.endsWith('ms') ? parseFloat(s) / 1000 : parseFloat(s) || 0; });
  const offenders = [];
  let transitioning = 0;
  const smooth = [];
  for (const el of [document.documentElement, ...document.querySelectorAll('body, body *')]) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      const td = Math.max(...secs(cs.transitionDuration)), ad = Math.max(...secs(cs.animationDuration));
      const named = cs.animationName !== 'none';
      if (td > EPSILON_S && cs.transitionProperty !== 'none') offenders.push(`${el.tagName.toLowerCase()}${pseudo || ''} transition ${cs.transitionDuration}`);
      if (named && ad > EPSILON_S) offenders.push(`${el.tagName.toLowerCase()}${pseudo || ''} animation ${cs.animationName} ${cs.animationDuration}`);
      if (named && cs.animationIterationCount === 'infinite') offenders.push(`${el.tagName.toLowerCase()}${pseudo || ''} infinite animation ${cs.animationName}`);
      if (td > EPSILON_S && cs.transitionProperty !== 'none') transitioning++;
      if (!pseudo && cs.scrollBehavior === 'smooth') smooth.push(el.tagName.toLowerCase());
    }
  }
  const running = document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).length;
  return { offenders: [...new Set(offenders)].slice(0, 8), transitioning, smooth, running };
};
const EPS_SRC = `const EPSILON_S = ${EPSILON_S};`;

const browser = await launch();
for (const route of ROUTES) {
  for (const mode of ['reduce', 'no-preference']) {
    const { ctx, page } = await newPage(browser, vp, { reducedMotion: mode });
    await open(page, route);
    const m = await page.evaluate(`(() => { ${EPS_SRC} return (${measure})(); })()`);
    if (mode === 'reduce') {
      if (m.offenders.length) problems.push(`reduce ${route}: motion not neutralised: ${m.offenders.join('; ')}`);
      if (m.smooth.length) problems.push(`reduce ${route}: scroll-behavior smooth on ${m.smooth.join(',')}`);
      if (m.running) problems.push(`reduce ${route}: ${m.running} infinite animation(s) running`);
    } else {
      const base = golden.routes[route];
      if (base) {
        if (m.transitioning < base.transitioning) problems.push(`no-preference ${route}: ${m.transitioning} transitioning elements < baseline ${base.transitioning} (motion removed for everyone)`);
        if (m.smooth.length !== base.smooth.length) problems.push(`no-preference ${route}: scroll-behavior smooth set changed (${m.smooth.length} vs baseline ${base.smooth.length})`);
      }
    }
    await ctx.close();
  }
}
// The rule must also hold on a real emulateMedia flip of an already-loaded page (no reload).
{
  const { ctx, page } = await newPage(browser, vp, { reducedMotion: 'no-preference' });
  await open(page, '/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const m = await page.evaluate(`(() => { ${EPS_SRC} return (${measure})(); })()`);
  if (m.offenders.length || m.smooth.length) problems.push(`emulateMedia flip on /: ${[...m.offenders, ...m.smooth].join('; ')}`);
  await ctx.close();
}
await browser.close();
report(problems, `reduced motion neutralised on ${ROUTES.length} routes, preserved under no-preference, at ${BASE}`);
