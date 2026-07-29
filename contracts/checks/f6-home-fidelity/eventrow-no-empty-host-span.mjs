// A35 — D1 code half: confirms the EventRow host fix is a real
// conditional (React `&&`, node absent from the DOM) rather than a
// CSS-only hide that leaves an empty node behind (A22 only greps source
// for the "event.host &&" string, which a superficial edit could satisfy
// without actually changing render output). Currently 0/18 Sanity
// societyEvent docs have hostSociety populated (content gap, out of
// scope for F6 — see backlog.md), so every row's host is empty; this
// check verifies none of those empty hosts produce a rendered node.
import { withPage, fail, pass } from './_shared.mjs';

await withPage({ width: 1440, height: 1400 }, async (page) => {
  const rows = page.locator('[href^="/events/"], article:has(> div > p)');
  const rowCount = await page
    .locator('a[href="/events"]')
    .first()
    .count();
  if (rowCount === 0) fail('"Full calendar" events-strip link not found — page may not have loaded correctly');

  // Host slot uses this exact class combination in both the pre-fix and
  // post-fix source (only the conditional wrapper changes) — find any
  // matching span and check none render as an empty/whitespace-only node.
  const hostSpans = page.locator('span.font-mono.uppercase >> text=/^\\s*$/');
  const emptyCount = await hostSpans.count();
  if (emptyCount > 0) {
    fail(`found ${emptyCount} empty host-slot span(s) still in the DOM — host should be omitted, not rendered empty`);
  }

  pass('no empty host-slot spans found in rendered EventRow output');
});
