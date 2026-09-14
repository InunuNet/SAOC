// =============================================================
// SAOC — e2e/mega-menu-layout4-visual-fidelity.spec.ts
// Mission menu-system-layout4 M2/F7 — GOLDEN FILE, authored by @architect.
// @dev implements MegaMenu.tsx (and nav-config.ts's featureRail.blurb) against
// this spec, not against prose. Do not loosen these assertions to make them
// pass; if one seems wrong, escalate to @architect rather than editing it.
//
// WHY THIS EXISTS: Brad looked at the live menu on beta.saoc.co.za (screenshots,
// 2026-09-10 ~21:20) and said "Menu has no borders... looks weird" — correct and
// specific. The Layout 4 render path (F1-F4) landed every leaf, descriptor, the
// lead block and the feature rail correctly — what drifted from the approved
// artifact (b9eadbd4-e165-4de9-884d-86acc9fbf2a2, "SAOC Menu Flyouts") is the
// VISUAL TREATMENT: no column rules, the wrong sheet shadow, an empty-looking
// feature rail (missing blurb + wrong justify-between layout + a stray
// rounded-sm), and grid-track ratios that don't match the artifact.
//
// THIS REPO'S AUDITED DEFECT CLASS: "an assertion satisfiable without the
// property it claims to prove." A grep for the literal string `border-l` in
// MegaMenu.tsx would prove a substring exists in a file, NOT that a rule
// renders between two real columns in a real browser. Every assertion below
// reads a COMPUTED style or a MEASURED layout from the actual rendered DOM —
// none of it is a source-text grep. See
// .agent/memory/project/specs/menu-system-layout4/goldens/f7-layout4-visual-fidelity.json
// for the full value table and per-property rationale this spec checks against.
//
// This spec MUST fail against today's tree (verified during contract authoring,
// 2026-09-10, by reading components/chrome/MegaMenu.tsx directly — no column
// border classes, `shadow-float` in place of the artifact's shadow, `rounded-sm`
// + `justify-between` on the feature rail, `gap-10`/`px-8 py-10` instead of the
// artifact's zero-gap border-separated tracks, and featureRail.blurb unset in
// nav-config.ts). F7 (MegaMenu.tsx + nav-config.ts) is what must change to make
// it pass — not this spec's definition of the approved shape.
//
// EXTENDED (same F7, same day) after @dev's first pass landed the border/shadow/
// grid/feature-rail-layout fixes above (verified live: RED 5/5 -> 3/5 PASS) and
// two more problems surfaced: (1) `panel.getByText('Programme', {exact:true})`
// strict-mode-collided with a leaf link of the same name, and a second collision
// existed between the feature rail's <h4>Tickets</h4> and the lead block's own
// "Tickets" leaf; (2) the first F7 pass, plus this contract's own first draft,
// covered only 4 of the drifted properties — the group-heading typography
// (serif/16px/ink today vs the artifact's mono/10px/uppercase/accent .dd-head
// treatment), the lead block's eyebrow (rendered as a colored pill badge today;
// the artifact has no badge at all, just another .dd-head label), the lead link,
// lead meta line, feature-rail meta line, feature-rail heading, and the CTA
// button all also drifted from the artifact and were not yet asserted anywhere.
// See goldens/f7-layout4-visual-fidelity.json's groupHeadings / leadEyebrow /
// leadLink / leadMetaLine / featureRailMeta / featureRailHeading / ctaButton
// sections for the full value table this second pass checks against, and its
// correctionsToTeamLeadsDispatchMessage section for two corrections to the
// dispatching brief's own CSS transcription (re-verified directly against the
// artifact, not trusted from the brief).
//
// LOCATOR FIX: every group heading (the lead's "The Show", Visit, Programme,
// Exhibit & Trade) is now queried via getByRole('heading', { level: 3, ... }).
// MegaMenu.tsx renders these as real <h3> elements as of this pass — an
// accessibility fix (WAI-ARIA APG's Navigation Landmark pattern wants a real
// heading labelling a group of links) that also closes the locator collision
// structurally: a heading (role=heading) can never match a leaf link
// (role=link), by construction, regardless of what text either one carries.
// The lead block's eyebrow ("The National Show") stays a non-heading element —
// it labels the lead link + meta line, not a <ul> of leaf links, so promoting
// it would misrepresent its role to assistive tech; it is targeted by text
// (no leaf anywhere shares its text, so no collision risk) exactly as before.
import { expect, test } from '@playwright/test';

const GOLD_RULE_SOFT = 'rgb(228, 225, 208)'; // --rule-soft #e4e1d0
const GOLD_RULE = 'rgb(217, 215, 201)'; // --rule #d9d7c9
const GOLD_BONE = 'rgb(232, 230, 220)'; // --bone #e8e6dc
const GOLD_ACCENT = 'rgb(158, 140, 107)'; // --accent #9e8c6b
const GOLD_MUTED = 'rgb(99, 102, 96)'; // --muted #636660
const GOLD_INK = 'rgb(23, 25, 23)'; // --ink #171917
const GOLD_BLURB = 'Day, weekend and VIP admission for the 19th National Show.';

test.describe('mega menu — Layout 4 visual fidelity (mission menu-system-layout4 M2/F7)', () => {
  test.beforeEach(async ({ page }) => {
    // Fixed viewport well above the container's 1280px max-width so the grid
    // resolves to its intended track proportions, not a viewport-constrained
    // shrink. Desktop Chrome's Playwright default (1280x720) sits exactly at
    // the container boundary, which is too ambiguous to measure ratios against.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  async function openNationalShowMenu(page: import('@playwright/test').Page) {
    const header = page.getByRole('banner');
    const trigger = header.getByRole('button', { name: 'National Show', exact: true });
    await trigger.click();
    const panel = header.getByRole('menu', { name: 'National Show' });
    await expect(panel).toBeVisible();
    return panel;
  }

  test('sheet: border-top and box-shadow match the artifact, not shadow-float', async ({ page }) => {
    const panel = await openNationalShowMenu(page);

    await expect(panel).toHaveCSS('border-top-width', '1px');
    await expect(panel).toHaveCSS('border-top-color', GOLD_RULE);

    const boxShadow = await panel.evaluate((el) => getComputedStyle(el).boxShadow);
    // Real computed value, not a source-text assumption about `shadow-float` --
    // could be "none" today if the utility class is in fact a no-op (see golden
    // file's shadow.note). Either way this must end up matching the artifact:
    // offset-y 20px, blur 44px, color rgba(23, 25, 23, 0.09).
    expect(boxShadow).not.toBe('none');
    // TIGHTENED (Codex GPT-5.5 finding, mission menu-system-layout4 M2/F7,
    // 2026-09-11, confidence high): the three independent .toMatch() checks
    // this replaced (`/20px/`, `/44px/`, the rgba colour) each matched an
    // unanchored substring ANYWHERE in the full computed value -- Chromium
    // renders Tailwind's stacked (unused) ring/shadow layers ahead of the
    // real one, e.g. "...rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(23, 25, 23,
    // 0.09) 0px 20px 44px 0px", and nothing stopped an offset-x of 20px, a
    // spread-radius of 44px, or an unrelated shadow layer merely containing
    // that rgba colour from satisfying all three checks while being nothing
    // like the artifact's actual shadow. Assert the real shadow as ONE
    // contiguous "<color> <offsetX> <offsetY> <blur> <spread>" run instead --
    // this is the exact, verified computed-style token order Chromium emits
    // for `shadow-[0_20px_44px_rgba(23,25,23,0.09)]` (captured live via this
    // same test, 2026-09-11), so a wrong offset/blur/spread anywhere in that
    // run, or a colour attached to the wrong layer, fails it.
    expect(boxShadow).toMatch(/rgba\(23,\s*25,\s*23,\s*0\.09\)\s+0px\s+20px\s+44px\s+0px/);
  });

  test('sheet content keeps a real horizontal inset at <=1280px viewport, not just leftover mx-auto slack at 1440px (F7 QA regression, 2026-09-11)', async ({
    page,
  }) => {
    // @qa FAIL, 2026-09-11: @dev's grid-track-ratio edit to the wrapper's
    // className string (`mx-auto grid max-w-[1280px] grid-cols-[...]
    // gap-x-0 pt-8 pb-6`) collaterally dropped `px-8` as well, even though
    // goldens/f7-layout4-visual-fidelity.json's own `notInScope` field
    // explicitly named this wrapper as untouched and unrelated to the four
    // F7 gaps. Verified live by @qa with boundingBox measurements: at 1280px
    // (--container-max, app/globals.css:74 -- an ordinary laptop width) the
    // lead eyebrow renders at x:0, flush against the browser edge. This
    // spec's OTHER tests all run at a fixed 1440px viewport (beforeEach
    // above, chosen deliberately for A4's track-ratio measurement so the
    // 1280px max-width is never viewport-constrained) -- at 1440px the
    // missing padding is invisible, because `mx-auto` centres the leftover
    // 160px of slack around the capped grid, which LOOKS like padding but
    // collapses to zero the instant the viewport is <=1280px. A check that
    // only ran at 1440px would have passed straight through this bug, so
    // this test deliberately overrides the shared viewport to 1280px.
    //
    // REWRITTEN (team lead correction, 2026-09-11): the first version of this
    // assertion measured the grid element's OWN bounding box against the
    // panel -- but padding is interior to an element's own box, so a fix
    // that restored `px-8` on that same grid div (the smaller, single-div
    // change that would have fixed the actual visible bug) could never move
    // gridBox.x relative to panelBox.x, and the assertion stayed red against
    // a correct implementation. That is a DOM-structure assertion in
    // disguise: it silently required the two-layer wrapper shape (padding
    // hoisted to an outer element) and would reject an equally-correct
    // single-div `px-8` fix. Rewritten to measure the property @qa actually
    // found broken -- the position of real rendered CONTENT relative to the
    // panel edge -- which is true under either DOM shape.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const panel = await openNationalShowMenu(page);
    // Left edge: the lead eyebrow is the first rendered content in the sheet
    // (leftmost track, first element) -- the exact element @qa measured at
    // x:0 in the regression report above.
    const leadEyebrow = panel.getByText('The National Show', { exact: true });
    // Right edge: the feature rail's CTA is the rightmost rendered content
    // (last track, last element) -- same locator pattern already used
    // elsewhere in this spec (see featureRailHeading/ctaButton tests below).
    const cta = panel.getByRole('link', { name: 'Buy tickets', exact: true });

    const panelBox = await panel.boundingBox();
    const eyebrowBox = await leadEyebrow.boundingBox();
    const ctaBox = await cta.boundingBox();
    if (!panelBox || !eyebrowBox || !ctaBox) {
      throw new Error('Could not measure panel, lead eyebrow, or CTA button');
    }

    const leftInset = eyebrowBox.x - panelBox.x;
    const rightInset = panelBox.x + panelBox.width - (ctaBox.x + ctaBox.width);

    // --container-pad (app/globals.css:73) is 32px. Require a real inset on
    // BOTH edges (this is the property class, not just the one instance:
    // either edge losing its padding is the same defect) with slop for
    // rendering/rounding, well clear of a flush-to-edge regression.
    expect(leftInset).toBeGreaterThan(24);
    expect(rightInset).toBeGreaterThan(24);
  });

  test('inner grid: zero gap, artifact padding, no shared gutter between tracks', async ({ page }) => {
    const panel = await openNationalShowMenu(page);
    const visitHeading = panel.getByRole('heading', { level: 3, name: 'Visit', exact: true });
    const grid = visitHeading.locator(
      'xpath=ancestor::*[contains(@class,"grid")][1]'
    );

    await expect(grid).toHaveCSS('column-gap', '0px');
    await expect(grid).toHaveCSS('padding-top', '32px');
    await expect(grid).toHaveCSS('padding-bottom', '24px');
  });

  test('group columns and feature rail carry a 1px rule-soft left border; lead block does not', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);

    const visitHeading = panel.getByRole('heading', { level: 3, name: 'Visit', exact: true });
    const visitColumn = visitHeading.locator('xpath=..');
    await expect(visitColumn).toHaveCSS('border-left-width', '1px');
    await expect(visitColumn).toHaveCSS('border-left-color', GOLD_RULE_SOFT);
    await expect(visitColumn).toHaveCSS('padding-left', '24px');
    await expect(visitColumn).toHaveCSS('padding-right', '24px');

    // Strict-mode collision this fix closes: a leaf link labelled "Programme"
    // exists in this same column. getByRole('heading') cannot match it — role
    // link vs role heading — regardless of shared text, unlike the prior
    // getByText query this replaces.
    const programmeHeading = panel.getByRole('heading', { level: 3, name: 'Programme', exact: true });
    const programmeColumn = programmeHeading.locator('xpath=..');
    await expect(programmeColumn).toHaveCSS('border-left-width', '1px');
    await expect(programmeColumn).toHaveCSS('border-left-color', GOLD_RULE_SOFT);

    const tradeHeading = panel.getByRole('heading', { level: 3, name: 'Exhibit & Trade', exact: true });
    const tradeColumn = tradeHeading.locator('xpath=..');
    await expect(tradeColumn).toHaveCSS('border-left-width', '1px');
    await expect(tradeColumn).toHaveCSS('border-left-color', GOLD_RULE_SOFT);

    // Second collision this fix closes: the lead block's own "Tickets" leaf
    // link shares text with the feature rail's <h4>Tickets</h4>. Both are
    // already disambiguated by role today (h4 = level 4, not level 3), and
    // remain so here.
    const featureHeading = panel.getByRole('heading', { level: 4, name: 'Tickets', exact: true });
    const featureRail = featureHeading.locator('xpath=..');
    await expect(featureRail).toHaveCSS('border-left-width', '1px');
    await expect(featureRail).toHaveCSS('border-left-color', GOLD_RULE_SOFT);

    // The lead block's "The Show" group heading is also a real <h3> now, but
    // the lead block CONTAINER is still located via its non-heading eyebrow
    // ("The National Show"), which is unique in the panel and precedes the
    // heading — see goldens/f7-layout4-visual-fidelity.json's leadEyebrow
    // section for why the eyebrow itself does not become a heading.
    const leadEyebrow = panel.getByText('The National Show', { exact: true });
    const leadBlock = leadEyebrow.locator('xpath=..');
    await expect(leadBlock).toHaveCSS('border-left-width', '0px');
    await expect(leadBlock).toHaveCSS('padding-right', '24px');
  });

  test('the lead block\'s "The Show" heading and every group heading render as real <h3> elements styled to the artifact\'s .dd-head treatment', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);

    for (const name of ['The Show', 'Visit', 'Programme', 'Exhibit & Trade']) {
      const heading = panel.getByRole('heading', { level: 3, name, exact: true });
      await expect(heading).toHaveCSS('font-size', '10px');
      await expect(heading).toHaveCSS('text-transform', 'uppercase');
      await expect(heading).toHaveCSS('color', GOLD_ACCENT);
      // 0.18em resolves relative to the element's OWN font-size (10px here),
      // not the page default — getComputedStyle reports it in px: 1.8px.
      await expect(heading).toHaveCSS('letter-spacing', '1.8px');
      const fontFamily = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
      expect(fontFamily.toLowerCase()).toContain('mono');
    }
  });

  test('the lead block eyebrow ("The National Show") is styled to the artifact\'s .dd-head treatment, not a pill badge', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const eyebrow = panel.getByText('The National Show', { exact: true });

    await expect(eyebrow).toHaveCSS('font-size', '10px');
    await expect(eyebrow).toHaveCSS('text-transform', 'uppercase');
    await expect(eyebrow).toHaveCSS('color', GOLD_ACCENT);
    const fontFamily = await eyebrow.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toContain('mono');

    // No pill badge: today's rounded-pill + bg-bone treatment must be gone.
    await expect(eyebrow).toHaveCSS('border-radius', '0px');
    const bg = await eyebrow.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent').toBe(true);
  });

  test('lead link and lead meta line match the artifact\'s .dd-lead / .dd-lead-sub typography', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);

    const leadLink = panel.getByRole('link', { name: '19th SAOC National Orchid Show', exact: true });
    await expect(leadLink).toHaveCSS('font-size', '23px');
    await expect(leadLink).toHaveCSS('font-weight', '600');
    await expect(leadLink).toHaveCSS('color', GOLD_INK);
    const leadFontFamily = await leadLink.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(leadFontFamily.toLowerCase()).toContain('serif');

    // .dd-lead has no margin-top of its own — the gap above it comes from the
    // eyebrow's own margin-bottom, not an explicit top margin on this element.
    await expect(leadLink).toHaveCSS('margin-top', '0px');

    const leadMeta = panel.getByText(/Hangar|Stellenbosch/); // venue name, sourced from the nationalShow singleton — see leadMetaLine note
    const metaFontFamily = await leadMeta.first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(metaFontFamily.toLowerCase()).not.toContain('mono');
    await expect(leadMeta.first()).toHaveCSS('font-size', '12.5px');
    await expect(leadMeta.first()).toHaveCSS('color', GOLD_MUTED);
  });

  test('feature rail meta line and heading match the artifact\'s .dd4__meta / .dd4__feature h4 typography', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const featureHeading = panel.getByRole('heading', { level: 4, name: 'Tickets', exact: true });

    await expect(featureHeading).toHaveCSS('font-size', '18px');
    await expect(featureHeading).toHaveCSS('font-weight', '600');
    const headingFontFamily = await featureHeading.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(headingFontFamily.toLowerCase()).toContain('serif');

    // LOCATOR FIX (found incidentally while verifying blocker 1, mission menu-system-layout4
    // M2/F7 round 2): the lead block's own meta line (leadMetaLine, .dd-lead-sub) also renders
    // the venue + date string and its FULL (untruncated, CSS-clipped-on-screen only) text
    // content also satisfies /September 2027/ -- an unscoped `panel.getByText(...)` matches
    // BOTH spans, and `.first()` picked the lead's one (DOM order), asserting the lead's own
    // 12.5px against this test's 10px expectation for a completely different element. Scope the
    // query to inside the feature rail itself (same pattern used by every other feature-rail
    // assertion in this file, e.g. the CTA/blurb tests below) so it can only ever match
    // featureRailMeta, never leadMetaLine.
    const featureRail = featureHeading.locator('xpath=..');
    const featureMeta = featureRail.getByText(/September 2027/);
    // TIGHTENED (Codex GPT-5.5 finding, mission menu-system-layout4 M2/F7,
    // 2026-09-11, confidence high): this `if (count() > 0)` guard let the
    // test PASS HAVING CHECKED NOTHING whenever featureRailMeta stopped
    // rendering, rendered different text, or the seeded national show had no
    // "September 2027" date -- exactly the audited "assertion satisfiable
    // without the property it claims to prove" defect class, inside the one
    // spec written to guard against it. featureRailMeta is a required part
    // of the artifact (goldens/f7-layout4-visual-fidelity.json's
    // featureRailMeta section), not optional content, so its absence is
    // itself a failure this test must report, not silently skip past.
    // toBeVisible() below fails loudly (with a locator-not-found error) if
    // the count is ever zero, instead of a conditional no-op.
    await expect(featureMeta.first()).toBeVisible();
    await expect(featureMeta.first()).toHaveCSS('font-size', '10px');
    await expect(featureMeta.first()).toHaveCSS('text-transform', 'uppercase');
    const metaFontFamily = await featureMeta.first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(metaFontFamily.toLowerCase()).toContain('mono');
  });

  test('feature rail CTA button matches the artifact\'s .btn treatment, not the Tailwind default radius scale', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const cta = panel.getByRole('link', { name: 'Buy tickets', exact: true });

    await expect(cta).toHaveCSS('font-size', '13.5px');
    await expect(cta).toHaveCSS('border-radius', '2px');
    await expect(cta).toHaveCSS('padding-top', '10px');
    await expect(cta).toHaveCSS('padding-bottom', '10px');
    await expect(cta).toHaveCSS('padding-left', '18px');
    await expect(cta).toHaveCSS('padding-right', '18px');
  });

  test('track widths follow the artifact ratio 1.05 : 1 : 1 : 1 : 0.9, not 2 : 1 : 1 : 1 : 2', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);

    const leadBox = await panel.getByText('The National Show', { exact: true }).locator('xpath=..').boundingBox();
    const visitBox = await panel
      .getByRole('heading', { level: 3, name: 'Visit', exact: true })
      .locator('xpath=..')
      .boundingBox();
    const programmeBox = await panel
      .getByRole('heading', { level: 3, name: 'Programme', exact: true })
      .locator('xpath=..')
      .boundingBox();
    const tradeBox = await panel
      .getByRole('heading', { level: 3, name: 'Exhibit & Trade', exact: true })
      .locator('xpath=..')
      .boundingBox();
    const featureBox = await panel
      .getByRole('heading', { level: 4, name: 'Tickets', exact: true })
      .locator('xpath=..')
      .boundingBox();

    if (!leadBox || !visitBox || !programmeBox || !tradeBox || !featureBox) {
      throw new Error('Could not measure one or more mega menu tracks');
    }

    const colUnit = (visitBox.width + programmeBox.width + tradeBox.width) / 3;
    const tolerance = 0.06;

    expect(Math.abs(leadBox.width / colUnit - 1.05)).toBeLessThan(tolerance);
    expect(Math.abs(featureBox.width / colUnit - 0.9)).toBeLessThan(tolerance);
    expect(Math.abs(visitBox.width / colUnit - 1.0)).toBeLessThan(tolerance);
    expect(Math.abs(programmeBox.width / colUnit - 1.0)).toBeLessThan(tolerance);
    expect(Math.abs(tradeBox.width / colUnit - 1.0)).toBeLessThan(tolerance);

    // No shared gutter: adjacent track boxes must be edge-to-edge (zero gap),
    // not separated by the removed gap-10.
    expect(Math.abs(visitBox.x - (leadBox.x + leadBox.width))).toBeLessThan(2);
    expect(Math.abs(featureBox.x - (tradeBox.x + tradeBox.width))).toBeLessThan(2);
  });

  test('feature rail: no border-radius, real block flow (display is not flex, justify-content is not space-between), and the artifact-sourced blurb renders', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const featureHeading = panel.getByRole('heading', { level: 4, name: 'Tickets', exact: true });
    const featureRail = featureHeading.locator('xpath=..');

    await expect(featureRail).toHaveCSS('border-radius', '0px');
    await expect(featureRail).toHaveCSS('background-color', GOLD_BONE);
    await expect(featureRail).toHaveCSS('padding', '24px');

    // TIGHTENED (Codex GPT-5.5 finding, mission menu-system-layout4 M2/F7,
    // 2026-09-11, confidence medium-high): the gap measurement below only
    // proves the blurb-to-CTA gap is under 32px -- a flex column with
    // `justify-content: flex-start` (small gap, but still flex, still not
    // "natural flow" per the artifact's .dd4__feature rule, which has no
    // display/flex property at all) or a CSS grid would satisfy that gap
    // check while violating the very property the test's own title claims to
    // prove. Assert the real CSS properties directly first: this element
    // must not be a flex container at all, and must not carry
    // justify-content: space-between (the exact defect Brad's screenshot
    // showed). Confirmed live, 2026-09-11: today's fixed tree renders this
    // element with `display: block` and default `justify-content: normal`.
    const display = await featureRail.evaluate((el) => getComputedStyle(el).display);
    expect(display).not.toBe('flex');
    const justifyContent = await featureRail.evaluate((el) => getComputedStyle(el).justifyContent);
    expect(justifyContent).not.toBe('space-between');

    // The blurb must be present, visible, and byte-for-byte the artifact string
    // — see goldens/f7-featurerail-blurb.json for its provenance.
    const blurb = featureRail.getByText(GOLD_BLURB, { exact: true });
    await expect(blurb).toBeVisible();

    // Belt-and-suspenders on top of the display/justify-content checks above:
    // with content in natural flow, the CTA sits immediately after the
    // blurb's own margin-bottom, not stretched to the bottom of a flex box.
    // Assert the gap between the blurb's bottom edge and the CTA's top edge
    // is close to the artifact's --s4 (16px), not a large flex-stretched gap.
    const cta = featureRail.getByRole('link', { name: 'Buy tickets' });
    const blurbBox = await blurb.boundingBox();
    const ctaBox = await cta.boundingBox();
    if (!blurbBox || !ctaBox) throw new Error('Could not measure blurb or CTA');
    const gap = ctaBox.y - (blurbBox.y + blurbBox.height);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(32); // 16px margin +/- rendering slop, well under a stretched-flex gap
  });

  test('font-family tokens terminate in a real generic CSS keyword, not just contain a lucky substring (mission menu-system-layout4 M2/F7, blocker 1)', async ({
    page,
  }) => {
    // WHY THIS EXISTS, SEPARATELY FROM THE .toContain(...) CHECKS ABOVE: those
    // checks (e.g. `fontFamily.toLowerCase()).toContain('mono')`) pass today
    // for the wrong reason on the mono elements -- the loaded face itself is
    // literally named "JetBrains Mono", so the substring "mono" is present
    // whether or not a real generic fallback exists at all. The serif checks
    // above (lines ~213-214, ~235-236) are the ones that currently correctly
    // fail, because "Crimson Pro" contains no "serif" substring -- but that is
    // a coincidence of font-naming, not a real property check. The actual bug
    // (app/globals.css:114-116 wiring `--font-family-serif/-sans/-mono`
    // straight to the bare next/font var instead of the full `--serif`/`--sans`/
    // `--mono` stacks that already end in a generic keyword) means NONE of the
    // three families have a real generic-keyword fallback today, even though
    // two of the three `.toContain` checks above accidentally pass. This test
    // reads the LAST comma-separated entry of the resolved font-family list and
    // requires it to be exactly one of the three CSS generic keywords -- a
    // property that cannot be satisfied by a lucky font-name substring.
    const panel = await openNationalShowMenu(page);

    const lastFamily = (raw: string) => {
      const parts = raw.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
      return parts[parts.length - 1];
    };

    // serif: the lead link (.dd-lead), same element the existing serif
    // .toContain check above already targets.
    const leadLink = panel.getByRole('link', { name: '19th SAOC National Orchid Show', exact: true });
    const serifFamily = await leadLink.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(lastFamily(serifFamily)).toBe('serif');

    // mono: a group heading (.dd-head), same element the existing mono
    // .toContain check above already targets -- this is the one where the
    // substring check was passing for the wrong reason.
    const monoHeading = panel.getByRole('heading', { level: 3, name: 'Visit', exact: true });
    const monoFamily = await monoHeading.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(lastFamily(monoFamily)).toBe('monospace');

    // sans: page body default (app/globals.css `body { font-family: var(--sans) }`)
    // -- this token feeds every `font-sans` utility and the unstyled default alike.
    const sansFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(lastFamily(sansFamily)).toBe('sans-serif');
  });
});
