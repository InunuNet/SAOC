// F30-A2 - projectVendorListing is a strict allowlist: no private field can reach the public document (POPIA).
// Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f30/check-b-projection.mts
import * as listing from '../../../../lib/vendor-listing.ts';
import { golden, hasUndefinedOwnProp, makeChecker } from './_lib.mts';

const allow = golden<{ publicFields: string[]; neverPublic: string[] }>('projection-allowlist.json');
const fx = golden<{ submission: Record<string, unknown> }>('pii-fixture.json').submission;
const { eq, ok, finish } = makeChecker('F30-A2 projection');
const project = listing.projectVendorListing as ((s: unknown) => Record<string, unknown>) | undefined;
ok('projectVendorListing is exported', typeof project === 'function');
if (typeof project === 'function') {
  const out = project(fx);
  const json = JSON.stringify(out);
  ok('keys are a subset of the allowlist', Object.keys(out).every((k) => allow.publicFields.includes(k)));
  ok('no SENTINEL value anywhere in the projection', !json.includes('SENTINEL'));
  for (const f of allow.neverPublic) ok(`never-public key ${f} absent`, !(f in out));
  ok('no undefined own property', !hasUndefinedOwnProp(out));
  eq('name is the trimmed trading name', out.name, 'PUBLIC-Trading Name');
  eq('country trimmed', out.country, 'PUBLIC-South Africa');
  eq('website kept', out.website, 'https://www.example.invalid/nursery');
  eq('bio trimmed', out.bio, 'PUBLIC-A short bio written by the vendor for the website and programme.');

  const blank = project({ ...fx, tradingName: '   ', countryOfBusinessRegistration: ' ', bio: '', website: undefined });
  eq('blank trading name falls back to business name', blank.name, 'PUBLIC-Legal Business Name');
  eq('blank fields are omitted, not empty', Object.keys(blank).sort(), ['name']);
  ok('blank projection has no undefined own property', !hasUndefinedOwnProp(blank));

  for (const bad of ['javascript:alert(1)', 'ftp://example.invalid', 'not a url', 'data:text/html,x', '//example.invalid']) {
    ok(`non-http website dropped: ${bad}`, !('website' in project({ ...fx, website: bad })));
  }
  eq('http website allowed', project({ ...fx, website: 'http://example.invalid' }).website, 'http://example.invalid');
}
finish();
