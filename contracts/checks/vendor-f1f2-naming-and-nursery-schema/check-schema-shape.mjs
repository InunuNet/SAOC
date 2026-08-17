#!/usr/bin/env node
// F2 — B1: behavioural proof of the field-by-field schema shape recorded in this contract's
// README, modelled directly on
// contracts/checks/ticketing-f1-show-collision/check-schema-shape.mjs (imports the REAL
// schema module, inspects the actual defineField() output, executes each field's own
// `validation` callback against a tracking mock Rule so "is this field required" is proved by
// running @dev's own validation function, not by grepping the source text for "required").
//
// DEFEATING MUTATION, one per field group, listed inline below each assertion block. The
// single most important one: making 'availableAtShow' a free-text field (type: 'string', no
// options.list) instead of the fixed multi-select the mission brief and source document both
// require — a check that only asserted "the field exists" would pass on that regression; this
// check reads the field's own `options.list` and diffs it against the exact tag set extracted
// from Lee-Ann's source .docx (fixtures/expected-availability-tags.json).
//
// Run as: node --import tsx/esm contracts/checks/vendor-f1f2-naming-and-nursery-schema/check-schema-shape.mjs

import { readFileSync } from 'node:fs';
import { vendorNursery } from '../../../sanity/schemas/documents/vendorNursery.ts';

const tagsFixture = JSON.parse(
  readFileSync(new URL('./fixtures/expected-availability-tags.json', import.meta.url), 'utf8')
);

const failures = [];

function trackingRule() {
  const calls = [];
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        return () => {
          calls.push(prop);
          return proxy;
        };
      },
    }
  );
  return { proxy, calls };
}

function fieldNamed(name) {
  return (vendorNursery?.fields ?? []).find((f) => f.name === name);
}

function wasRequired(field) {
  if (typeof field?.validation !== 'function') return false;
  const { proxy, calls } = trackingRule();
  field.validation(proxy);
  return calls.includes('required');
}

// --- name: required, string, the field the preview and Studio list depend on ---
// DEFEATING MUTATION: field renamed to 'title' (breaks convention with the rest of the site's
// document types, which all use 'name' for a proper noun — see sponsor.ts, judge.ts) or left
// optional (an unnamed nursery is unusable in a grid and unfindable in Studio).
{
  const field = fieldNamed('name');
  if (!field) failures.push(`missing field 'name'`);
  else {
    if (field.type !== 'string') failures.push(`'name' has type '${field.type}', expected 'string'`);
    if (!wasRequired(field)) failures.push(`'name' does not call Rule.required()`);
  }
}

// --- logo: image, per the source doc's 'Nursery logo' ---
// DEFEATING MUTATION: typed as 'file' or 'url' instead of Sanity's native 'image' type, which
// would break Studio's image picker/hotspot cropping and any future <Image> optimisation.
{
  const field = fieldNamed('logo');
  if (!field) failures.push(`missing field 'logo'`);
  else if (field.type !== 'image') failures.push(`'logo' has type '${field.type}', expected 'image'`);
}

// --- country, owner: free string fields ---
// DEFEATING MUTATION: typed as 'reference' to a country/owner document that does not exist in
// this schema — the source doc lists these as plain descriptive text, not managed taxonomies.
for (const name of ['country', 'owner']) {
  const field = fieldNamed(name);
  if (!field) failures.push(`missing field '${name}'`);
  else if (field.type !== 'string') failures.push(`'${name}' has type '${field.type}', expected 'string'`);
}

// --- history, specialisation, plantsBrought: multi-line text, not single-line string ---
// DEFEATING MUTATION: typed as 'string' (Studio renders a single-line input, editors lose the
// ability to write more than one line of "short history" without it silently truncating in
// the UI's expectation, even though Sanity itself would store any length).
for (const name of ['history', 'specialisation', 'plantsBrought']) {
  const field = fieldNamed(name);
  if (!field) failures.push(`missing field '${name}'`);
  else if (field.type !== 'text') failures.push(`'${name}' has type '${field.type}', expected 'text'`);
}

// --- website: url type, so Studio validates it's a well-formed URL ---
// DEFEATING MUTATION: typed as 'string', which accepts any text and defeats the schema-level
// URL validation Sanity's 'url' type provides for free.
{
  const field = fieldNamed('website');
  if (!field) failures.push(`missing field 'website'`);
  else if (field.type !== 'url') failures.push(`'website' has type '${field.type}', expected 'url'`);
}

// --- socialMedia: array of {platform, url} objects ---
// DEFEATING MUTATION: a single 'url' or 'string' field ("Instagram handle") instead of an
// array — the source doc's 'Social media' is plural by nature (a nursery plausibly has
// Facebook AND Instagram), and a scalar field cannot hold both without delimiter-hacking one
// string.
{
  const field = fieldNamed('socialMedia');
  if (!field) failures.push(`missing field 'socialMedia'`);
  else {
    if (field.type !== 'array') failures.push(`'socialMedia' has type '${field.type}', expected 'array'`);
    const memberTypes = (field.of ?? []).map((m) => m.type);
    if (!memberTypes.includes('object')) {
      failures.push(`'socialMedia'.of does not include an inline object member (found: ${JSON.stringify(memberTypes)})`);
    } else {
      const objectMember = field.of.find((m) => m.type === 'object');
      const memberFieldNames = (objectMember.fields ?? []).map((f) => f.name);
      for (const expected of ['platform', 'url']) {
        if (!memberFieldNames.includes(expected)) {
          failures.push(`'socialMedia' object member is missing field '${expected}'`);
        }
      }
      const urlSubfield = (objectMember.fields ?? []).find((f) => f.name === 'url');
      if (urlSubfield && urlSubfield.type !== 'url') {
        failures.push(`'socialMedia[].url' has type '${urlSubfield.type}', expected 'url'`);
      }
    }
  }
}

// --- availableAtShow: array of strings, FIXED options.list, exact tag set and order ---
// DEFEATING MUTATION (the one this check exists primarily to catch): a free-text field, or an
// array with no options.list at all — either would let an editor type "Species Orchids " with
// a typo or trailing space, breaking the showcase's future filter/badge feature the mission
// brief explicitly calls out ("so the showcase can filter and badge consistently").
{
  const field = fieldNamed('availableAtShow');
  if (!field) failures.push(`missing field 'availableAtShow'`);
  else {
    if (field.type !== 'array') {
      failures.push(`'availableAtShow' has type '${field.type}', expected 'array'`);
    }
    const list = field.options?.list;
    if (!Array.isArray(list)) {
      failures.push(
        `'availableAtShow' has no options.list — must be a fixed multi-select, not free text`
      );
    } else {
      // Normalise { title, value } list entries and bare-string entries alike.
      const values = list.map((entry) => (typeof entry === 'string' ? entry : entry.value ?? entry.title));
      const expected = tagsFixture.tags;
      if (JSON.stringify(values) !== JSON.stringify(expected)) {
        failures.push(
          `'availableAtShow'.options.list is ${JSON.stringify(values)}, expected exactly ` +
            `${JSON.stringify(expected)} (source: Lee-Ann's brief, verified 2026-08-17)`
        );
      }
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: vendorNursery carries every field from the source document with the correct type, including the fixed 6-tag availableAtShow multi-select.');
process.exit(0);
