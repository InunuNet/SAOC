#!/usr/bin/env node
// Admission pricing cross-links to /tickets and never duplicates the figures. Sanity
// ticketType is the single source, and those prices are still provisional — a second copy on
// /national-show/what-to-expect would go stale the moment the council revises them, and would
// put an unlabelled price in front of the council.
//
// The forbidden figures are read from the dataset, so this follows a price change instead of
// checking against numbers frozen into this file.

import { runCheck, getSanityClient, settlePage, visibleText, linksTo, PATHS } from './_shared.mjs';
import { withDatasetLock } from './_mutation-guard.mjs';

await runCheck('check-no-price-duplication', async (r) => {
  // READ LOCK. This check reads the dataset and asserts the page agrees with it, so it must not
  // observe a dataset that a mutating check has deliberately invalidated mid-flight — the sweep
  // unsets countdownDate for minutes, and no amount of polling converges on that. Waits 240s
  // (readers are cheap to retry); the assertion's timeout_seconds covers wait + runtime.
  await withDatasetLock('check-no-price-duplication (read)', async () => {
    const client = getSanityClient();
    const types = await client.fetch('*[_type == "ticketType"]{ name, price }');

    r.check(Array.isArray(types) && types.length > 0, 'ticketType documents exist to check against');

    const body = await settlePage(PATHS.expect, []);
    const text = visibleText(body);

    r.check(linksTo(body, PATHS.tickets), `${PATHS.expect} links to ${PATHS.tickets}`);

    for (const t of types ?? []) {
      if (typeof t.price !== 'number') continue;
      // Match the currency-prefixed forms a page would actually print, not the bare integer —
      // a bare "80" could legitimately appear in an address, a distance or a year.
      const forms = [
        `R${t.price}`,
        `R ${t.price}`,
        `R${t.price}.00`,
        `R ${t.price}.00`,
        `ZAR ${t.price}`,
      ];
      for (const form of forms) {
        r.check(
          !text.includes(form),
          `${PATHS.expect} does not duplicate the ${t.name} price ("${form}")`,
          'prices belong on /tickets only — cross-link, never copy',
        );
      }
    }

    // Belt and braces on the source: no currency literal in the new page files at all.
    const { readFileSync } = await import('node:fs');
    const files = [
      'app/(marketing)/national-show/what-to-expect/page.tsx',
      'app/(marketing)/national-show/plan-your-visit/page.tsx',
      'app/(marketing)/national-show/faq/page.tsx',
    ];
    for (const file of files) {
      let src;
      try {
        src = readFileSync(file, 'utf8');
      } catch {
        r.fail(`${file} exists`, 'file not found');
        continue;
      }
      r.check(
        !/\bR\s?\d{2,}(\.\d{2})?\b/.test(src) && !/\bZAR\b/.test(src),
        `${file} contains no hardcoded currency amount`,
      );
    }

    // The admission copy itself must come from Sanity and must not have had prices typed into
    // it by an editor either — flag it loudly rather than failing silently, since this one is
    // content, not code.
    const info = await client.fetch('*[_id == "showVisitorInfo"][0]{ admissionNote }');
    if (typeof info?.admissionNote === 'string') {
      r.check(
        !/\bR\s?\d{2,}/.test(info.admissionNote),
        'showVisitorInfo.admissionNote contains no price figure',
        'an editor has typed a price into the admission note — it will go stale against ticketType',
      );
    }
  }, { waitTimeoutMs: 240_000 });
});
