#!/usr/bin/env node
// THE SUBSTANTIVE CRUX, asserted rather than merely written down in prose.
//
// "Never state a rule as SAOC policy that SAOC has not confirmed." A badge beside a paragraph is
// not enough on its own, because the grammar of the paragraph is what a reader actually absorbs.
// "Entries close at 4pm on the Thursday" reads as fact no matter what marker sits above it.
//
// This check reads the SEEDED COPY OUT OF THE DATASET and refuses:
//   1. Unhedged declarations of a rule as settled ("Entries close on…", "The entry fee is…").
//   2. Invented concrete quantities — a time of day, a currency amount, an explicit date. A
//      spelled-out figure inside an attributed sentence ("OSGB requires twelve months") is fine;
//      that is a verifiable fact about another organisation, not an invented SAOC rule.
//   3. Any statement implying CITES applies to domestic movement of cultivated plants.
//   4. Wild-orchid habitat/conservation content, which is WOSA's, not SAOC's.
//
// It runs against the dataset, not the page source, because the dataset is what an editor sees
// and what actually renders. If someone later edits a block in Studio into a bare imperative, the
// gate goes red — which is the point. This check protects the posture over time, not just at
// ship time.

import {
  runCheck,
  fetchExhibitorInfo,
  fetchExhibitorSteps,
  portableTextToPlain,
} from './_shared.mjs';

// 1. Phrases that assert a rule as settled SAOC fact. Each one is a sentence an exhibitor could
//    reasonably plan around.
const UNHEDGED = [
  /\bentries close (on|at)\b/i,
  /\bthe (entry )?deadline is\b/i,
  /\bthe entry fee is\b/i,
  /\bfees are\s+R/i,
  /\bstaging (opens|closes) (on|at)\b/i,
  /\bmust be benched by\b/i,
  /\bplants must be (collected|removed) (on|at|by)\b/i,
  /\byou have owned (it|them) for \d+/i,
];

// 2. Concrete quantities that can only have been invented.
const INVENTED_QUANTITY = [
  { re: /\b\d{1,2}\s?(am|pm)\b/i, what: 'a time of day' },
  { re: /\b([01]?\d|2[0-3]):[0-5]\d\b/, what: 'a 24-hour clock time' },
  { re: /\bR\s?\d[\d\s,.]*\b/, what: 'a rand amount' },
  { re: /\bZAR\s?\d/i, what: 'a rand amount' },
  {
    re: /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
    what: 'an explicit calendar date',
  },
  {
    re: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/i,
    what: 'an explicit month and year',
  },
];

// 1b. BARE RULE STATEMENTS — QA finding F-8.
//
// The UNHEDGED list above catches specific sentences an exhibitor could plan a diary around
// ("Entries close on…"). It caught none of these three, which sat in the key-dates Detail column:
//
//     "Every plant needs to be on its bench before staging closes."
//     "Plants stay benched for the full run of the show."
//     "Judging takes place after staging closes, before the public are admitted."
//
// No time, no date, no fee — and still three rules SAOC has not made. The second is a removal
// rule: if SAOC permits early collection it is simply wrong, and an exhibitor who believes it
// plans a Sunday they did not need to spend. A marker in the adjacent When cell does not license
// a bare assertion in the Detail cell; the brief is explicit about that.
//
// A denylist of these forms cannot work — the page says "At most shows, judging takes place after
// staging closes", which is the SAME verb phrase, correctly hedged, and must pass. So the rule is
// inverted and scoped to the sentence: a sentence in a RULE_SHAPE must carry a hedging cue IN
// THAT SENTENCE. That is how the rest of this page's copy is already written, which is why the
// pattern set below catches exactly the four offending sentences and nothing else across all 133
// scanned fields.
//
// Interrogatives are exempt. "Must an exhibitor have grown a plant for a minimum period?" is an
// open question in the questions block — the opposite of stating a rule, and the single false
// positive this rule produced before the exemption was added.

const RULE_SHAPE = [
  /\b(needs? to|must|ha[sv]e to|is required|are required|will be required)\b/i,
  /\b(plants?|exhibits?|entries)\s+(stay|stays|remain|remains)\b/i,
  /\b(judging|staging|benching|removal|collection)\s+(takes place|happens|occurs)\b/i,
];

// Any of these in the same sentence marks it as reported practice, an open question, or an
// explicit non-answer, rather than an SAOC decision.
const HEDGE_CUE =
  /\b(most shows|many shows|some shows|other shows|shows generally|generally|typically|usually|commonly|often|elsewhere|international|convention|practice|SAOC has not|has not been|have not been|not been (set|published|confirmed)|to be (set|confirmed|published)|could not|cannot confirm|not yet|we do not know|unknown|expects?|likely|may|might|would|ask|question|assume|check with|confirm with)\b/i;

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 4. Wild-orchid scope creep. SAOC is orchids in cultivation.
const WILD_ORCHID = [
  /\bhabitat\b/i,
  /\bin the wild\b/i,
  /\bwild[- ]collected\b/i,
  /\bconservation status\b/i,
  /\bred list\b/i,
];

// ---------------------------------------------------------------------------
// What gets scanned: EVERYTHING, by construction.
// ---------------------------------------------------------------------------
// This started as a hand-written list of fields and it was wrong in the way hand-written lists of
// fields are always wrong. It named `title` and `when` on each journey step and not `body` — so
// the seven step documents, the second-largest body of prose on the page, were exempt from the one
// check this mission exists for. QA proved it with a control sentence: "Entries close on 3 March
// at 4pm. The entry fee is R250 per plant." produced seven failures in `fees.body` and zero in a
// step body. Six more fields were unscanned for the same reason, including every heading.
//
// An allowlist has to be maintained by whoever adds the next field, and they will not know it
// exists. So the check now walks the documents and reads every string in them. The rule is
// inverted: a field is scanned unless it is structurally incapable of carrying prose.
//
// Two exclusions, both mechanical rather than editorial:
//   - keys beginning with `_` are Sanity's own (`_id`, `_rev`, `_createdAt`, …). `_createdAt` is
//     an ISO timestamp and would trip the 24-hour-clock pattern on every run.
//   - portable-text arrays are flattened WHOLE, not span by span. Walking their children
//     individually would split "Entries close on **3 March**" at the bold marker and match
//     neither half — a formatting-shaped hole in exactly the field most likely to be edited.

const SYSTEM_KEY = /^_/;

function isPortableText(value) {
  return Array.isArray(value) && value.some((b) => b && typeof b === 'object' && b._type === 'block');
}

function collectStrings(value, id, out) {
  if (typeof value === 'string') {
    out.push({ id, text: value });
    return;
  }
  if (isPortableText(value)) {
    out.push({ id, text: portableTextToPlain(value) });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectStrings(item, `${id}[${i}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (SYSTEM_KEY.test(key)) continue;
      collectStrings(child, id ? `${id}.${key}` : key, out);
    }
  }
}

function collectCopy(info, steps) {
  const entries = [];
  collectStrings(info, '', entries);
  for (const step of steps) {
    // Identify by _id, not by title: a step whose title is the thing being edited into a bare
    // deadline should not also rename its own failure message.
    collectStrings(step, `step:${step._id}`, entries);
  }
  return entries.filter((e) => e.text.trim().length > 0);
}

await runCheck('check-policy-language', async (r) => {
  const info = await fetchExhibitorInfo();
  const steps = await fetchExhibitorSteps();
  const entries = collectCopy(info, steps);

  r.check(entries.length >= 20, `there is real seeded copy to inspect (${entries.length} fields)`);

  // --- 1. no unhedged rule statements ---
  for (const entry of entries) {
    for (const re of UNHEDGED) {
      const m = entry.text.match(re);
      r.check(
        m === null,
        `${entry.id} states no rule as settled fact`,
        m ? `matched "${m[0]}" — rephrase as international practice or as an open question. An ` +
            'exhibitor who plans around this and finds it wrong at staging has been harmed by us.'
          : undefined,
      );
    }
  }

  // --- 1b. every rule-shaped sentence carries a hedge ---
  for (const entry of entries) {
    for (const sentence of sentences(entry.text)) {
      if (sentence.endsWith('?')) continue;
      const shape = RULE_SHAPE.find((re) => re.test(sentence));
      if (!shape) continue;
      r.check(
        HEDGE_CUE.test(sentence),
        `${entry.id} hedges its rule-shaped sentence`,
        `"${sentence}" states a condition of entry as though SAOC had decided it. Nothing on this ` +
          'page has been decided. Attribute it ("Most shows expect…"), or file it as an open ' +
          'question. A marker in the next table cell does not license a bare assertion in this one.',
      );
    }
  }

  // --- 2. no invented concrete quantity ---
  for (const entry of entries) {
    for (const { re, what } of INVENTED_QUANTITY) {
      const m = entry.text.match(re);
      r.check(
        m === null,
        `${entry.id} contains no invented ${what}`,
        m ? `matched "${m[0]}". SAOC has not set this. Spell attributed figures as words with the ` +
            'source named (e.g. "the Orchid Society of Great Britain requires twelve months").'
          : undefined,
      );
    }
  }

  // --- 3. CITES ---
  const citesEntries = entries.filter((e) => /\bCITES\b/.test(e.text));
  if (citesEntries.length === 0) {
    console.log('  NOTE  no seeded copy mentions CITES.');
  }
  for (const entry of citesEntries) {
    r.check(
      /\binternational\b/i.test(entry.text),
      `${entry.id} scopes CITES to international movement`,
      'CITES governs import/export across a national border. It does not apply to moving ' +
        'cultivated plants between South African provinces, and copy that leaves that ambiguous ' +
        'will frighten exhibitors out of entering.',
    );
    r.check(
      !/\bCITES (permit|paperwork|certificate)s? (is|are) required\b/i.test(entry.text) &&
        !/\byou (will )?need a CITES\b/i.test(entry.text) &&
        !/\bmust (obtain|have) a CITES\b/i.test(entry.text),
      `${entry.id} asserts no CITES requirement for domestic entries`,
    );
  }

  // The permits block must be an open question, not a stated rule.
  r.check(
    info.confirmations?.permits === 'question',
    "the permits block carries the 'question' status",
    `got ${JSON.stringify(info.confirmations?.permits)} — the research could not establish whether ` +
      'any domestic requirement applies, so this block asks rather than tells',
  );
  r.check(
    info.confirmations?.practicalities === 'question',
    "the practicalities block carries the 'question' status (security, watering, insurance, loading)",
    `got ${JSON.stringify(info.confirmations?.practicalities)} — research section 8 found these in ` +
      'no public exhibitor document anywhere; they are gaps, not conventions',
  );

  // --- attribution: the one foreign-show number that appears in the copy must name its source ---
  const eligibility = portableTextToPlain(info.eligibility?.body);
  if (/twelve months|12 months/i.test(eligibility)) {
    r.check(
      /Orchid Society of Great Britain|OSGB/i.test(eligibility),
      'the twelve-month ownership figure is attributed to the show that actually uses it',
      'an unattributed duration reads as an SAOC rule. The research is explicit that the concept is ' +
        "widespread but the number is show-specific — \"leave the number for SAOC's committee\".",
    );
  }

  // --- 4. wild orchids are WOSA's ---
  for (const entry of entries) {
    for (const re of WILD_ORCHID) {
      const m = entry.text.match(re);
      r.check(
        m === null,
        `${entry.id} stays within SAOC's scope (orchids in cultivation)`,
        m ? `matched "${m[0]}" — wild-orchid habitat and conservation belong to WOSA. Link to ` +
            'wildorchids.co.za instead of describing it.'
          : undefined,
      );
    }
  }
});
