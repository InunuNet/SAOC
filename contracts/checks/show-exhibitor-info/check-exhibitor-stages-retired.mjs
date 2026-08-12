#!/usr/bin/env node
// F4 — one source for the exhibitor journey, enforced against the DATASET rather than the schema.
//
// THE FAILURE THIS CATCHES
// ------------------------
// `nationalShow.exhibitorStages` is a portable-text field that still exists, is still projected by
// nationalShowQuery, and still renders on the show landing page. Today it is unset, so nothing of
// it reaches a reader — which is precisely why it is dangerous rather than merely untidy. It is a
// latent defect with a human trigger: a committee member opens the National Show document in
// Studio, finds an inviting empty box labelled "Exhibitor Stages", and fills it in. From that
// moment the site publishes two exhibitor journeys — a free-text blob on the landing page and the
// structured guide at /national-show/exhibitors — which will drift apart immediately and which no
// editor has any way of knowing about. F4 said it plainly: "do not leave two overlapping sources."
//
// WHY A TRIPWIRE AND NOT A DELETION
// ---------------------------------
// Deleting the field is FU-2 and this contract cannot execute it. Two files are involved and both
// belong to the visitor stream, and worse, that stream's own A5 currently asserts the field must
// STILL EXIST (contract-show-visitor-info.yaml:131). Removing it would turn a sibling gate red:
// the two contracts would be asserting opposite things about the same line. Attempting it would
// lose a merge race and break someone else's gate, which is not a trade this contract gets to make
// unilaterally.
//
// So the field stays and the CONTENT is guarded instead. Retirement is a state of the data, not
// only a state of the schema, and the state that matters — nobody is publishing through the old
// field — is assertable today without touching a single reserved file. The day someone fills it
// in, this goes red with instructions, instead of the drift being discovered months later by a
// reader who believed the wrong journey.
//
// When FU-2 finally lands, this assertion does not become obsolete: a deleted field with orphaned
// data still in the document would still be caught here.

import { runCheck, getSanityClient, fetchOkPage, PATHS, visibleText } from './_shared.mjs';

const FIELD = 'exhibitorStages';

await runCheck('check-exhibitor-stages-retired', async (r) => {
  const client = getSanityClient();
  const rows = await client.fetch(
    `*[_type == "nationalShow"]{ _id, "hasStages": defined(${FIELD}), "stageCount": count(${FIELD}) }`,
  );

  r.check(rows.length > 0, 'there is a nationalShow document to inspect');

  for (const row of rows) {
    r.check(
      !row.hasStages,
      `nationalShow ${row._id} publishes nothing through the retired ${FIELD} field`,
      `${FIELD} now holds ${row.stageCount ?? '?'} block(s). The site is publishing TWO exhibitor ` +
        'journeys: this blob on /national-show and the structured guide at ' +
        `${PATHS.exhibitors}. They will drift apart and no editor can see that the other exists. ` +
        'Move the content into showExhibitorStep documents (Studio → Exhibitor Steps) and clear ' +
        'this field. See contracts/golden/show-exhibitor-info/exhibitorStages-reconciliation.golden.md.',
    );
  }

  // A second, independent reading of the same claim: whatever the dataset says, the landing page
  // must not be rendering a competing journey. Asserted against the rendered bytes, because a
  // hardcoded fallback constant in page.tsx would satisfy the dataset test above and still put a
  // second journey in front of a reader — and the landing page has exactly such a constant
  // (EXHIBITOR_STAGES).
  const guide = await fetchOkPage(PATHS.exhibitors);
  const landing = await fetchOkPage(PATHS.landing);
  const landingText = visibleText(landing.body).toLowerCase();

  const steps = await client.fetch('*[_type == "showExhibitorStep" && active == true]{ title }');
  r.check(steps.length > 0, `there are active exhibitor steps to compare against (${steps.length})`);

  const duplicated = steps
    .map((s) => String(s.title ?? '').trim())
    .filter((t) => t.length >= 8 && landingText.includes(t.toLowerCase()));

  r.check(
    duplicated.length === 0,
    'the show landing page does not restate the exhibitor journey',
    `these step titles from the guide also appear on ${PATHS.landing}: ` +
      `${JSON.stringify(duplicated)}. One journey, one page.`,
  );

  r.check(
    guide.body.length > 0,
    `${PATHS.exhibitors} is the page carrying the journey`,
  );
});
