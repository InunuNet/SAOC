// nos-critique-r8 f1 fixture (Codi FINAL: at <=359px the chip's visible text is the existing short tag "To be confirmed"), props only.
// Re-based on main 81490e7a, whose F18b StatusMarker is the model (FINAL): with the opt-in `shortOnNarrow` (ConfirmationBadge forwards it) the full label goes sr-only at <=359px and the
// short tag (the component's own FALLBACK_PENDING_LABEL, never a new literal) is drawn aria-hidden, switched by CSS media utilities only, no JS. The assertions are behavioural and read
// the markup's own utilities at 359 and 360 (chipFromClasses): a pending opted-in marker PAINTS the full label at 360 and the short tag at 359, and exposes exactly one label string to
// assistive tech at both. Research markers paint their full text at every width (no ruled short research form in r8; flagged to the lead), a marker without the prop is unchanged, a
// marker whose label already IS the short tag paints and exposes it once. Every marker but an opted-in pending one with its own label is ONE plain span (no short tag in the
// DOM; lead ruling, Codi FINAL r8 F1, pending-only). Confirmed renders nothing.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

import { chipFromClasses, finish, repoRoot, specDir } from './_lib.mjs';

const NAME = 'f1-fixture.mjs';
const failures = [];
const SHORT = 'To be confirmed';
const FULL = 'FULL-PENDING-FIX';
const RESEARCH = 'FULL-RESEARCH-FIX';
const SEL = '[data-confirmation-badge], [data-exhibitor-marker]';
let rendered;
try {
  rendered = JSON.parse(execFileSync(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(specDir, 'checks/f1-fixture-run.mjs'), repoRoot], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 24 }));
} catch (e) {
  finish(NAME, [`could not render the f1 fixtures: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' | ')}`]);
}

// painted at 360 and at 359; `at` is exactly one string at both widths unless noted.
const WANT = {
  confirmationPending: { wide: [FULL], narrow: [SHORT] },
  exhibitorPending: { wide: [FULL], narrow: [SHORT] },
  unsetPending: { wide: [FULL], narrow: [SHORT] },
  viaBadge: { wide: [FULL], narrow: [SHORT] },
  research: { wide: [RESEARCH], narrow: [RESEARCH] },
  optedOut: { wide: [FULL], narrow: [FULL] },
  fallbackLabel: { wide: [SHORT], narrow: [SHORT] },
  confirmed: { chip: false },
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [name, want] of Object.entries(WANT)) {
    await page.setContent(`<!doctype html><body>${rendered[name]}</body>`);
    const wide = await page.evaluate(chipFromClasses, { sel: SEL, w: 360 });
    const narrow = await page.evaluate(chipFromClasses, { sel: SEL, w: 359 });
    if (want.chip === false) { if (wide.length) failures.push(`[${name}]: a confirmed marker must render nothing`); continue; }
    if (wide.length !== 1) { failures.push(`[${name}]: ${wide.length} markers rendered, want one`); continue; }
    for (const [w, got, painted] of [[360, wide[0], want.wide], [359, narrow[0], want.narrow]]) {
      if (got.unknown.length) failures.push(`[${name}] @${w}: the label switch must be a plain width media utility, got ${JSON.stringify(got.unknown)}`);
      if (JSON.stringify(got.painted) !== JSON.stringify(painted)) failures.push(`[${name}] @${w}: paints ${JSON.stringify(got.painted)}, want ${JSON.stringify(painted)}`);
      if (got.at.length !== 1) failures.push(`[${name}] @${w}: ${got.at.length} label strings exposed to assistive tech (${JSON.stringify(got.at)}), want exactly one`);
    }
    // Ruling (lead, Codi FINAL r8 F1): only a resolved pending marker with shortOnNarrow and a label other than the short tag renders the pair; every other marker is one plain span.
    const pair = want.wide[0] !== want.narrow[0];
    if (!pair && (wide[0].spans !== 1 || narrow[0].spans !== 1)) failures.push(`[${name}]: renders ${wide[0].spans} label spans, want one plain label and no short tag in the DOM`);
    if (wide[0].at[0] !== want.wide[0]) failures.push(`[${name}]: assistive tech gets ${JSON.stringify(wide[0].at)} at 360, want the full label ${JSON.stringify(want.wide[0])}`);
    if (want.wide[0] !== SHORT && narrow[0].at.length === 1 && ![want.wide[0], SHORT].includes(narrow[0].at[0])) failures.push(`[${name}]: assistive tech gets ${JSON.stringify(narrow[0].at)} at 359, want the full label or the short tag`);
  }
} finally {
  await browser.close();
}

finish(NAME, failures, 'an opted-in pending StatusMarker paints the full label at 360 and the short tag at 359 with one string exposed to assistive tech at each, switched by width media utilities; research, opted-out and identical labels paint their own label at both widths; confirmed renders nothing.');
