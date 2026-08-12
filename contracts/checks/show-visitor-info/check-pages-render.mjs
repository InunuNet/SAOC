#!/usr/bin/env node
// A-series: the three new pages return 200 AND render the content blocks the mission
// specifies — over real HTTP, against visible text with tags stripped, not a source grep.
//
// The needles are read live from the showVisitorInfo singleton. If an editor rewords
// planIntro in Studio, this check follows the reword. It cannot be satisfied by copy
// hardcoded in JSX that happens to resemble the seed data.

import { runCheck, getSanityClient, settlePage, textContains, PATHS } from './_shared.mjs';
import { withDatasetLock } from './_mutation-guard.mjs';

const REQUIRED_ON_PLAN = [
  'planTitle',
  'planIntro',
  'gettingThereIntro',
  'parking',
  'publicTransport',
  'accommodationIntro',
];

const REQUIRED_ON_EXPECT = [
  'expectTitle',
  'expectIntro',
  'admissionNote',
  'admissionLinkLabel',
  'food',
  'photographyPolicy',
  'cloakroom',
  'accessibility',
];

const REQUIRED_ON_FAQ = ['faqTitle', 'faqIntro', 'faqContactNote'];

await runCheck('check-pages-render', async (r) => {
  // READ LOCK. This check reads the dataset and asserts the page agrees with it, so it must not
  // observe a dataset that a mutating check has deliberately invalidated mid-flight — the sweep
  // unsets countdownDate for minutes, and no amount of polling converges on that. Waits 240s
  // (readers are cheap to retry); the assertion's timeout_seconds covers wait + runtime.
  await withDatasetLock('check-pages-render (read)', async () => {
    const client = getSanityClient();
    // `let`, and re-read inside the settle loop below: another agent's mutating check can change
    // any of these fields while we run, and a snapshot cannot converge against a live writer.
    let info = await client.fetch('*[_id == "showVisitorInfo"][0]');
    const refreshInfo = async () => {
      info = await client.fetch('*[_id == "showVisitorInfo"][0]');
      return info;
    };

    if (!info) {
      r.fail(
        'showVisitorInfo singleton exists in the dataset',
        'nothing at _id "showVisitorInfo" — run scripts/seed-show-visitor-info.ts',
      );
      return;
    }

    const pages = {
      [PATHS.plan]: REQUIRED_ON_PLAN,
      [PATHS.expect]: REQUIRED_ON_EXPECT,
      [PATHS.faq]: REQUIRED_ON_FAQ,
    };

    // settlePage, not fetchOkPage: every needle below is read live from the dataset, so a single
    // fetch races any writer. Keyed on the first required field for this page — see _shared.mjs.
    for (const [pathname, fields] of Object.entries(pages)) {
      const body = await settlePage(pathname, async () => {
        await refreshInfo();
        return fields.map((f) => info[f]);
      });
      r.ok(`${pathname} returns 200`);

      for (const field of fields) {
        const value = info[field];
        if (typeof value !== 'string' || value.trim() === '') {
          r.fail(`${pathname}: showVisitorInfo.${field} holds seeded content`, `value is ${JSON.stringify(value)}`);
          continue;
        }
        // Match on a distinctive slice rather than the whole string: long copy may be split
        // across elements, and the first 60 characters are more than enough to be unique.
        const needle = value.trim().slice(0, 60);
        r.check(
          textContains(body, needle),
          `${pathname} renders showVisitorInfo.${field}`,
          `expected visible text to contain ${JSON.stringify(needle)}`,
        );
      }
    }

    // Repeating structured content: at least one entry from each array must reach the page.
    const planBody = await settlePage(PATHS.plan, async () => {
      await refreshInfo();
      return REQUIRED_ON_PLAN.map((f) => info[f]);
    });
    const arrays = {
      airportRoutes: (e) => e?.origin,
      accommodation: (e) => e?.name,
      attractions: (e) => e?.name,
      emergencyContacts: (e) => e?.label,
    };
    for (const [field, pick] of Object.entries(arrays)) {
      const entries = Array.isArray(info[field]) ? info[field] : [];
      if (entries.length === 0) {
        r.fail(`showVisitorInfo.${field} is seeded`, 'array is empty or missing');
        continue;
      }
      const missing = entries.map(pick).filter((label) => label && !textContains(planBody, label));
      r.check(
        missing.length === 0,
        `${PATHS.plan} renders every ${field} entry`,
        `not found on the page: ${JSON.stringify(missing)}`,
      );
    }

    const expectBody = await settlePage(PATHS.expect, async () => {
      await refreshInfo();
      return REQUIRED_ON_EXPECT.map((f) => info[f]);
    });
    const hours = Array.isArray(info.openingHours) ? info.openingHours : [];
    r.check(hours.length > 0, 'showVisitorInfo.openingHours is seeded');
    const missingHours = hours.map((h) => h?.label).filter((l) => l && !textContains(expectBody, l));
    r.check(
      missingHours.length === 0,
      `${PATHS.expect} renders every openingHours entry`,
      `not found on the page: ${JSON.stringify(missingHours)}`,
    );

    // Emergency numbers must be on the page as digits, not only as service names.
    for (const contact of info.emergencyContacts ?? []) {
      if (!contact?.number) continue;
      r.check(
        textContains(planBody, contact.number),
        `${PATHS.plan} renders the emergency number for "${contact.label}"`,
      );
    }
  }, { waitTimeoutMs: 240_000 });
});
