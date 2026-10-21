// nos-critique-r9 f2 fixture (Codi FINAL research chip ruling), props only, rendered under the worktree's tsx:
//   inside a disclosure a research chip shows the existing short string "Not yet confirmed" (StatusMarker FALLBACK_RESEARCH_LABEL) at EVERY width, one label span only;
//   the full research wording (Sanity researchLabel) moves to the group's aria-label and to a visible foot ([data-status-foot]) inside the group.
//   opt-in prop shortResearch: markers without it, and a bare marker with no disclosure, still draw the full wording (nowhere to put it). Pending behaviour is unchanged.
//   Re-based on the F18b StatusMarker model (main 81490e7a, FINAL): labels are read at 360 and 359 from the markup's own media utilities (chipFromClasses). A chip PAINTS one label and
//   exposes exactly one to assistive tech at each width; a pending chip with shortOnNarrow paints its full label at 360 and the short tag at 359; a research chip never paints the pending tag.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

import { chipFromClasses, finish, repoRoot, specDir } from './_lib.mjs';

const NAME = 'f2-fixture.mjs';
const failures = [];
const SHORT = 'Not yet confirmed';
const FULL = 'RESEARCH-FIX';
const GT_LABEL = 'Details to be confirmed by the show committee';
let rendered;
try {
  rendered = JSON.parse(execFileSync(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(specDir, 'checks/r9-fixture-run.mjs'), repoRoot], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 24 }));
} catch (e) {
  finish(NAME, [`could not render the fixtures: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' | ')}`]);
}

const analyse = () => {
  const root = document.getElementById('root');
  const chip = root.querySelector('[data-confirmation-badge], [data-exhibitor-marker]');
  const group = root.querySelector('[role="group"], [role="note"]');
  return {
    chip: !!chip,
    groupLabel: group ? group.getAttribute('aria-label') : null,
    foots: [...root.querySelectorAll('[data-status-foot]')].map((f) => f.textContent.replace(/\s+/g, ' ').trim()),
    hasFull: root.innerHTML.includes('RESEARCH-FIX'),
  };
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const SEL = '[data-confirmation-badge], [data-exhibitor-marker]';
  const PENDING = 'PENDING-FIX';
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // labels: the painted label at 360 and 359 when both are one string and one string is exposed to assistive tech at each; otherwise a description of what is wrong.
  const get = async (name) => {
    await page.setContent(`<!doctype html><body>${rendered[name]}</body>`);
    const m = await page.evaluate(analyse);
    const [wide] = await page.evaluate(chipFromClasses, { sel: SEL, w: 360 });
    const [narrow] = await page.evaluate(chipFromClasses, { sel: SEL, w: 359 });
    const ok = (c) => c && !c.unknown.length && c.painted.length === 1 && c.at.length === 1;
    // One label at both widths must also be one plain span: the short tag is rendered for an opted-in pending marker only (lead ruling, pending-only).
    m.labels = wide && narrow && ok(wide) && ok(narrow) ? (wide.painted[0] === narrow.painted[0] ? (wide.spans === 1 ? [wide.painted[0]] : { spans: wide.spans, painted: wide.painted }) : [wide.painted[0], narrow.painted[0]]) : { wide, narrow };
    return m;
  };
  // A pending chip opted in to shortOnNarrow: the full label at 360, the short tag at 359.
  const PAIR = [PENDING, 'To be confirmed'];
  const want = (tag, ok, msg) => { if (!ok) failures.push(`[${tag}] ${msg}`); };

  for (const name of ['markerResearchShort', 'markerResearchShortExhibitor']) {
    const m = await get(name);
    want(name, eq(m.labels, [SHORT]), `research chip labels ${JSON.stringify(m.labels)}, want exactly ["${SHORT}"] (one label, painted at 360 and 359)`);
    want(name, !m.hasFull, 'the full research wording must not be inside the chip');
  }
  const plain = await get('markerResearchPlain');
  want('markerResearchPlain', eq(plain.labels, [FULL]), `a marker without shortResearch paints its full wording at 360 and 359, got ${JSON.stringify(plain.labels)}`);
  const pend = await get('markerPendingShort');
  want('markerPendingShort', eq(pend.labels, PAIR), `pending chip unchanged (full at 360, short tag at 359), got ${JSON.stringify(pend.labels)}`);

  const li = await get('lineResearchItems');
  want('lineResearchItems', eq(li.labels, [SHORT]), `chip labels ${JSON.stringify(li.labels)}, want ["${SHORT}"]`);
  want('lineResearchItems', li.groupLabel === FULL, `group aria-label ${JSON.stringify(li.groupLabel)}, want the full research wording`);
  want('lineResearchItems', li.foots.some((f) => f.includes(FULL)), `a visible foot must carry the full research wording, got ${JSON.stringify(li.foots)}`);
  const ln = await get('lineResearchNoLabel');
  want('lineResearchNoLabel', eq(ln.labels, [SHORT]) && ln.foots.length === 0, `no researchLabel: chip "${SHORT}", no foot, got ${JSON.stringify(ln)}`);
  const lb = await get('lineResearchBare');
  want('lineResearchBare', eq(lb.labels, [FULL]), `a bare marker (no disclosure) paints the full wording at 360 and 359, got ${JSON.stringify(lb.labels)}`);
  const lp = await get('linePendingItems');
  want('linePendingItems', eq(lp.labels, PAIR) && lp.groupLabel === 'PENDING-FIX' && !lp.hasFull && lp.foots.length === 0, `pending disclosure unchanged, got ${JSON.stringify(lp)}`);

  const gr = await get('gtResearch');
  want('gtResearch', eq(gr.labels, [SHORT]) && gr.groupLabel === FULL && gr.foots.some((f) => f.includes(FULL)), `Getting there research group wants chip "${SHORT}", aria-label and foot = full wording, got ${JSON.stringify(gr)}`);
  const gp = await get('gtPending');
  want('gtPending', gr && eq(gp.labels, PAIR) && gp.groupLabel === GT_LABEL && !gp.hasFull, `pending Getting there unchanged, got ${JSON.stringify(gp)}`);
  const gm = await get('gtMixed');
  want('gtMixed', eq(gm.labels, PAIR) && gm.groupLabel === GT_LABEL && !gm.hasFull, `a mixed group keeps the pending chip and label (pending beats research), got ${JSON.stringify(gm)}`);
  const ar = await get('attrResearch');
  want('attrResearch', eq(ar.labels, [SHORT]) && ar.groupLabel === FULL && ar.foots.some((f) => f.includes(FULL)), `attractions research group wants chip "${SHORT}", aria-label and foot = full wording, got ${JSON.stringify(ar)}`);
  const ap = await get('attrPending');
  want('attrPending', eq(ap.labels, PAIR) && ap.groupLabel === GT_LABEL && !ap.hasFull, `pending attractions unchanged, got ${JSON.stringify(ap)}`);

  const er = await get('emResearch');
  want('emResearch', eq(er.labels, [SHORT]) && er.groupLabel === FULL && er.foots.some((f) => f.includes(FULL)) && rendered.emResearch.includes('FOOT-FROM-CMS'), `emergency research disclosure wants chip "${SHORT}", aria-label = full wording, a foot carrying the full wording, with the on-site note still rendered, got ${JSON.stringify(er)}`);
  const ep = await get('emPending');
  want('emPending', eq(ep.labels, PAIR) && ep.groupLabel === 'LABEL-FROM-PAGE' && !ep.hasFull, `pending emergency disclosure unchanged, got ${JSON.stringify(ep)}`);
} finally {
  await browser.close();
}

finish(NAME, failures, 'research chips in disclosures show "Not yet confirmed" as the only label with the full wording in the group aria-label and a visible foot; bare, opted-out and pending markers are unchanged.');
