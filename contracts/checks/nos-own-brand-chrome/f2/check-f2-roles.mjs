// F2-T3 (R14): computed family / weight / opsz / size on the sampled roles match the mapping, with the mock CSS winning
// where they differ (see goldens/f2/f2-type-hero-spec.md section 2 for every value's citation). All 17 routes, 1280 and 390.
// Roles: hub h1, inner h1, hero lede, hero facts (dt/dd), section h2, h3-h6, buttons, uppercase labels, body root,
// countdown digits, and the catch-all "any Fraunces text pins opsz and uses weight 300/400".
import { lum, parseColor, INK_700, ROYAL, NOS_ROUTES, HUB, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser, snapshotText, describe, opszOf, isFraunces, isKarla, near, expectedH1, expectedH2, expectedHubLede, OPSZ_ALLOWED, HUB_STACK_MAX } from './_f2lib.mjs';

const GOLD_100 = [251, 250, 240];
const GOLD_300 = [232, 230, 194];
const rgbOf = (c) => (/rgb/.test(c) ? c.match(/[\d.]+/g).slice(0, 3).map(Number) : null);
const isLabel = (x) => x.tt === 'uppercase' && x.size <= 14.01; // label-styled headings (FAQ category heads, group labels) are judged by the label rule, R25
const isCardTitle = (x) => /(^|\s)nos-card-title(\s|$)/.test(x.cls ?? ''); // archive card names are h2s judged at the card-title role, not the section-h2 role (NOS Design, 2026-10-16); only this class is exempt
// Symposium presenters (NOS Site session, presenters.css): .pc-title and .pc-name are component titles judged by the catch-all only (Fraunces, pinned opsz from the mock set,
// weight 300|400, headings optical-sizing none); .pc-role keeps the label family/weight rules but not the .12-.18em tracking (it ships .08em). Exact classes only. These are not in
// R14 or the mock; they are listed in the F2 spec section 7 item 13 for NOS Design to ratify or correct.
const isPresenter = (x) => /(^|\s)(pc-title|pc-name)(\s|$)/.test(x.cls ?? '');
const isPresenterRole = (x) => /(^|\s)pc-role(\s|$)/.test(x.cls ?? '');
const sameRgb = (c, want) => { const v = rgbOf(c); return !!v && v.every((x, i) => near(x, want[i], 1)); };

await main('F2-T3 type-roles', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [vpName, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page } = await openPage(browser, vp, route);
        const tag = `${route} @${vpName}`;
        const vw = vp.width;
        const texts = await page.evaluate(snapshotText);
        const root = await page.evaluate(() => {
          const el = document.querySelector('.nos-theme');
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { family: cs.fontFamily, size: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight), weight: Number(cs.fontWeight), color: cs.color };
        });
        const fail = (msg) => r.fail(`${tag}: ${msg}`);

        // body: Karla 400, 1.0625rem (17px), lh 1.65 (index.html:69-79)
        if (!root) fail('no .nos-theme root');
        else {
          if (!/karla/i.test(root.family.split(',')[0])) fail(`.nos-theme body family ${root.family.slice(0, 40)}, want Karla`);
          if (!near(root.size, 17, 0.1)) fail(`.nos-theme body size ${root.size}px, want 17px (1.0625rem)`);
          if (!near(root.lh, 17 * 1.65, 0.6)) fail(`.nos-theme body line-height ${root.lh}px, want 28.05px (1.65)`);
          if (root.weight !== 400) fail(`.nos-theme body weight ${root.weight}, want 400`);
        }

        // hero h1 + lede + facts
        const h1 = texts.find((t) => t.tag === 'h1' && t.hero);
        if (!h1) fail('no h1 inside [data-nos-hero]');
        else {
          const kind = h1.hero;
          const wantKind = route === HUB ? 'hub' : 'inner';
          if (kind !== wantKind) fail(`hero kind "${kind}", want "${wantKind}"`);
          const wantOpsz = kind === 'hub' ? 96 : 24; // index.html:141 (96) vs :249 (24); mapping says 96 for inner, the mock wins
          if (!isFraunces(h1)) fail(`h1 family ${h1.family.slice(0, 40)}, want Fraunces`);
          if (h1.weight !== 300) fail(`h1 weight ${h1.weight}, want 300`);
          if (opszOf(h1.fvs) !== wantOpsz) fail(`h1 opsz ${opszOf(h1.fvs)}, want ${wantOpsz}`);
          if (h1.fos !== 'none') fail(`h1 font-optical-sizing "${h1.fos}", want none`);
          if (!near(h1.size, expectedH1(vw, kind), 0.7)) fail(`h1 size ${h1.size}px, want ${expectedH1(vw, kind).toFixed(1)}px`);
          if (!near(h1.lh, h1.size, 0.6)) fail(`h1 line-height ${h1.lh}px, want 1 (= ${h1.size}px)`);
          if (!near(h1.ls, -0.01 * h1.size, 0.12)) fail(`h1 letter-spacing ${h1.ls}px, want -0.01em (${(-0.01 * h1.size).toFixed(2)}px)`);
          if (!sameRgb(h1.color, GOLD_100)) fail(`h1 colour ${h1.color}, want gold-100 rgb(251,250,240)`);
        }
        const lede = texts.find((t) => t.lede);
        if (lede) {
          if (lede.hero === 'hub') {
            if (!isFraunces(lede) || lede.weight !== 300 || opszOf(lede.fvs) !== 28) fail(`hub lede is ${lede.family.slice(0, 20)} ${lede.weight} opsz ${opszOf(lede.fvs)}, want Fraunces 300 opsz 28`);
            if (!near(lede.size, expectedHubLede(vw), 0.7)) fail(`hub lede size ${lede.size}px, want ${expectedHubLede(vw).toFixed(1)}px`);
            if (!near(lede.lh, lede.size * 1.42, 0.6)) fail(`hub lede line-height ${lede.lh}px, want 1.42`);
          } else if (lede.hero === 'inner') {
            // index.html:250 .ihero-stand: no font-family set (Karla body), 20px (--fs-md), lh 1.6, gold-300; the mapping's serif 28 loses to the CSS.
            if (!isKarla(lede) || !near(lede.size, 20, 0.1) || !near(lede.lh, 32, 0.6)) fail(`inner standfirst is ${lede.family.slice(0, 20)} ${lede.size}px lh ${lede.lh}, want Karla 20px lh 32px`);
            if (!sameRgb(lede.color, GOLD_300)) fail(`inner standfirst colour ${lede.color}, want gold-300 rgb(232,230,194)`);
          }
        }
        for (const t of texts.filter((x) => x.hero === 'hub' && x.tag === 'dt')) {
          // index.html:146 .hero-facts dt: 12px, 600, .16em, uppercase, gold-300 (mapping says label 700/.14em; the CSS wins)
          if (!isKarla(t) || t.weight !== 600 || !near(t.size, 12, 0.05) || !near(t.ls, 1.92, 0.1) || t.tt !== 'uppercase') fail(`hero fact label "${t.text}" is ${t.family.slice(0, 16)} ${t.weight} ${t.size}px ls ${t.ls} ${t.tt}, want Karla 600 12px 1.92px uppercase`);
        }
        for (const t of texts.filter((x) => x.hero === 'hub' && x.tag === 'dd')) {
          if (!isKarla(t) || !near(t.size, 16, 0.1)) fail(`hero fact value "${t.text}" is ${t.family.slice(0, 16)} ${t.size}px, want Karla 16px (index.html:147)`);
        }
        // section h2 (index.html:158): Fraunces 400, opsz 48, clamp(2rem,1.5rem+1.6vw,2.4375rem) (closing-band h2 may be larger, <=61px, :231), lh 1.15
        for (const t of texts.filter((x) => x.tag === 'h2' && !x.hero && !x.chrome && !isLabel(x) && !isCardTitle(x) && !isPresenter(x))) {
          if (!isFraunces(t) || t.weight !== 400 || opszOf(t.fvs) !== 48 || t.fos !== 'none') fail(`h2 ${describe(t)} is ${t.family.slice(0, 16)} ${t.weight} opsz ${opszOf(t.fvs)} sizing ${t.fos}, want Fraunces 400 opsz 48, optical-sizing none`);
          if (t.size < expectedH2(vw) - 0.7 || t.size > 61.2) fail(`h2 ${describe(t)} size ${t.size}px outside [${expectedH2(vw).toFixed(1)}, 61.2]`);
          if (!(t.lh <= t.size * 1.2)) fail(`h2 ${describe(t)} line-height ${t.lh}px, want about 1.15`);
        }
        // h2.nos-card-title: card-title role, 1.375rem (22px), lh 1.25, Fraunces 400 opsz 24, optical-sizing none
        for (const t of texts.filter((x) => x.tag === 'h2' && !x.hero && !x.chrome && isCardTitle(x))) {
          if (!isFraunces(t) || t.weight !== 400 || opszOf(t.fvs) !== 24 || t.fos !== 'none' || !near(t.size, 22, 0.1) || !near(t.lh, 27.5, 0.6)) fail(`h2.nos-card-title ${describe(t)} is ${t.family.slice(0, 16)} ${t.weight} opsz ${opszOf(t.fvs)} ${t.size}px lh ${t.lh} sizing ${t.fos}, want Fraunces 400 opsz 24 22px lh 27.5px, optical-sizing none`);
        }
        // card/list titles h3-h6: Fraunces 400, opsz 24 at md (<=22px), 32 at lg (<=28px), 48 above (mapping "nearest role above")
        for (const t of texts.filter((x) => /^h[3-6]$/.test(x.tag) && !x.hero && !x.chrome && !isLabel(x) && !isPresenter(x))) {
          const want = t.size <= 22 ? 24 : t.size <= 28 ? 32 : 48;
          if (!isFraunces(t) || t.weight !== 400 || opszOf(t.fvs) !== want || t.fos !== 'none') fail(`${t.tag} ${describe(t)} (${t.size}px) is ${t.family.slice(0, 16)} ${t.weight} opsz ${opszOf(t.fvs)} sizing ${t.fos}, want Fraunces 400 opsz ${want}, optical-sizing none`);
        }
        // buttons (index.html:101-107): Karla 700, .875rem (14px), .12em, uppercase, min-height 50px
        for (const t of texts.filter((x) => x.button)) {
          if (!isKarla(t) || t.weight !== 700 || !near(t.size, 14, 0.1) || t.tt !== 'uppercase' || !near(t.ls, 1.68, 0.1)) fail(`button ${describe(t)} is ${t.family.slice(0, 16)} ${t.weight} ${t.size}px ls ${t.ls} ${t.tt}, want Karla 700 14px 1.68px uppercase`);
        }
        const btns = await page.evaluate(() => [...document.querySelectorAll('[data-nos-button]')].filter((e) => e.getClientRects().length).map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 30), h: e.getBoundingClientRect().height })));
        for (const b of btns) if (b.h < 49.5) fail(`button "${b.t}" is ${b.h.toFixed(1)}px tall, want >= 50px (index.html:103)`);
        // uppercase labels (eyebrows, group heads, chips): Karla 600|700, 12-14px, tracking .12-.18em. Chrome (F1) and buttons excluded.
        for (const t of texts.filter((x) => x.tt === 'uppercase' && !x.chrome && !x.button && !['input', 'textarea', 'select', 'button'].includes(x.tag) && x.size <= 14.01)) {
          if (!isKarla(t) || ![600, 700].includes(t.weight)) fail(`label ${describe(t)} is ${t.family.slice(0, 16)} ${t.weight}, want Karla 600|700`);
          const em = t.ls / t.size;
          if ((em < 0.115 || em > 0.185) && !isPresenterRole(t)) fail(`label ${describe(t)} tracking ${em.toFixed(3)}em, want .12-.18em (mapping .14em; mock .12-.16em)`);
        }
        // .font-mono (R25): no mono family anywhere; the class maps to the label role, Karla 700 12px .14em uppercase
        const monos = await page.evaluate(() => [...document.querySelectorAll('.font-mono')].filter((e) => e.getClientRects().length).map((e) => { const cs = getComputedStyle(e); return { t: (e.textContent ?? '').trim().slice(0, 30), fam: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), w: Number(cs.fontWeight), size: parseFloat(cs.fontSize), ls: parseFloat(cs.letterSpacing), tt: cs.textTransform }; }));
        for (const m of monos) {
          if (!/karla/i.test(m.fam) || m.w !== 700 || !near(m.size, 12, 0.05) || !near(m.ls, 1.68, 0.1) || m.tt !== 'uppercase') fail(`.font-mono "${m.t}" is ${m.fam} ${m.w} ${m.size}px ls ${m.ls} ${m.tt}, want Karla 700 12px 1.68px (.14em) uppercase`);
        }
        // .prose p (R25 / ruling Q5): ink-700, never the royal heading colour
        const proseBad = await page.evaluate(() => [...document.querySelectorAll('.nos-theme .prose p')].filter((e) => e.getClientRects().length && !e.closest('[data-nos-hero]')).map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 30), c: getComputedStyle(e).color })));
        for (const b of proseBad) if (!sameRgb(b.c, INK_700)) fail(`.prose p "${b.t}" colour ${b.c}, want ink-700 rgb(58,54,84)`);
        // countdown (ruling 2026-10-15 Q2): digits numerals role at 42px; TBC state Fraunces 300 opsz 24 at 24px; unit labels the label role
        for (const t of texts.filter((x) => /^countdown-.*-value$/.test(x.heroText))) {
          if (!isFraunces(t) || t.weight !== 300 || opszOf(t.fvs) !== 72 || !/lining-nums/.test(t.fvn) || !/tabular-nums/.test(t.fvn) || !near(t.size, 42, 0.1)) fail('countdown digit "' + t.text + '" is ' + t.family.slice(0, 16) + ' ' + t.weight + ' opsz ' + opszOf(t.fvs) + ' ' + t.size + 'px ' + t.fvn + ', want Fraunces 300 opsz 72 lining-nums tabular-nums 42px');
        }
        for (const t of texts.filter((x) => x.heroText === 'countdown-tbc')) {
          if (!isFraunces(t) || t.weight !== 300 || opszOf(t.fvs) !== 24 || !near(t.size, 24, 0.1)) fail('countdown TBC is ' + t.family.slice(0, 16) + ' ' + t.weight + ' opsz ' + opszOf(t.fvs) + ' ' + t.size + 'px, want Fraunces 300 opsz 24 24px');
        }
        for (const t of texts.filter((x) => /^countdown-.*-unit$/.test(x.heroText))) {
          if (!isKarla(t) || t.weight !== 700 || !near(t.size, 12, 0.05) || !near(t.ls, 1.68, 0.1) || t.tt !== 'uppercase') fail('countdown unit "' + t.text + '" is ' + t.family.slice(0, 16) + ' ' + t.weight + ' ' + t.size + 'px ls ' + t.ls + ' ' + t.tt + ', want Karla 700 12px 1.68px (.14em) uppercase');
        }
        // colour (ruling 2026-10-15 Q5): body copy ink-700 #3A3654; headings h1-h3 outside heroes stay royal #211A57 (light headings on dark grounds skipped)
        if (root && !sameRgb(root.color, INK_700)) fail('.nos-theme body colour ' + root.color + ', want ink-700 rgb(58,54,84)');
        for (const t of texts.filter((x) => x.tag === 'p' && !x.hero && !x.chrome && !x.button)) {
          const c = parseColor(t.color);
          if (c && c.a === 1 && c.rgb.every((v, i) => near(v, ROYAL[i], 2))) fail('paragraph ' + describe(t) + ' is still royal ' + t.color + '; body copy is ink-700 rgb(58,54,84) (explicit alpha, muted and on-dark colours are exempt)');
        }
        for (const t of texts.filter((x) => /^h[1-3]$/.test(x.tag) && !x.hero && !x.chrome && !isLabel(x))) {
          const c = parseColor(t.color);
          if (c && lum(c.rgb) < 0.3 && !c.rgb.every((v, i) => near(v, ROYAL[i], 2))) fail(t.tag + ' ' + describe(t) + ' colour ' + t.color + ', want royal rgb(33,26,87)');
        }
        // catch-all: any Fraunces text pins opsz from the mock's set, optical sizing off, weight 300|400
        for (const t of texts.filter((x) => isFraunces(x) && !x.chrome)) {
          // optical-sizing none is required on headings only; the mock's .hero-lede (index.html:143) pins opsz through font-variation-settings and leaves font-optical-sizing at auto
          if ((/^h[1-6]$/.test(t.tag) && t.fos !== 'none') || !OPSZ_ALLOWED.includes(opszOf(t.fvs)) || ![300, 400].includes(t.weight)) fail(`Fraunces text ${describe(t)} has weight ${t.weight}, opsz ${opszOf(t.fvs)}, optical-sizing ${t.fos}; want 300|400, opsz in {${OPSZ_ALLOWED}}, headings optical-sizing none`);
        }
        await ctx.close();
      }
    }
  });
});
