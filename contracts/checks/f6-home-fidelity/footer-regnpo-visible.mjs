// A32 — D8: the REG#/NPO line must be VISIBLE as a single rendered line
// (A18/A19 only grep source text ordering, which a CSS `display:none` or
// an unexpected wrap could silently defeat).
import { withPage, fail, pass } from './_shared.mjs';

await withPage({ width: 1440, height: 900 }, async (page) => {
  const line = page.getByText(/REG#.*NPO/).first();
  if ((await line.count()) === 0) fail('no single element with REG#...NPO text found in rendered DOM');

  const display = await line.evaluate((e) => getComputedStyle(e).display);
  if (display === 'none') fail(`REG#/NPO element computed display is "none"`);

  const box = await line.boundingBox();
  if (!box || box.width === 0 || box.height === 0) {
    fail(`REG#/NPO element bounding box is zero/null: ${JSON.stringify(box)}`);
  }

  // Single line => bounding box height should be roughly one line of the
  // 11px mono text (not a wrapped 2-line block, which would be ~2x taller).
  if (box.height > 24) {
    fail(`REG#/NPO element looks wrapped onto multiple lines (height=${box.height}px, expected a single ~11-16px line)`);
  }

  const text = (await line.textContent())?.trim() ?? '';
  if (!/REG#/.test(text) || !/NPO/.test(text)) {
    fail(`REG#/NPO element rendered text missing one of the two required tokens: "${text}"`);
  }

  pass(`REG#/NPO renders visibly on one line — box=${JSON.stringify(box)} text="${text}"`);
});
