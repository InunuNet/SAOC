#!/usr/bin/env node
// THE VENUE-CHANGE TEST, non-mutating half.
//
// Reads nationalShow.venue live from the dataset, then asserts the CURRENT stored values
// appear in the rendered HTML of every page that shows venue detail. The needle comes from
// Sanity, so this cannot be satisfied by a hardcoded literal that merely happens to match
// today's venue — change the dataset and the expectation changes with it.
//
// Paired with check-cms-round-trip.mjs (which proves the write->render loop causally) and
// with the source-grep assertions in the contract (which prove no venue literal exists in
// the new files). All three together are the venue-change test; none alone is sufficient.
//
// See contracts/golden/show-visitor-info/venue-single-source.golden.md.

import { runCheck, getSanityClient, settlePage, textContains, PATHS } from './_shared.mjs';
import { withDatasetLock } from './_mutation-guard.mjs';

// Pages that must show venue detail. /national-show/faq is excluded on purpose: it carries
// no venue block, and requiring one there would push venue text into FAQ answers.
const VENUE_PAGES = [PATHS.plan, PATHS.contact];

await runCheck('check-venue-single-source', async (r) => {
  // READ LOCK. This check reads the dataset and asserts the page agrees with it, so it must not
  // observe a dataset that a mutating check has deliberately invalidated mid-flight — the sweep
  // unsets countdownDate for minutes, and no amount of polling converges on that. Waits 240s
  // (readers are cheap to retry); the assertion's timeout_seconds covers wait + runtime.
  await withDatasetLock('check-venue-single-source (read)', async () => {
    const client = getSanityClient();
    let show = await client.fetch('*[_id == "nationalShow"][0]{ location, venue }');

    if (!show?.venue) {
      r.fail(
        'nationalShow.venue exists in the dataset',
        'no venue object — run scripts/seed-show-visitor-info.ts',
      );
      return;
    }

    let { venue } = show;
    // Re-read on every settle attempt: a snapshot cannot converge against another agent's
    // concurrent write. Rebinds `venue` so the assertions below use what the loop settled on.
    const refreshVenue = async () => {
      show = await client.fetch('*[_id == "nationalShow"][0]{ location, venue }');
      venue = show?.venue ?? venue;
      return venue;
    };

    for (const field of ['name', 'city', 'postalCode']) {
      r.check(
        typeof venue[field] === 'string' && venue[field].trim() !== '',
        `nationalShow.venue.${field} is seeded`,
        `value is ${JSON.stringify(venue[field])}`,
      );
    }
    r.check(
      Array.isArray(venue.addressLines) && venue.addressLines.length > 0,
      'nationalShow.venue.addressLines is seeded',
    );
    r.check(typeof venue.latitude === 'number', 'nationalShow.venue.latitude is a number');
    r.check(typeof venue.longitude === 'number', 'nationalShow.venue.longitude is a number');
    r.check(
      typeof venue.mapsUrl === 'string' && /^https?:\/\//.test(venue.mapsUrl),
      'nationalShow.venue.mapsUrl is a usable link',
    );

    // Both loops below assert on the SAME settled response per page. The needles come from the
    // dataset, so this check races every writer — see settlePage() in _shared.mjs for why a
    // single fetch made this the rotating single red in consecutive gate runs. The second loop
    // previously re-fetched, which reopened the same race for the maps-SDK assertions.
    const settled = new Map();
    for (const pathname of VENUE_PAGES) {
      settled.set(
        pathname,
        await settlePage(pathname, async () => {
          await refreshVenue();
          return [venue.name, venue.city, venue.postalCode, ...(venue.addressLines ?? [])];
        }),
      );
    }

    for (const pathname of VENUE_PAGES) {
      const body = settled.get(pathname);

      r.check(textContains(body, venue.name), `${pathname} renders the dataset's venue.name`);
      for (const line of venue.addressLines ?? []) {
        r.check(textContains(body, line), `${pathname} renders address line "${line}"`);
      }
      r.check(textContains(body, venue.city), `${pathname} renders venue.city`);
      r.check(textContains(body, venue.postalCode), `${pathname} renders venue.postalCode`);
      r.check(
        body.includes(venue.mapsUrl.replace(/&/g, '&amp;')) || body.includes(venue.mapsUrl),
        `${pathname} links to the dataset's venue.mapsUrl`,
      );
    }

    // No maps SDK, no API key. A script tag pulling a maps library, or an iframe pointing at a
    // keyed embed endpoint, both fail here.
    for (const pathname of VENUE_PAGES) {
      const body = settled.get(pathname);
      const banned = [
        'maps.googleapis.com',
        'api.mapbox.com',
        'maps.google.com/maps/api',
        'google.com/maps/embed/v1',
        'unpkg.com/leaflet',
      ];
      for (const needle of banned) {
        r.check(!body.includes(needle), `${pathname} loads no paid/keyed maps SDK (${needle})`);
      }
      r.check(
        !/[?&](key|api_key|access_token)=/.test(body),
        `${pathname} exposes no map API key in the markup`,
      );
    }

    // The new pages must not fall back to the legacy plain-string location field — venue.* is
    // the single source, and reading both would let the two drift invisibly.
    const { readFileSync } = await import('node:fs');
    const newSources = [
      'app/(marketing)/national-show/plan-your-visit/page.tsx',
      'app/(marketing)/national-show/what-to-expect/page.tsx',
      'app/(marketing)/national-show/faq/page.tsx',
      'components/show/VenueCard.tsx',
    ];
    for (const file of newSources) {
      let src;
      try {
        src = readFileSync(file, 'utf8');
      } catch {
        r.fail(`${file} exists`, 'file not found');
        continue;
      }
      r.check(
        !/\blocation\b\s*[,}]|\.location\b/.test(src.replace(/window\.location/g, '')),
        `${file} does not read the legacy nationalShow.location field`,
      );
    }
  }, { waitTimeoutMs: 240_000 });
});
