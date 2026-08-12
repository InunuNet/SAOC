#!/usr/bin/env node
// RENDERED — /national-show/exhibitors actually renders the content stored in Sanity.
//
// Every needle is read live out of the dataset. A page with the copy frozen into JSX cannot pass
// this, because the check does not know what the copy says until it asks Sanity.
//
// This is the check that catches the project's recurring false green: a field present in the
// schema, present in the GROQ query, assigned to a variable in the page component, and never
// placed in JSX. The schema greps in the contract cannot see that. This can.

import {
  runCheck,
  fetchOkPage,
  fetchExhibitorInfo,
  fetchExhibitorSteps,
  portableTextToPlain,
  needleFrom,
  textContains,
  SECTION_BLOCKS,
  PATHS,
} from './_shared.mjs';

await runCheck('check-page-renders', async (r) => {
  const info = await fetchExhibitorInfo();
  const steps = await fetchExhibitorSteps();
  const { body } = await fetchOkPage(PATHS.exhibitors);

  // --- top-level copy ---
  for (const field of ['title', 'intro', 'keyDatesHeading', 'keyDatesNote', 'entryFormHeading', 'questionsHeading', 'questionsIntro']) {
    const value = info[field];
    r.check(
      typeof value === 'string' && value.trim().length > 0,
      `dataset holds ${field}`,
      `got ${JSON.stringify(value)} — the seed did not run, or seeded an empty string`,
    );
    if (typeof value === 'string' && value.trim()) {
      r.check(textContains(body, needleFrom(value)), `${PATHS.exhibitors} renders ${field}`);
    }
  }

  // --- the nine section blocks: heading AND body must both reach the page ---
  for (const block of SECTION_BLOCKS) {
    const section = info[block];
    if (!section || typeof section !== 'object') {
      r.fail(`dataset holds section ${block}`, `got ${JSON.stringify(section)}`);
      continue;
    }
    r.check(
      typeof section.heading === 'string' && section.heading.trim().length > 0,
      `section ${block} has a heading`,
    );
    r.check(textContains(body, needleFrom(section.heading, 40)), `page renders ${block} heading`);

    const plain = portableTextToPlain(section.body);
    r.check(plain.length > 0, `section ${block} has body copy`, 'portable text is empty');
    if (plain.length > 0) {
      r.check(
        textContains(body, needleFrom(plain, 70)),
        `page renders ${block} body`,
        'the heading rendered but the portable-text body did not — a PortableText component is missing or the query dropped the body',
      );
    }
  }

  // --- key dates: every row, label and dateNote ---
  const keyDates = Array.isArray(info.keyDates) ? info.keyDates : [];
  r.check(keyDates.length >= 5, 'dataset holds at least five key-date rows', `got ${keyDates.length}`);
  for (const row of keyDates) {
    r.check(textContains(body, row.label), `page renders key date label "${row.label}"`);
    r.check(
      textContains(body, needleFrom(row.dateNote, 40)),
      `page renders the dateNote for "${row.label}"`,
    );
  }

  // --- steps: every active step renders, every inactive one does NOT ---
  const active = steps.filter((s) => s.active !== false);
  const inactive = steps.filter((s) => s.active === false);
  r.check(active.length >= 7, 'dataset holds at least seven active exhibitor steps', `got ${active.length}`);
  for (const step of active) {
    r.check(textContains(body, step.title), `page renders active step "${step.title}"`);
    if (typeof step.when === 'string' && step.when.trim()) {
      r.check(textContains(body, needleFrom(step.when, 40)), `page renders the "when" for "${step.title}"`);
    }
  }
  for (const step of inactive) {
    r.check(
      !textContains(body, step.title),
      `page HIDES inactive step "${step.title}"`,
      'an inactive step reached the page — the query is not filtering on active',
    );
  }

  // Order is meaning here, not decoration: the journey must render in `order` ascending.
  const visible = (await import('./_shared.mjs')).visibleText(body).toLowerCase();
  const positions = active
    .map((s) => ({ title: s.title, at: visible.indexOf(String(s.title).toLowerCase()) }))
    .filter((p) => p.at !== -1);
  const ordered = positions.every((p, i) => i === 0 || positions[i - 1].at < p.at);
  r.check(
    ordered,
    'the exhibitor steps render in `order` ascending',
    `positions: ${JSON.stringify(positions)} — the query is not ordering, or the page re-sorts`,
  );

  // --- open questions ---
  const questions = Array.isArray(info.openQuestions) ? info.openQuestions : [];
  r.check(questions.length >= 10, 'dataset holds at least ten open questions', `got ${questions.length}`);
  for (const q of questions) {
    r.check(textContains(body, needleFrom(q.question, 50)), `page renders question: ${needleFrom(q.question, 45)}…`);
  }
  // The context is what stops each question reading as ignorance rather than diligence.
  for (const q of questions) {
    if (typeof q.context === 'string' && q.context.trim()) {
      r.check(
        textContains(body, needleFrom(q.context, 50)),
        `page renders the context behind: ${needleFrom(q.question, 35)}…`,
      );
    }
  }
});
