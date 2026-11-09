// Rendered checks for the NOS home restore (mission nos-home-restore), run from gate-standard.mjs homeChecks on every viewport.
// Hooks the dev must provide (goldens/block-order.md): data-hm-section on each band; [data-hm-judging-card] x13 ([data-hm-figure] is retired: the figures strip is removed, Brad 2026-11-09);
// [data-hm-stage] x4; [data-hm-register-marker] wrapping the one StatusMarker beside the "Register Here" label.
import { readFileSync } from 'node:fs';
import { parseLanding, norm, EDITORIAL_NOTES, SOURCE, SPEC } from './landing-strings.mjs';

export const LANDING_SOURCE = SOURCE;

export async function homeRestoreChecks(page, vp, c, tag) {
  const L = parseLanding(); const inv = JSON.parse(readFileSync(`${SPEC}/goldens/invented-copy.json`, 'utf8')).banned;
  const m = await page.evaluate(() => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim(); const sec = (k) => document.querySelector(`[data-hm-section="${k}"]`); const main = document.querySelector('main') ?? document.body;
    const all = (root, s) => (root ? [...root.querySelectorAll(s)] : []);
    const plant = sec('plant-entry'); const judging = sec('judging'); const intro = sec('intro');
    return {
      body: txt(main), hasCtaBand: Boolean(sec('cta')), h2s: all(main, 'h2').map(txt),
      intro: intro ? { text: txt(intro), h2: all(intro, 'h2').map(txt), ps: all(intro, 'p').map(txt), figures: all(intro, '[data-hm-figure]').map(txt) } : null, figuresAnywhere: document.querySelectorAll('[data-hm-figure]').length,
      judging: judging ? { h2: all(judging, 'h2').map(txt), cards: all(judging, '[data-hm-judging-card]').map((k) => ({ h3: all(k, 'h3').map(txt), ps: all(k, 'p').map(txt), em: all(k, 'em').map(txt), text: txt(k) })) } : null,
      plant: plant ? { h2: all(plant, 'h2').map(txt), stages: all(plant, '[data-hm-stage]').map((k) => ({ text: txt(k), h3: all(k, 'h3').map(txt), ps: all(k, 'p').map(txt) })), text: txt(plant),
        markers: all(plant, '[data-hm-register-marker] [data-confirmation-badge]').length, registerLinks: all(plant, 'a').filter((a) => /Register Here/i.test(txt(a))).map((a) => a.getAttribute('href')) } : null,
    };
  });
  const body = norm(m.body); const has = (s) => body.includes(norm(s));
  c.check(`${tag} HR-1 tagline "${L.tagline}" is an h2 in the intro band, and the two paragraphs are verbatim <p>s there (typos kept: "can be judges")`, Boolean(m.intro) && m.intro.h2.includes(L.tagline) && m.intro.ps.includes(L.para1) && m.intro.ps.includes(L.para2));
  const figLabels = L.figures.map((f) => f.slice(f.indexOf(' ') + 1)); const figLeak = figLabels.filter((t) => Boolean(m.intro) && m.intro.text.includes(t));
  c.check(`${tag} HR-2 the figures strip is gone (Brad 2026-11-09, her note item 3): zero [data-hm-figure] on the page and none of ${figLabels.join(' / ')} in the intro band (figures=${m.figuresAnywhere}, leaked=${figLeak.join(' | ') || 'none'})`, Boolean(m.intro) && m.figuresAnywhere === 0 && m.intro.figures.length === 0 && figLeak.length === 0);
  c.check(`${tag} HR-3 judging band: h2 "${L.groupsHeading}" over ${L.groups.length} cards in her order, each h3 her name, a "Group N" label, her description verbatim where she gave one and no paragraph where she gave none (groups 11-13)`,
    Boolean(m.judging) && m.judging.h2.includes(L.groupsHeading) && m.judging.cards.length === L.groups.length && L.groups.every((g, i) => { const k = m.judging.cards[i];
      return k.h3.length === 1 && k.h3[0] === g.name && k.text.includes(g.label) && (g.description === null ? !k.ps.some((p) => p !== g.label) : k.ps.includes(g.description)); }));
  c.check(`${tag} HR-3b her italic runs (species and section names) render as <em> in the same cards: ${L.groups.reduce((n, g) => n + g.italics.length, 0)} runs`, Boolean(m.judging) && L.groups.every((g, i) => g.italics.every((r) => (m.judging.cards[i]?.em ?? []).includes(r))));
  c.check(`${tag} HR-4 plant entry band: h2 "${L.plantEntryHeading}", ${L.stages.length} [data-hm-stage] cards in order, each "Stage NN" + her title (h3) + her description (p) verbatim, "${L.startPlanning}" present`,
    Boolean(m.plant) && m.plant.h2.includes(L.plantEntryHeading) && m.plant.stages.length === L.stages.length && L.stages.every((s, i) => { const k = m.plant.stages[i]; return k.text.includes(`Stage ${s.stage}`) && k.h3.includes(s.title) && k.ps.includes(s.description); }) && m.plant.text.includes(L.startPlanning));
  c.check(`${tag} HR-5 "${L.registerHere}" is plain text with exactly one pending StatusMarker beside it and no link (her form is not supplied): links=${JSON.stringify(m.plant && m.plant.registerLinks)}, markers=${m.plant && m.plant.markers}`,
    Boolean(m.plant) && m.plant.text.includes(L.registerHere) && m.plant.registerLinks.length === 0 && m.plant.markers === 1);
  c.check(`${tag} HR-6 the foot of the plant-entry band carries "${L.cta}" verbatim, after the stages, with no extra band for it`, Boolean(m.plant) && m.plant.text.includes(L.cta) && m.plant.text.indexOf(L.cta) > m.plant.text.indexOf(L.startPlanning) && m.plant.text.indexOf(L.startPlanning) > m.plant.text.indexOf(L.stages[3].description) && !m.hasCtaBand);
  const leaked = EDITORIAL_NOTES.filter(has); c.check(`${tag} HR-7 none of her editorial notes to us renders (${leaked.join(' | ') || 'none'})`, leaked.length === 0);
  const old = inv.filter(has); c.check(`${tag} HR-8 none of our old invented judging/stage copy renders (${old.join(' | ') || 'none'})`, old.length === 0);
  c.check(`${tag} HR-9 the existing bands are still there: h2s ${['2027 South African National Orchid Show', 'Programme'].join(' / ')}; the Visit h2 is retired with the visit band, which the sub-nav replaces (Brad 2026-10-31); the "Exhibit & trade" h2 is removed, the exhibit band is links only (Brad 2026-11-09) (${m.h2s.length} h2s)`, ['2027 South African National Orchid Show', 'Programme'].every((h) => m.h2s.includes(h)) && !m.h2s.includes('Exhibit & trade'));
}
