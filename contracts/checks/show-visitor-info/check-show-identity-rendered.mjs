#!/usr/bin/env node
// F6: prove /national-show actually RENDERS the nationalShow singleton — the thing no gate has
// ever checked. The wiring landed in commit 32f3b0f (2026-08-06) but was only ever asserted
// against the Sanity API, which is the false-green class this contract exists to close.
//
// Every needle is read live from the dataset. Nothing venue-, date- or edition-shaped is
// written into this file, so the check follows a Studio edit instead of freezing today's values.
//
// The countdown needs a browser: ShowCountdown renders a frozen 00/00/00 server snapshot and
// computes the real figure only after hydration (the fix from contracts/f1-countdown-hydration.yaml
// — do not undo it), so an HTTP fetch can never see the target. Playwright loads the page,
// waits for a tick, and compares the rendered Days value against the day count derived from the
// dataset's countdownDate.
//
// See contracts/golden/show-visitor-info/show-identity-wiring.golden.md.

import { chromium } from 'playwright';

import { runCheck, getSanityClient, settlePage, textContains, visibleText, BASE_URL, PATHS } from './_shared.mjs';
import { withDatasetLock } from './_mutation-guard.mjs';

const ROMAN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

function toRoman(n) {
  let out = '';
  let rest = n;
  for (const [value, numeral] of ROMAN) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}

const DAY_MS = 86_400_000;

await runCheck('check-show-identity-rendered', async (r) => {
  // READ LOCK. This check reads the dataset and asserts the page agrees with it, so it must not
  // observe a dataset that a mutating check has deliberately invalidated mid-flight — the sweep
  // unsets countdownDate for minutes, and no amount of polling converges on that. Waits 240s
  // (readers are cheap to retry); the assertion's timeout_seconds covers wait + runtime.
  await withDatasetLock('check-show-identity-rendered (read)', async () => {
    const client = getSanityClient();
    const SHOW_PROJECTION =
      '*[_id == "nationalShow"][0]{ title, location, showDate, showEndDate, countdownDate, edition, hostRegion, venue }';
    let show = await client.fetch(SHOW_PROJECTION);

    if (!show) {
      r.fail('nationalShow singleton exists in the dataset', 'nothing at _id "nationalShow"');
      return;
    }

    // ---- The fields must be populated at all. A null field renders a fallback, and a check
    // ---- against a fallback proves nothing about the wiring.
    for (const field of ['title', 'location', 'showDate', 'showEndDate', 'countdownDate', 'hostRegion']) {
      r.check(
        show[field] !== null && show[field] !== undefined && show[field] !== '',
        `nationalShow.${field} is populated (seed it, or the page silently renders a fallback)`,
        `value is ${JSON.stringify(show[field])}`,
      );
    }
    r.check(typeof show.edition === 'number', 'nationalShow.edition is a number', `value is ${JSON.stringify(show.edition)}`);

    // ---- Settle before asserting ----
    //
    // This check reads its needles from the dataset and then asserts they are on the page, so it
    // is racing any write to nationalShow: the dataset is authoritative the instant it commits,
    // while the page keeps serving its ISR copy for up to `revalidate = 60`, plus one stale read
    // after that window. @dev saw exactly that on 2026-08-12 — A56 was the only red in an
    // otherwise clean gate run, at 02:20, minutes after the title changed. Not a defect: the
    // check fetched once and asserted on whatever came back.
    //
    // Same fix as A61: poll until the page is provably showing the current dataset, then assert
    // on THAT response. Discrimination is unchanged — a page that genuinely never renders the
    // title times out and fails the assertion below, which is the correct red.
    const body = await settlePage(PATHS.landing, async () => {
      // Rebinds `show`, so every assertion below reads the same values the loop settled on.
      show = await client.fetch(SHOW_PROJECTION);
      return [show?.title, show?.location, show?.hostRegion];
    });

    // ---- Rendered, from the dataset ----
    r.check(textContains(body, show.title), '/national-show renders the dataset title');
    r.check(textContains(body, show.location), '/national-show renders the dataset location');
    if (show.hostRegion) {
      r.check(textContains(body, show.hostRegion), '/national-show renders the dataset hostRegion');
    }
    if (typeof show.edition === 'number') {
      r.check(
        textContains(body, toRoman(show.edition)),
        `/national-show renders edition ${show.edition} as the roman numeral ${toRoman(show.edition)}`,
      );
    }
    for (const field of ['showDate', 'showEndDate']) {
      if (!show[field]) continue;
      const year = String(new Date(show[field]).getFullYear());
      r.check(textContains(body, year), `/national-show renders the ${field} year (${year})`);
    }

    // ---- The literals F6 removes must be gone from the rendered page and from the source ----
    const text = visibleText(body);
    r.check(!text.includes('18–21 Sep 2027'), '/national-show no longer renders a hardcoded date range');

    const { readFileSync } = await import('node:fs');
    const pageSrc = readFileSync('app/(marketing)/national-show/page.tsx', 'utf8');
    for (const literal of ['CTICC', '18–21 Sep 2027', 'Nineteenth Edition', 'September 2027']) {
      r.check(!pageSrc.includes(literal), `page.tsx contains no "${literal}" literal`);
    }
    r.check(
      !/toRomanOrdinal\(\s*\d+\s*\)/.test(pageSrc),
      'page.tsx passes no hardcoded edition number to toRomanOrdinal',
    );

    // ---- The dates are unconfirmed, so the hero must say so ----
    const info = await client.fetch('*[_id == "showVisitorInfo"][0]{ pendingLabel, confirmations }');
    const datesStatus = info?.confirmations?.dates ?? 'pending';
    if (info?.pendingLabel && datesStatus === 'pending') {
      r.check(
        textContains(body, info.pendingLabel),
        '/national-show marks the unconfirmed dates with the pending label',
        'seeded dates are plausible but unconfirmed — an unmarked date range is the invention this mission forbids',
      );
    }

    // ---- The countdown, in a real browser ----
    if (!show.countdownDate) {
      r.fail('nationalShow.countdownDate is populated', 'cannot verify the countdown without it');
      return;
    }

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}${PATHS.landing}`, { waitUntil: 'domcontentloaded' });

      const countdown = page.locator('[aria-label*="Countdown" i]').first();
      await countdown.waitFor({ state: 'attached', timeout: 15_000 });

      // Wait for hydration to replace the frozen server snapshot.
      let rendered = null;
      for (let i = 0; i < 20; i += 1) {
        await page.waitForTimeout(500);
        const txt = (await countdown.innerText()).replace(/\s+/g, ' ');
        const m = txt.match(/(\d{2,})\s*Days/i);
        if (m && Number(m[1]) > 0) {
          rendered = Number(m[1]);
          break;
        }
      }

      if (rendered === null) {
        r.fail(
          'the countdown hydrates to a real day count',
          'still showing the frozen server snapshot after 10s — either hydration is broken or countdownDate is in the past',
        );
      } else {
        const expected = Math.floor(Math.max(0, new Date(show.countdownDate).getTime() - Date.now()) / DAY_MS);
        console.log(`  countdown rendered ${rendered} days; dataset countdownDate implies ${expected}`);
        r.check(
          Math.abs(rendered - expected) <= 1,
          'the rendered countdown is driven by the dataset countdownDate',
          `rendered ${rendered} days, expected ~${expected} — the component is using its DEFAULT_COUNTDOWN_DATE fallback, not the prop`,
        );
      }

      // The hydration fix must survive: the server-rendered HTML holds the frozen snapshot, so
      // the day count must NOT be present in the raw HTML. If it is, the fix from
      // contracts/f1-countdown-hydration.yaml has been undone and hydration mismatch is back.
      r.check(
        rendered === null || !body.includes(`>${String(rendered).padStart(2, '0')}<`),
        'the countdown still renders a frozen server snapshot (hydration fix intact)',
      );
    } finally {
      await browser.close();
    }
  }, { waitTimeoutMs: 240_000 });
});
