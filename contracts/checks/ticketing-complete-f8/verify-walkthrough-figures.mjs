// F8 (ticketing-complete M4) -- contract-f8.yaml A15, negative control A22.
//
// NO FABRICATED VALUE: every price or cutoff date the morning-review walkthrough cites for a
// named ticket product must match that product's REAL field value in lib/provisional-figures.ts
// AT THE MOMENT THIS CHECK RUNS -- never a value that was true when the doc was drafted and has
// since drifted, and never an invented number. This script deliberately carries NO price or
// date literal of its own (see the "no magic numbers" ban this mission applies everywhere else,
// tightened here to a hard rule) -- every comparison value is read live from
// lib/provisional-figures.ts and from goldens/fixtures/f8-figure-citation-product-map.json,
// which itself carries only product-name aliases, never a figure.
//
// METHOD
// 1. Strip HTML comments from the doc before scanning -- an explanatory comment that happens
//    to mention a real (or a deliberately-wrong) figure must never be mistaken for prose Brad
//    actually reads (this bit a previous fixture draft for this same mission; see the
//    negative-fixture's own comment for the history).
// 2. Split the doc into sections by markdown heading (each section = one heading line through
//    the next heading or EOF) -- the natural unit a walkthrough groups one product's figures
//    under.
// 3. For each product in the citation map, for each of its aliases, find every section whose
//    body mentions that alias (case-insensitive).
// 4. Within each such section, extract every "R<number>" money citation and every ISO
//    (YYYY-MM-DD) date citation, and confirm each one matches one of that product's REAL
//    allowed values (price/regularPrice for money, earlyBirdCutoff for dates) as read from
//    lib/provisional-figures.ts right now. Any citation that doesn't match a real value is a
//    fabricated/drifted figure -- FAIL.
//
// DELIBERATELY NON-CURRENT FIGURES: the data-figure-status marker
// Added 2026-09-08 after a real design gap: a walkthrough section whose entire PURPOSE is to
// show Brad a mismatch -- "the live cutoff is X, the rule computes to Y, you decide" -- was
// unrepresentable here. Rule 4 above flags one of those two dates as fabricated no matter
// which is current, so the only way to pass was to keep product names and non-current dates
// in separate sections. That is a checker dictating document structure, which is backwards:
// the document should read the way Brad needs it to read.
//
// So a citation may be explicitly marked as deliberately non-current:
//
//     <span data-figure-status="legacy">2027-07-31</span>
//     <span data-figure-status="proposed">2027-06-18</span>
//
// Mirrors the <mark data-provisional-figure="true"> pattern this codebase already uses on
// /refunds (contracts/checks/policy-pages/check-refunds-provisional-figures.mjs) -- an
// existing convention, not a new invention.
//
// THE MARKER REDIRECTS THE CHECK; IT NEVER SWITCHES IT OFF FOR THAT PRODUCT. That sentence
// is the whole load-bearing idea of this design. Three rules enforce it:
//
//   (a) A marked citation is exempt from the must-match-current-value comparison, and is
//       stripped from the section text before bare extraction runs -- so it is never also
//       counted as an unmarked citation.
//   (b) The exemption applies ONLY when the attribute value is exactly `legacy` or
//       `proposed`. Any other value -- a typo, an empty string, a wrong case, an invented
//       keyword -- is NOT a marker: the span is left in place and its contents are extracted
//       and checked as an ordinary bare citation. Fail closed; never glob-accept the
//       attribute.
//   (c) THE DISCLOSURE INVARIANT. Whenever a product carries at least one marked citation of
//       a given kind (money or date), that product's REAL current value of that kind must
//       ALSO appear, UNMARKED, in some section of the doc that names that product. A section
//       may show Brad a legacy or proposed number beside a product name -- but only if the
//       ground-truth current number is disclosed to him somewhere too. A doc that cites
//       weekend-pass's legacy cutoff under a marker and never once shows its real current
//       value FAILS, even though every individual citation is "marked."
//
//       Scope note: the unmarked disclosure need not sit in the same section as the marked
//       citation -- any section naming that product will do -- but it must be attributable to
//       the product through the same alias mechanism as every other citation here. A bare
//       number floating in an unrelated section is NOT disclosure; accepting one would make
//       this invariant satisfiable without the property holding, which is the exact defect
//       class this whole assertion exists to catch.
//
// Usage:
//   node verify-walkthrough-figures.mjs <walkthrough.md>
//
// Exit 0 = every cited figure matches a real current value. Exit 1 = at least one cited figure
// doesn't match, or an input/module could not be read/parsed/imported (fail closed).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_MAP_PATH = path.join(
  REPO_ROOT,
  '.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f8-figure-citation-product-map.json'
);
const PROVISIONAL_FIGURES_PATH = path.join(REPO_ROOT, 'lib/provisional-figures.ts');

function fail(message) {
  console.error('FAIL: verify-walkthrough-figures.mjs');
  console.error(`  - ${message}`);
  process.exit(1);
}

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

// Splits doc text into { heading, body } sections at each markdown heading line. Content
// before the first heading is its own section with heading: null.
function splitIntoSections(text) {
  const lines = text.split('\n');
  const headingRe = /^#{1,6}\s+.*$/;
  const sections = [];
  let current = { heading: null, body: [] };
  for (const line of lines) {
    if (headingRe.test(line)) {
      sections.push(current);
      current = { heading: line, body: [] };
    } else {
      current.body.push(line);
    }
  }
  sections.push(current);
  return sections.map((s) => ({ heading: s.heading, text: s.body.join('\n') }));
}

function extractMoneyCitations(text) {
  const re = /R\s?([0-9][0-9,]*(?:\.[0-9]+)?)/g;
  const found = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    found.push(Number(match[1].replace(/,/g, '')));
  }
  return found;
}

function extractDateCitations(text) {
  const re = /\b(\d{4}-\d{2}-\d{2})\b/g;
  const found = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    found.push(match[1]);
  }
  return found;
}

// The ONLY two attribute values that mark a citation as deliberately non-current. Anything
// else is not a marker at all -- see rule (b) in the header. Exact match, no case folding:
// `Legacy` is a typo, and a typo must fail closed rather than silently exempt a figure.
const FIGURE_STATUS_LEGACY = 'legacy';
const FIGURE_STATUS_PROPOSED = 'proposed';
const VALID_FIGURE_STATUSES = new Set([FIGURE_STATUS_LEGACY, FIGURE_STATUS_PROPOSED]);

// Captures the raw attribute value (group 1) and the span's contents (group 2). The value is
// captured, never validated, by the pattern itself -- validation is an explicit set
// membership test below, so an invented keyword cannot pass by matching the shape.
const FIGURE_STATUS_SPAN_PATTERN =
  /<span\b[^>]*\bdata-figure-status="([^"]*)"[^>]*>([\s\S]*?)<\/span>/gi;

/**
 * Splits one section's text into the citations that carry a VALID status marker and the text
 * that remains after those markers are removed.
 *
 * A span whose attribute value is not exactly `legacy` or `proposed` is left in the returned
 * text verbatim, so its contents flow into the ordinary bare-citation extraction and get
 * checked like any other figure. That is rule (b): fail closed on a malformed marker.
 */
function partitionMarkedCitations(text) {
  const markedMoney = [];
  const markedDates = [];
  // Replaced with a space rather than the empty string so removing a span can never fuse two
  // adjacent tokens into a third that neither extractor would otherwise have seen.
  const strippedText = text.replace(
    FIGURE_STATUS_SPAN_PATTERN,
    (whole, statusValue, contents) => {
      if (!VALID_FIGURE_STATUSES.has(statusValue)) return whole;
      markedMoney.push(...extractMoneyCitations(contents));
      markedDates.push(...extractDateCitations(contents));
      return ' ';
    }
  );
  return { strippedText, markedMoney, markedDates };
}

async function loadProductMap() {
  let raw;
  try {
    raw = await readFile(PRODUCT_MAP_PATH, 'utf8');
  } catch (err) {
    fail(`could not read product citation map at ${PRODUCT_MAP_PATH}: ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`product citation map at ${PRODUCT_MAP_PATH} is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
    fail(`product citation map at ${PRODUCT_MAP_PATH} has no non-empty 'products' array`);
  }
  return parsed.products;
}

async function loadRealProducts() {
  let mod;
  try {
    mod = await import(PROVISIONAL_FIGURES_PATH);
  } catch (err) {
    fail(`could not import ${PROVISIONAL_FIGURES_PATH}: ${err.message}`);
  }
  const bySource = {
    ADMISSION_PRODUCTS: mod.ADMISSION_PRODUCTS,
    CONFERENCE_PRODUCTS: mod.CONFERENCE_PRODUCTS,
    WORKSHOP_FIELD_TRIP_PRODUCTS: mod.WORKSHOP_FIELD_TRIP_PRODUCTS,
  };
  for (const [name, value] of Object.entries(bySource)) {
    if (!Array.isArray(value)) {
      fail(`${PROVISIONAL_FIGURES_PATH} does not export a '${name}' array`);
    }
  }
  return bySource;
}

function findRealProduct(bySource, mapEntry) {
  const arr = bySource[mapEntry.source];
  if (!arr) return null;
  return arr.find((p) => p.slug === mapEntry.slug) || null;
}

async function main() {
  const [docPath] = process.argv.slice(2);
  if (!docPath) {
    fail('expected exactly 1 argument: <walkthrough.md>, got 0');
  }

  let docTextRaw;
  try {
    docTextRaw = await readFile(docPath, 'utf8');
  } catch (err) {
    fail(`could not read walkthrough doc at ${docPath}: ${err.message}`);
  }

  const docText = stripHtmlComments(docTextRaw);
  const rawSections = splitIntoSections(docText);
  const productMap = await loadProductMap();
  const realBySource = await loadRealProducts();

  // Analyse each section ONCE, independently of any product: marked citations are pulled out
  // and the remaining text is what bare extraction sees. Alias matching deliberately runs
  // against the RAW text, not the stripped text -- a product named inside a marked span is
  // still a product the section talks about, and treating it as unmentioned would let a
  // marker hide the mention as well as the figure.
  const sections = rawSections.map((section) => {
    const { strippedText, markedMoney, markedDates } = partitionMarkedCitations(section.text);
    return {
      heading: section.heading,
      rawText: section.text,
      strippedText,
      markedMoney,
      markedDates,
    };
  });

  const failures = [];
  let citationsChecked = 0;
  let markedCitationsExempted = 0;

  for (const mapEntry of productMap) {
    if (!mapEntry.slug || !mapEntry.source || !Array.isArray(mapEntry.aliases)) {
      fail(`product citation map entry ${JSON.stringify(mapEntry)} is malformed`);
    }
    const realProduct = findRealProduct(realBySource, mapEntry);
    if (!realProduct) {
      // The map names a product that no longer exists in the live data module -- fail
      // closed rather than silently skipping it, since a walkthrough could still be citing
      // figures for it.
      fail(
        `no '${mapEntry.slug}' entry in ${mapEntry.source} (lib/provisional-figures.ts) -- ` +
          'the product citation map is stale'
      );
    }

    const allowedFields = Array.isArray(mapEntry.fields) ? mapEntry.fields : [];
    const allowedMoney = new Set();
    const allowedDates = new Set();
    for (const field of allowedFields) {
      const value = realProduct[field];
      if (value === null || value === undefined) continue;
      if (field === 'earlyBirdCutoff') {
        allowedDates.add(value);
      } else {
        allowedMoney.add(Number(value));
      }
    }

    // Disclosure-invariant bookkeeping for this product, accumulated across every section
    // that names it (rule (c) in the header).
    let sawMarkedMoney = false;
    let sawMarkedDate = false;
    let disclosedMoney = false;
    let disclosedDate = false;

    for (const alias of mapEntry.aliases) {
      const aliasLower = alias.toLowerCase();
      for (const section of sections) {
        if (!section.rawText.toLowerCase().includes(aliasLower)) continue;

        // Marked citations: exempt from the value comparison, but they arm the disclosure
        // invariant for this product. Marking redirects the check; it never switches it off.
        if (section.markedMoney.length > 0) {
          sawMarkedMoney = true;
          markedCitationsExempted += section.markedMoney.length;
        }
        if (section.markedDates.length > 0) {
          sawMarkedDate = true;
          markedCitationsExempted += section.markedDates.length;
        }

        const moneyCitations = extractMoneyCitations(section.strippedText);
        const dateCitations = extractDateCitations(section.strippedText);

        for (const money of moneyCitations) {
          citationsChecked += 1;
          if (allowedMoney.has(money)) {
            disclosedMoney = true;
            continue;
          }
          failures.push(
            `${mapEntry.slug} (matched alias "${alias}"): cited R${money} does not match ` +
              `any real current value (allowed: ${[...allowedMoney].map((v) => `R${v}`).join(', ') || '(none)'}) ` +
              `-- section: ${section.heading ?? '(document start)'}. If this figure is ` +
              'deliberately non-current, wrap it as ' +
              '<span data-figure-status="legacy">...</span> or ' +
              '<span data-figure-status="proposed">...</span> -- but the real current value ' +
              'must then appear unmarked somewhere this product is named.'
          );
        }
        for (const date of dateCitations) {
          // Counting semantics deliberately unchanged from before the marker was added: a
          // date is counted as seen even for a product with no citable date field, so the
          // reported total stays comparable across this change.
          citationsChecked += 1;
          if (allowedDates.size === 0) continue;
          if (allowedDates.has(date)) {
            disclosedDate = true;
            continue;
          }
          failures.push(
            `${mapEntry.slug} (matched alias "${alias}"): cited date ${date} does not match ` +
              `any real current value (allowed: ${[...allowedDates].join(', ') || '(none)'}) ` +
              `-- section: ${section.heading ?? '(document start)'}. If this date is ` +
              'deliberately non-current, wrap it as ' +
              '<span data-figure-status="legacy">...</span> or ' +
              '<span data-figure-status="proposed">...</span> -- but the real current value ' +
              'must then appear unmarked somewhere this product is named.'
          );
        }
      }
    }

    // Rule (c): the disclosure invariant. Only enforceable where the product actually HAS a
    // real current value of that kind to disclose -- a product whose citable fields are all
    // null has nothing to show Brad, and demanding it would be an unsatisfiable assertion
    // rather than a real property.
    if (sawMarkedMoney && allowedMoney.size > 0 && !disclosedMoney) {
      failures.push(
        `${mapEntry.slug}: DISCLOSURE INVARIANT -- the doc cites a data-figure-status-marked ` +
          `price for this product, but its real current value ` +
          `(${[...allowedMoney].map((v) => `R${v}`).join(' or ')}) never appears as an ` +
          'unmarked citation in any section naming this product. Marking a figure redirects ' +
          'this check, it does not switch it off: Brad must still be shown the real number ' +
          'somewhere.'
      );
    }
    if (sawMarkedDate && allowedDates.size > 0 && !disclosedDate) {
      failures.push(
        `${mapEntry.slug}: DISCLOSURE INVARIANT -- the doc cites a data-figure-status-marked ` +
          `date for this product, but its real current value (${[...allowedDates].join(' or ')}) ` +
          'never appears as an unmarked citation in any section naming this product. Marking ' +
          'a figure redirects this check, it does not switch it off: Brad must still be shown ' +
          'the real date somewhere.'
      );
    }
  }

  if (failures.length > 0) {
    console.error('FAIL: verify-walkthrough-figures.mjs');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `PASS: ${citationsChecked} unmarked figure citation(s) checked against real ` +
      `lib/provisional-figures.ts values, all matched; ${markedCitationsExempted} ` +
      'data-figure-status-marked citation(s) exempted, every disclosure invariant satisfied.'
  );
}

main();
