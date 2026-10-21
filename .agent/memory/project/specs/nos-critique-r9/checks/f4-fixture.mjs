// nos-critique-r9 f4 fixture, props only, rendered under the worktree's tsx:
//   VisitEmergency owns the label filter and is null-safe (a null CMS array entry is dropped, never thrown on): contacts with an empty, null or missing label are never drawn (their numbers neither), all-unlabelled or empty draws nothing;
//   the exhibitor-kind pending marker opted in with shortOnNarrow paints the full label at 360 and the short tag at 359 (F18b model on main 81490e7a, read from the markup's media
//   utilities by chipFromClasses), one label exposed to assistive tech at each; without the opt-in it paints the full label at both widths.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

import { chipFromClasses, finish, repoRoot, specDir } from './_lib.mjs';

const NAME = 'f4-fixture.mjs';
const failures = [];
let rendered;
try {
  rendered = JSON.parse(execFileSync(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(specDir, 'checks/r9-fixture-run.mjs'), repoRoot], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 24 }));
} catch (e) {
  finish(NAME, [`could not render the fixtures: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' | ')}`]);
}

const SEL = '[data-exhibitor-marker], [data-confirmation-badge]';
// The painted label at 360 then at 359, or a description of what is wrong when a width does not paint and expose exactly one label.
const labelsOf = async (page) => {
  const [wide] = await page.evaluate(chipFromClasses, { sel: SEL, w: 360 });
  const [narrow] = await page.evaluate(chipFromClasses, { sel: SEL, w: 359 });
  const ok = (c) => c && !c.unknown.length && c.painted.length === 1 && c.at.length === 1;
  // Without the opt-in the marker is one plain span (no short tag in the DOM).
  return ok(wide) && ok(narrow) && !(wide.painted[0] === narrow.painted[0] && wide.spans !== 1) ? [wide.painted[0], narrow.painted[0]] : { wide, narrow };
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const body = (name) => page.setContent(`<!doctype html><body>${rendered[name]}</body>`);
  const html = rendered.emUnlabelled;
  for (const n of ['999', '998', '997']) if (html.includes(n)) failures.push(`[emUnlabelled] the unlabelled contact with number ${n} is drawn`);
  if (!html.includes('Police (national)') || !html.includes('ONSITE-LABEL-FROM-CMS')) failures.push('[emUnlabelled] the labelled contacts must still be drawn');
  for (const name of ['emAllUnlabelled', 'emEmpty']) {
    if (rendered[name] !== '<div id="root"></div>') failures.push(`[${name}] draws ${rendered[name].length} bytes, want nothing`);
  }
  await body('markerExhibitorPendingShort');
  const s = await labelsOf(page);
  if (JSON.stringify(s) !== JSON.stringify(['PENDING-FIX', 'To be confirmed'])) failures.push(`[exhibitor opted in] paints ${JSON.stringify(s)} at 360/359, want the full label then "To be confirmed"`);
  await body('markerExhibitorPendingPlain');
  const pl = await labelsOf(page);
  if (JSON.stringify(pl) !== JSON.stringify(['PENDING-FIX', 'PENDING-FIX'])) failures.push(`[exhibitor not opted in] paints ${JSON.stringify(pl)} at 360/359, want the full label at both`);
} finally {
  await browser.close();
}

finish(NAME, failures, 'VisitEmergency drops unlabelled contacts and returns nothing when none remain; the exhibitor-kind short tag is opt-in only.');
