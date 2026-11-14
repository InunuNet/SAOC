// Open-dialog states of the SAOC chrome, shared by the F1e walks (check-font-fallback-walk, check-glyph-svg). Each state is a click path through
// the header's real triggers; a state whose first trigger is not visible at the viewport is skipped (the search button shows from 1384px, the menu button below it;
// below 1384px search is the drawer's first row). The closed-page walk stays in each check; these are the extra walks.
export const DIALOG_STATES = [
  { name: 'search dialog', clicks: ['[data-hd="search"]'] },
  { name: 'mobile menu dialog', clicks: ['[data-hd="menu"]'] },
  { name: 'search dialog (via drawer)', clicks: ['[data-hd="menu"]', '[data-hd="drawer-search"]'] },
];

// Visits each reachable dialog state on an already loaded page, calls walk(stateName) with the dialog open, then closes it with Escape.
// Returns the names of the states walked, so a check can fail when none opened at a viewport where one must.
export async function walkDialogStates(page, walk) {
  const walked = [];
  for (const st of DIALOG_STATES) {
    const first = page.locator(st.clicks[0]).first();
    if (!(await first.isVisible().catch(() => false))) continue;
    for (const sel of st.clicks) { await page.locator(sel).first().click({ timeout: 10_000 }); await page.waitForTimeout(250); }
    await page.locator('[role="dialog"]:visible').first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(300);
    await walk(st.name);
    walked.push(st.name);
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    if (await page.locator('[role="dialog"]:visible').count()) await page.reload({ waitUntil: 'networkidle' });
  }
  return walked;
}
