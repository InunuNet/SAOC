#!/usr/bin/env node
// A2 — target size on SAOC routes at 390 and 1280. Every visible interactive target is >=44x44 CSS px, or is
// exempt under WCAG 2.2 SC 2.5.8: an inline link inside a sentence, or an undersized target (>=24x24) whose
// 24px-diameter circle, centred on its box, intersects no other target and no other undersized target's circle.
// Named strict targets (the audit's offenders) must meet 44px outright, no exception:
//   /societies province chips (>=44 tall), every viewport.
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f1/check-b-targets.mjs
import { BASE, VIEWPORTS, SAOC_ROUTES, launch, newPage, open, loadGolden, resolveRoute, report, collectTargetsInPage } from './_lib.mjs';

const MIN = 44;
const SPACING_MIN = 24;
const { societySlug } = loadGolden('identity-baseline.json');
const problems = [];

const browser = await launch();
for (const vp of VIEWPORTS) {
  for (const route of SAOC_ROUTES) {
    const path = resolveRoute(route, societySlug);
    const { ctx, page } = await newPage(browser, vp);
    await open(page, path);
    const result = await page.evaluate((src) => {
      const collect = eval('(' + src + ')');
      const ts = collect();
      const desc = (e) => e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label').slice(0, 24)}]` : '') + ':' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      const related = (a, b) => a.contains(b) || b.contains(a);
      const circ = (t) => ({ cx: t.x + t.w / 2, cy: t.y + t.h / 2, r: SP / 2 });
      const SP = 24;
      const rectCircle = (c, t) => { const dx = Math.max(t.x - c.cx, 0, c.cx - (t.x + t.w)); const dy = Math.max(t.y - c.cy, 0, c.cy - (t.y + t.h)); return dx * dx + dy * dy < c.r * c.r; };
      const under = ts.filter((t) => t.w < 44 || t.h < 44);
      const fails = [];
      for (const t of under) {
        if (t.inline) continue;
        if (t.w < 24 || t.h < 24) { fails.push(`${desc(t.el)} ${t.w.toFixed(0)}x${t.h.toFixed(0)} (<24, no exception possible)`); continue; }
        const c = circ(t);
        const hit = ts.find((o) => o !== t && !related(t.el, o.el) && (rectCircle(c, o) || (o.w < 44 || o.h < 44) && Math.hypot(circ(o).cx - c.cx, circ(o).cy - c.cy) < SP));
        if (hit) fails.push(`${desc(t.el)} ${t.w.toFixed(0)}x${t.h.toFixed(0)} fails spacing exception (24px circle meets ${desc(hit.el)})`);
      }
      const chips = [...document.querySelectorAll('[role="group"][aria-label="Filter by province"] button')];
      const strict = chips.map((b) => { const r = b.getBoundingClientRect(); return { d: desc(b), w: r.width, h: r.height }; });
      return { total: ts.length, under: under.length, fails, strict };
    }, collectTargetsInPage.toString());
    for (const f of result.fails) problems.push(`${vp.name}px ${path}: ${f}`);
    if (path === '/societies') {
      if (!result.strict.length) problems.push(`${vp.name}px ${path}: province chip group not found (selector role=group aria-label="Filter by province")`);
      for (const c of result.strict) if (c.h < MIN || c.w < MIN) problems.push(`${vp.name}px ${path}: province chip ${c.d} ${c.w.toFixed(0)}x${c.h.toFixed(0)} must be >=44x44`);
    }
    console.log(`${vp.name}px ${path}: ${result.total} targets, ${result.under} under 44px, ${result.fails.length} failing`);
    await ctx.close();
  }
}
await browser.close();
report(problems, `all SAOC targets >=44px or 2.5.8-exempt at ${BASE}`);
