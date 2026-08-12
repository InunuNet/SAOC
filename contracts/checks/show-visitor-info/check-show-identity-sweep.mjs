#!/usr/bin/env node
// THE VENUE-CHANGE TEST, swept — the assertion the previous contract needed and did not have.
//
// WHY A SWEEP AND NOT MORE GREPS
// ------------------------------
// A54 greps app/(marketing)/national-show/page.tsx for the string "Cape Town International
// Convention Centre". It passes. Meanwhile @qa swapped the venue in Sanity and /national-show
// rendered the OLD venue in the hero and the NEW city in the CTA sentence one screen below —
// two different venues in one viewport — because the hero read the legacy nationalShow.location
// while the CTA read nationalShow.venue.city. The literal was never in the code. It was in the
// CMS. A source grep is structurally incapable of seeing that, so it passed while the mission's
// first overriding rule was broken. See .agent/memory/scratch/visitor-qa.md S1.
//
// The rule is not "no venue literal appears in these three files". The rule is "changing the
// show's identity in Studio changes it EVERYWHERE, and leaves no trace of the old one
// anywhere". This check asserts that rule directly:
//
//   1. Swap the whole show identity in the dataset for values this check invents at runtime —
//      venue name, city, province, address, both dates, edition, host region — and unset
//      countdownDate. Deliberately DO NOT touch nationalShow.location: leaving the legacy
//      field holding the old venue is the entire point, because any surface that prefers it
//      over venue.name will now render the stale value and be caught.
//   2. Wait for propagation, then assert POSITIVELY that each surface renders the new values.
//   3. Assert NEGATIVELY that no surface renders any token of the OLD identity.
//   4. Restore under a revision guard and verify the restore on the rendered page.
//
// Every needle is derived at runtime — from the baseline for the negatives, from this run's
// own random-ish sentinels for the positives. Nothing venue-, date- or edition-shaped is
// written into this file, so the check follows the dataset instead of freezing today's values,
// and it cannot be satisfied by copy frozen into JSX that happens to match today's seed.
//
// TWO DELIBERATE NARROWINGS, RULED BY THE TEAM LEAD 2026-08-12
// ------------------------------------------------------------
//   a) The landing page's "Past editions" list is historical record, and one past show (2018)
//      was legitimately held in the current venue's city. No Studio edit may rewrite history,
//      so the city token could never be cleared there. It is exempted inside THAT ONE SECTION,
//      structurally (exciseSection), for the city token only — see the regionExempt comment on
//      the landing surface for exactly what coverage that does and does not cost. The archive
//      page already carried the same carve-out.
//   b) `nationalShow.title` no longer embeds the edition ordinal. The ordinal is `edition`'s
//      fact; duplicating it in the title meant changing the edition in Studio left a stale
//      "19th" in the H1 — the exact failure this mission exists to eliminate. The title is now
//      "The South African National Orchid Show" in the dataset, the seed and the golden.
//
// Exit codes: 0 = swept clean. 1 = ordinary failure. 2 = RESIDUE ALERT (live content incident).

import { chromium } from 'playwright';

import {
  runCheck,
  fetchOkPage,
  getSanityClient,
  loadEnvOrFail,
  callRevalidate,
  visibleText,
  BASE_URL,
  PATHS,
} from './_shared.mjs';
import {
  withDatasetLock,
  assertUsableBaseline,
  makeSentinel,
  commitAndCaptureRev,
  restoreGuarded,
  verifyDatasetRestored,
  residueAlert,
} from './_mutation-guard.mjs';

const DOC_ID = 'nationalShow';
const POLL_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 5_000;
// Per-surface freshness window. Each route sets `export const revalidate = 60`, so the first
// fetch after a write routinely serves one stale copy while kicking off regeneration in the
// background. The previous version waited a FIXED 2 x 20s and then asserted on whatever came
// back, which made this check pass on lucky runs and fail on unlucky ones. It now polls each
// surface until it is provably fresh and asserts on THAT response — see settleSurface().
const SURFACE_SETTLE_TIMEOUT_MS = 180_000;

// The landing page's "Past editions" list is historical record (show-identity-surfaces.golden.md
// row 5: "constitutional record"). A past show legitimately held in the current venue's city
// must not be rewritten by a venue change, so the city token is exempted INSIDE this region
// only — see exciseSection().
const PAST_EDITIONS_HEADING = 'Past editions';
// A region-based exemption is only safe while it stays small. If the excised block ever grows
// past this share of the page, the carve-out has stopped being a carve-out and the check says
// so instead of quietly going green.
const MAX_EXCISED_FRACTION = 0.4;

// A far-future window no seeded copy could coincidentally mention.
const SWEEP_SHOW_DATE = '2033-04-05T09:00:00+02:00';
const SWEEP_SHOW_END_DATE = '2033-04-08T17:00:00+02:00';
const SWEEP_YEAR = '2033';
const SWEEP_EDITION = 41; // 41st / XLI — both forms are unmistakable in rendered text.

const ROMAN = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];

function toRoman(n) {
  let out = '';
  let rest = n;
  for (const [v, s] of ROMAN) while (rest >= v) { out += s; rest -= v; }
  return out;
}

function toOrdinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th','st','nd','rd'][n % 10] ?? 'th'}`;
}

function contains(text, needle) {
  return text.toLowerCase().includes(String(needle).replace(/\s+/g, ' ').trim().toLowerCase());
}

// Cuts the <section> that contains `heading` out of the HTML, so a token can be exempted in
// ONE region of a page without blinding the rest of it. Returns { html, found, fraction }.
//
// Deliberately structural rather than a phrase window: `allowPhrases` blanks a fixed +/-120
// characters, which is both too much (it can swallow a neighbouring assertion's token) and too
// little (a list of six cards is far wider than 120 chars). Section boundaries are the same
// boundaries the page author used.
function exciseSection(html, heading) {
  const at = html.indexOf(heading);
  if (at === -1) return { html, found: false, fraction: 0 };

  const open = html.lastIndexOf('<section', at);
  if (open === -1) return { html, found: false, fraction: 0 };

  // Walk forward from the opening tag, counting nested <section> so we close the right one.
  const tagRe = /<(\/?)section\b/gi;
  tagRe.lastIndex = open;
  let depth = 0;
  let end = -1;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) {
      end = html.indexOf('>', m.index);
      end = end === -1 ? html.length : end + 1;
      break;
    }
  }
  if (end === -1) return { html, found: false, fraction: 0 };

  const fraction = (end - open) / html.length;
  return { html: html.slice(0, open) + ' ' + html.slice(end), found: true, fraction };
}

async function pollUntil(predicate, label) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    attempt += 1;
    const result = await predicate();
    console.log(`  [${label}] attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s): ${JSON.stringify(result).slice(0, 220)}`);
    if (result.ok) return { ok: true, attempts: attempt };
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  return { ok: false, attempts: attempt };
}

await runCheck('check-show-identity-sweep', async (r) => {
  const secret = loadEnvOrFail('SANITY_REVALIDATE_SECRET');
  const client = getSanityClient({ withToken: true });

  await withDatasetLock('check-show-identity-sweep', async () => {
    const baseline = await client.fetch(
      `*[_id == $id][0]{ _rev, location, showDate, showEndDate, edition, hostRegion, countdownDate, venue }`,
      { id: DOC_ID },
    );

    if (!baseline) {
      r.fail('nationalShow singleton exists', 'nothing at _id "nationalShow"');
      return;
    }

    // Baselines are INPUT. Validate at the boundary — a blank or sentinel-shaped baseline makes
    // every negative assertion below vacuous, and would be restored as permanent residue.
    assertUsableBaseline('nationalShow.venue.name', baseline.venue?.name);
    assertUsableBaseline('nationalShow.venue.city', baseline.venue?.city);
    assertUsableBaseline('nationalShow.showDate', baseline.showDate);
    assertUsableBaseline('nationalShow.hostRegion', baseline.hostRegion);
    if (typeof baseline.edition !== 'number') {
      r.fail('nationalShow.edition is a number', `got ${JSON.stringify(baseline.edition)}`);
      return;
    }

    // ---- Old-identity tokens, derived from the baseline. Nothing hardcoded. ----
    const OLD = {
      venue: baseline.venue.name,
      city: baseline.venue.city,
      year: String(new Date(baseline.showDate).getFullYear()),
      ordinal: toOrdinal(baseline.edition),
      roman: toRoman(baseline.edition),
    };
    console.log(`  old identity tokens: ${JSON.stringify(OLD)}`);

    // ---- New identity, invented here. ----
    const stamp = Date.now();
    const NEW = {
      venue: makeSentinel('SWEEPVENUE'),
      city: makeSentinel('SWEEPCITY'),
      province: makeSentinel('SWEEPPROVINCE'),
      address: makeSentinel('SWEEPADDRESS'),
      region: makeSentinel('SWEEPREGION'),
      year: SWEEP_YEAR,
      ordinal: toOrdinal(SWEEP_EDITION),
      roman: toRoman(SWEEP_EDITION),
    };
    console.log(`  sweep stamp ${stamp}; new venue ${NEW.venue}`);

    // ---- Which surface must show what. ----
    //
    // `fail` tokens: an old-identity token here can only have come from code — these pages
    // render show identity from structured fields, not from long CMS prose.
    // `warn` tokens: the visitor pages are almost entirely Sanity-authored prose, and the seed
    // legitimately names the working venue inside parking/travel/attraction copy. Stale prose
    // after a venue change is an editor's job in Studio — which is exactly what the mission
    // rule asks for — so it is reported, not failed.
    // `allowPhrases`: narrow, justified exemptions where a token appears for an unrelated reason.
    const SURFACES = [
      {
        path: '/',
        expect: [NEW.venue, NEW.region, NEW.ordinal, NEW.year],
        fail: [OLD.venue, OLD.year, OLD.ordinal, OLD.roman, OLD.city],
        // NavCards describes the SOCIETY network, not the show: "From Cape Town to Polokwane —
        // meet the affiliates". That sentence names a city for an unrelated reason.
        allowPhrases: ['meet the affiliates'],
      },
      {
        path: PATHS.landing,
        expect: [NEW.venue, NEW.city, NEW.region, NEW.year],
        fail: [OLD.venue, OLD.year, OLD.ordinal, OLD.roman, OLD.city],
        allowPhrases: [],
        // The "Past editions" list names the host venue of each PAST show, and one of those
        // (2018, Cape Town City Hall) is legitimately in the current venue's city. That is a
        // historical record — no Studio edit should ever rewrite it, so no venue change can
        // clear the token and the assertion could never go green. The archive page already
        // carries this carve-out for the same reason; this extends it to the same list on the
        // landing page. SCOPE: the city token, inside that one <section>, and nothing else —
        // a stale CURRENT city anywhere else on the page still fails, and venue name, year,
        // ordinal and roman edition are still asserted across the WHOLE page including this
        // section.
        regionExempt: { heading: PAST_EDITIONS_HEADING, tokens: [OLD.city] },
      },
      {
        path: PATHS.contact,
        expect: [NEW.venue, NEW.city],
        fail: [OLD.venue, OLD.year, OLD.ordinal, OLD.roman],
        allowPhrases: [],
      },
      {
        path: PATHS.archive,
        expect: [NEW.year],
        // City excluded: the archive lists PAST shows, which legitimately name their own host
        // cities, and one of those may be this venue's city.
        fail: [OLD.venue, OLD.year, OLD.ordinal, OLD.roman],
        allowPhrases: [],
      },
      {
        path: PATHS.plan,
        expect: [NEW.venue, NEW.city],
        fail: [],
        warn: [OLD.venue, OLD.city],
        allowPhrases: [],
      },
      {
        path: PATHS.expect,
        expect: [],
        fail: [],
        warn: [OLD.venue, OLD.city],
        allowPhrases: [],
      },
      {
        path: PATHS.faq,
        expect: [],
        fail: [],
        warn: [OLD.venue, OLD.city],
        allowPhrases: [],
      },
    ];

    let mutated = false;
    let sweepRev = null;

    try {
      sweepRev = await commitAndCaptureRev(client, DOC_ID, {
        'venue.name': NEW.venue,
        'venue.city': NEW.city,
        'venue.province': NEW.province,
        'venue.addressLines': [NEW.address],
        showDate: SWEEP_SHOW_DATE,
        showEndDate: SWEEP_SHOW_END_DATE,
        edition: SWEEP_EDITION,
        hostRegion: NEW.region,
      });
      mutated = true;
      // Unset separately: countdownDate absent is the S6 fail-closed case.
      await client.patch(DOC_ID).unset(['countdownDate']).commit();
      sweepRev = (await client.fetch('*[_id == $id][0]._rev', { id: DOC_ID }));
      console.log(`  swept; nationalShow now at _rev ${sweepRev}`);

      const reval = await callRevalidate(secret, DOC_ID);
      r.check(reval.status === 200, '/api/revalidate accepted the invalidation', `status ${reval.status}`);

      // Propagation is bounded by the Sanity CDN (sanity/lib/fetch.ts sets useCdn:true), not by
      // revalidateTag. @qa measured 64s / 72s / ~96s under load; 240s is the headroom.
      //
      // THE GATE MUST NOT BE THE THING UNDER TEST. The first draft of this check polled for the
      // new venue name on /national-show — which is precisely the surface S1 breaks, so it
      // waited the full 240s for something that could never happen and reported a propagation
      // failure instead of the venue defect. The gate now watches VenueCard on
      // /national-show/plan-your-visit, which round 1 already proved reads venue.* from Sanity
      // (A41) and which none of round 2's fixes touch.
      const landed = await pollUntil(async () => {
        const { body } = await fetchOkPage(PATHS.plan);
        const text = visibleText(body);
        const seen = contains(text, NEW.city);
        return { ok: seen, sawNewCityOnVenueCard: seen };
      }, 'propagation');

      if (!landed.ok) {
        r.fail(
          `the swapped venue reaches ${PATHS.plan} within ${POLL_TIMEOUT_MS / 1000}s`,
          'the propagation GATE failed, not an assertion under test — VenueCard is not reading ' +
            'venue.city from Sanity, so nothing below can be trusted. Remaining assertions skipped.',
        );
        return;
      }

      // ---- Settle every surface, then assert on the response that settled ----
      //
      // The gate above only proves ONE page has caught up. Each route carries
      // `export const revalidate = 60`, so a surface not yet re-rendered serves the stale copy
      // and kicks off regeneration in the background — the first fetch after a write is
      // routinely stale even when the data has propagated. Asserting on that first fetch would
      // report every surface as broken, which is a false RED indistinguishable from a real one.
      //
      // The previous version slept a fixed 2 x 20s and hoped. It outran the stale window on
      // lucky runs and did not on unlucky ones, which is the worst property an assertion can
      // have: the crux test of this mission was reporting the weather. It now POLLS each
      // surface until every NEW token that surface must show is present, and then asserts —
      // negatives included — on that same response body. Freshness is therefore proven per
      // surface rather than assumed, and a surface that never becomes fresh times out and
      // fails its expectations, which is the correct RED.
      //
      // Surfaces with no `expect` tokens (the visitor prose pages) have no `fail` tokens
      // either — only warns — so a single fetch is all their assertions need.
      async function settleSurface(surface) {
        const wanted = surface.expect ?? [];
        if (wanted.length === 0) return (await fetchOkPage(surface.path)).body;

        let lastBody = '';
        const start = Date.now();
        let attempt = 0;
        while (Date.now() - start < SURFACE_SETTLE_TIMEOUT_MS) {
          attempt += 1;
          lastBody = (await fetchOkPage(surface.path)).body;
          const text = visibleText(lastBody);
          const missing = wanted.filter((t) => !contains(text, t));
          if (missing.length === 0) {
            console.log(
              `  [settle] ${surface.path} fresh after ${attempt} fetch(es), ` +
                `t+${Math.round((Date.now() - start) / 1000)}s`,
            );
            return lastBody;
          }
          console.log(
            `  [settle] ${surface.path} attempt ${attempt} (t+${Math.round((Date.now() - start) / 1000)}s): ` +
              `still missing ${JSON.stringify(missing.map((t) => String(t).slice(0, 28)))}`,
          );
          await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
        }
        console.warn(
          `  [settle] ${surface.path} never became fresh within ${SURFACE_SETTLE_TIMEOUT_MS / 1000}s — ` +
            'asserting on the last response, which will fail its expectations below',
        );
        return lastBody;
      }

      // ---- 2 & 3: sweep every surface ----
      for (const surface of SURFACES) {
        const body = await settleSurface(surface);
        let text = visibleText(body);
        for (const phrase of surface.allowPhrases ?? []) {
          const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
          if (idx !== -1) {
            // Blank out a generous window around the justified phrase so its incidental token
            // does not register, without blinding the rest of the page.
            text = text.slice(0, Math.max(0, idx - 120)) + ' ' + text.slice(idx + phrase.length + 120);
          }
        }

        // Text with the exempted region cut out. Used ONLY for the tokens that region exempts;
        // every other token is still asserted against the whole page.
        let textOutsideRegion = text;
        const exempt = surface.regionExempt;
        if (exempt) {
          const cut = exciseSection(body, exempt.heading);
          r.check(
            cut.found,
            `${surface.path} still has a "${exempt.heading}" section for the historical carve-out to apply to`,
            'the section was not found, so the carve-out did not apply and the exempted tokens ' +
              'were asserted against the whole page (strict, but the exemption is now dead code)',
          );
          r.check(
            !cut.found || cut.fraction < MAX_EXCISED_FRACTION,
            `${surface.path} historical carve-out stays narrow (excised ${(cut.fraction * 100).toFixed(1)}% of the page)`,
            `a carve-out over ${MAX_EXCISED_FRACTION * 100}% of the page is a page-level exemption in disguise`,
          );
          if (cut.found && cut.fraction < MAX_EXCISED_FRACTION) {
            textOutsideRegion = visibleText(cut.html);
          }
        }

        for (const token of surface.expect ?? []) {
          r.check(
            contains(text, token),
            `${surface.path} renders the NEW show identity token "${String(token).slice(0, 40)}"`,
            'this surface still is not reading the value from Sanity',
          );
        }
        for (const token of surface.fail ?? []) {
          const exempted = (exempt?.tokens ?? []).includes(token);
          const haystack = exempted ? textOutsideRegion : text;
          r.check(
            !contains(haystack, token),
            `${surface.path} renders NO trace of the OLD identity token "${token}"` +
              (exempted ? ` (outside the "${exempt.heading}" historical record)` : ''),
            'the dataset no longer holds this value, so it can only have come from code — ' +
              'changing the venue is supposed to be a Studio edit',
          );
        }
        for (const token of surface.warn ?? []) {
          if (contains(text, token)) {
            console.warn(
              `  WARN  ${surface.path} still shows "${token}" in CMS-authored prose — an editor ` +
                'must reword it in Studio after a venue change (not a code defect)',
            );
          }
        }
      }

      // ---- S6: countdownDate is unset, so nothing may invent one ----
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(`${BASE_URL}${PATHS.landing}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2_000);
        const countdowns = page.locator('[aria-label*="Countdown" i]');
        const count = await countdowns.count();
        let ticking = false;
        for (let i = 0; i < count; i += 1) {
          const txt = (await countdowns.nth(i).innerText()).replace(/\s+/g, ' ');
          const m = txt.match(/(\d+)\s*Days/i);
          if (m && Number(m[1]) > 0) ticking = true;
        }
        r.check(
          !ticking,
          'with countdownDate unset, no surface renders a fabricated ticking countdown',
          'ShowCountdown/ShowBand is falling back to a hardcoded DEFAULT_COUNTDOWN_DATE and ' +
            'presenting an invented date as a live fact',
        );
        // The aria-label must not name a stale edition either.
        for (let i = 0; i < count; i += 1) {
          const label = (await countdowns.nth(i).getAttribute('aria-label')) ?? '';
          r.check(
            !contains(label, OLD.ordinal),
            `countdown aria-label carries no stale edition ("${OLD.ordinal}")`,
            `aria-label is ${JSON.stringify(label)}`,
          );
        }
      } finally {
        await browser.close();
      }
    } finally {
      if (mutated) {
        console.log('--- Cleanup: restoring the captured show identity (revision-guarded) ---');
        const restoreValues = {
          venue: baseline.venue,
          showDate: baseline.showDate,
          showEndDate: baseline.showEndDate,
          edition: baseline.edition,
          hostRegion: baseline.hostRegion,
          countdownDate: baseline.countdownDate,
        };
        try {
          await restoreGuarded(client, DOC_ID, restoreValues, sweepRev);
          const verified = await verifyDatasetRestored(client, DOC_ID, restoreValues);
          await callRevalidate(secret, DOC_ID);

          // Verified on the same independent surface, for the same reason.
          const clean = await pollUntil(async () => {
            const [plan, landing] = await Promise.all([fetchOkPage(PATHS.plan), fetchOkPage(PATHS.landing)]);
            const planText = visibleText(plan.body);
            const landingText = visibleText(landing.body);
            const sentinelsGone =
              !contains(planText, NEW.venue) && !contains(planText, NEW.city) &&
              !contains(landingText, NEW.venue) && !contains(landingText, NEW.region);
            const oldBack = contains(planText, OLD.venue);
            return { ok: sentinelsGone && oldBack, sentinelsGone, oldBack };
          }, 'cleanup');

          if (!verified.ok || !clean.ok) {
            residueAlert([
              `document: ${DOC_ID}`,
              `sweep sentinels: ${NEW.venue}, ${NEW.city}, ${NEW.region}`,
              `dataset restored: ${verified.ok} (mismatched: ${JSON.stringify(verified.mismatched)})`,
              `rendered page clean: ${clean.ok}`,
            ]);
          } else {
            console.log('Cleanup verified: dataset restored and every sweep sentinel is gone from the live page.');
          }
        } catch (err) {
          residueAlert([
            `document: ${DOC_ID}`,
            `sweep sentinels: ${NEW.venue}, ${NEW.city}, ${NEW.region}`,
            `restore threw: ${err.message}`,
            'A revision-guard failure means SOMETHING ELSE WROTE to nationalShow during this ' +
              'check. Do not blind-restore — reconcile by hand.',
            `baseline to restore: ${JSON.stringify({ venue: baseline.venue, showDate: baseline.showDate, showEndDate: baseline.showEndDate, edition: baseline.edition, hostRegion: baseline.hostRegion, countdownDate: baseline.countdownDate })}`,
          ]);
        }
      }
    }
  });
});
