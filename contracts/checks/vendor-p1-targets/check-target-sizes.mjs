// F7 / NOS audit P1 -- tap targets of at least 44x44 CSS px, measured in real Chromium against
// the LOCAL production build at 390 and 1440 wide.
//
//   /national-show/vendors/apply     14 checkboxes (16x16 on base d2071be5). The HIT target is the
//                                    associated <label> (input.labels[0]); its box must be >= 44x44,
//                                    must be what a pointer actually lands on, and a real click
//                                    inside the label's padding strip (outside the 16px input and
//                                    outside any text) must toggle the checkbox. The VISUAL box
//                                    (the input) must stay 16x16 -- the design handoff
//                                    (design/design_handoff_saoc/) specifies no larger control.
//   /national-show/vendors/register  the code-entry form's "Continue" button (96x42 on base).
//                                    The button is its own hit target: box >= 44x44 and not covered.
//
// Run as: npx tsx contracts/checks/vendor-p1-targets/check-target-sizes.mjs   (from the repo root,
// after `next build`).

import { MIN_TARGET_PX, VIEWPORTS, finish, launch, openSettled } from './_harness.mjs';

const EXPECTED_APPLY_CHECKBOXES = 14;
const VISUAL_BOX_PX = 16;
const VISUAL_BOX_TOLERANCE_PX = 0.5;
const SUBPIXEL_PX = 0.01;
// Inset from the label's bottom-left corner for the real-click probe: inside the label's own box
// (its padding), clear of the 16px checkbox that sits vertically centred and of any text run.
const PROBE_INSET_PX = 2;

const failures = [];
const { baseUrl, browser } = await launch();

for (const viewport of VIEWPORTS) {
  // ---- apply: checkboxes ----
  const { context: applyContext, page: applyPage } = await openSettled(
    browser, baseUrl, '/national-show/vendors/apply', viewport, 'input[type="checkbox"]',
  );
  const checkboxCount = await applyPage.locator('input[type="checkbox"]').count();
  console.log(`[${viewport.name}] apply: ${checkboxCount} checkboxes`);
  if (checkboxCount !== EXPECTED_APPLY_CHECKBOXES) {
    failures.push(`[${viewport.name}] apply: expected ${EXPECTED_APPLY_CHECKBOXES} checkboxes, found ${checkboxCount}`);
  }

  for (let i = 0; i < checkboxCount; i += 1) {
    const checkbox = applyPage.locator('input[type="checkbox"]').nth(i);
    await checkbox.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const m = await checkbox.evaluate((el) => {
      const label = el.labels && el.labels[0];
      const inputRect = el.getBoundingClientRect();
      const labelRect = label ? label.getBoundingClientRect() : null;
      return {
        id: el.id,
        hasLabel: !!label,
        input: { w: inputRect.width, h: inputRect.height },
        label: labelRect ? { x: labelRect.left, y: labelRect.top, w: labelRect.width, h: labelRect.height } : null,
      };
    });
    const tag = `[${viewport.name}] apply #${m.id || i}`;
    if (!m.hasLabel) {
      failures.push(`${tag}: no associated <label> -- the hit area cannot reach 44px`);
      continue;
    }
    if (m.label.w < MIN_TARGET_PX - SUBPIXEL_PX || m.label.h < MIN_TARGET_PX - SUBPIXEL_PX) {
      failures.push(`${tag}: label hit box ${m.label.w.toFixed(1)}x${m.label.h.toFixed(1)} < ${MIN_TARGET_PX}x${MIN_TARGET_PX}`);
    }
    if (
      Math.abs(m.input.w - VISUAL_BOX_PX) > VISUAL_BOX_TOLERANCE_PX ||
      Math.abs(m.input.h - VISUAL_BOX_PX) > VISUAL_BOX_TOLERANCE_PX
    ) {
      failures.push(`${tag}: visual box ${m.input.w.toFixed(1)}x${m.input.h.toFixed(1)} -- must stay ${VISUAL_BOX_PX}x${VISUAL_BOX_PX}`);
    }

    // The padding strip really is a hit target: what sits under the probe point is the label (or
    // its content), and a real click there toggles the checkbox.
    const px = m.label.x + PROBE_INSET_PX;
    const py = m.label.y + m.label.h - PROBE_INSET_PX;
    const owner = await checkbox.evaluate(
      (el, point) => {
        const hit = document.elementFromPoint(point.x, point.y);
        const label = el.labels[0];
        return !!hit && (hit === label || label.contains(hit) || hit === el);
      },
      { x: px, y: py },
    );
    if (!owner) {
      failures.push(`${tag}: the label's bottom-left corner (${px.toFixed(0)},${py.toFixed(0)}) is covered by another element`);
      continue;
    }
    const before = await checkbox.isChecked();
    await applyPage.mouse.click(px, py);
    const after = await checkbox.isChecked();
    if (before === after) {
      failures.push(`${tag}: a real click on the label's padding strip did not toggle the checkbox`);
    } else {
      await applyPage.mouse.click(px, py); // restore
    }
  }
  await applyContext.close();

  // ---- register: Continue button ----
  const { context: registerContext, page: registerPage } = await openSettled(
    browser, baseUrl, '/national-show/vendors/register', viewport, '#vendor-register-code-entry-code',
  );
  const button = registerPage.getByRole('button', { name: 'Continue', exact: true });
  if ((await button.count()) !== 1) {
    failures.push(`[${viewport.name}] register: expected exactly one "Continue" button, found ${await button.count()}`);
  } else {
    await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box = await button.boundingBox();
    console.log(`[${viewport.name}] register Continue: ${box.width.toFixed(1)}x${box.height.toFixed(1)}`);
    if (box.width < MIN_TARGET_PX - SUBPIXEL_PX || box.height < MIN_TARGET_PX - SUBPIXEL_PX) {
      failures.push(`[${viewport.name}] register: Continue is ${box.width.toFixed(1)}x${box.height.toFixed(1)} < ${MIN_TARGET_PX}x${MIN_TARGET_PX}`);
    }
    const uncovered = await button.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const inset = 2;
      return [
        [r.left + inset, r.top + inset],
        [r.right - inset, r.top + inset],
        [r.left + inset, r.bottom - inset],
        [r.right - inset, r.bottom - inset],
      ].every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit && (hit === el || el.contains(hit));
      });
    });
    if (!uncovered) failures.push(`[${viewport.name}] register: a corner of the Continue button is covered by another element`);
  }
  await registerContext.close();
}

await finish(browser, failures);
