// F30-A3 - publishVendorListing against an in-memory Sanity double: gate, consent, create-once, and the
// re-publish rule (never overwrite a Studio edit). The double throws on any method except
// getDocument and createIfNotExists. No network, no real client.
// Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f30/check-c-publish.mts
import * as listing from '../../../../lib/vendor-listing.ts';
import { fakeSanity, golden, hasUndefinedOwnProp, makeChecker } from './_lib.mts';

const allow = golden<{ sanityDocumentKeys: string[] }>('projection-allowlist.json');
const fx = golden<{ submission: Record<string, unknown> }>('pii-fixture.json').submission;
const { eq, ok, finish } = makeChecker('F30-A3 publish');
type Result = { ok: boolean; outcome?: string; reason?: string; documentId?: string };
const publish = listing.publishVendorListing as
  | ((deps: unknown, input: unknown) => Promise<Result>)
  | undefined;
ok('publishVendorListing is exported', typeof publish === 'function');

if (typeof publish === 'function') {
  const docId = `vendorNursery-${String(fx.id)}`;
  const run = (sanity: unknown, sub: Record<string, unknown>, ack = false) =>
    publish({ sanity, now: () => new Date('2026-10-20T10:00:00Z') }, { submission: sub, acknowledgeNoConsent: ack });

  // Not eligible: zero Sanity traffic of any kind.
  for (const status of ['submitted', 'under-review', 'rejected']) {
    const f = fakeSanity();
    const r = await run(f.sanity, { ...fx, status });
    eq(`${status}: refused`, [r.ok, r.reason], [false, 'not-eligible']);
    eq(`${status}: no Sanity calls`, f.calls.length, 0);
  }

  // Approved + consent: created once, with the allowlisted keys only.
  {
    const f = fakeSanity();
    const r = await run(f.sanity, fx);
    eq('approved: created', [r.ok, r.outcome, r.documentId], [true, 'created', docId]);
    ok('doc id has no dot (a dot makes the document private)', !docId.includes('.'));
    eq('exactly one write', f.writes().length, 1);
    const doc = f.store.get(docId) ?? {};
    ok('document exists under the deterministic id', Object.keys(doc).length > 0);
    eq('_type', doc._type, 'vendorNursery');
    ok('document keys within allowlist', Object.keys(doc).every((k) => allow.sanityDocumentKeys.includes(k)));
    ok('no SENTINEL in the written document', !JSON.stringify(doc).includes('SENTINEL'));
    ok('no undefined own property in the written document', !hasUndefinedOwnProp(doc));
  }

  // listing-only counts as consent to list.
  {
    const f = fakeSanity();
    const r = await run(f.sanity, { ...fx, marketingPermission: 'listing-only' });
    eq('listing-only: created', [r.ok, r.outcome], [true, 'created']);
  }

  // Missing consent: refused unless the admin explicitly acknowledges.
  {
    const noConsent = { ...fx, marketingPermission: undefined };
    const f1 = fakeSanity();
    const r1 = await run(f1.sanity, noConsent);
    eq('no consent: refused', [r1.ok, r1.reason], [false, 'consent-missing']);
    eq('no consent: zero writes', f1.writes().length, 0);
    const f2 = fakeSanity();
    const r2 = await run(f2.sanity, noConsent, true);
    eq('no consent + acknowledged: created', [r2.ok, r2.outcome], [true, 'created']);
  }

  // Re-publish rule: a Studio-edited document is never touched.
  {
    const edited = { _id: docId, _type: 'vendorNursery', name: 'Edited in Studio', bio: 'Edited bio', logo: { _type: 'image' }, extra: 1 };
    const f = fakeSanity({ [docId]: edited });
    const before = JSON.stringify(f.store.get(docId));
    const r = await run(f.sanity, fx);
    eq('re-publish: already-listed', [r.ok, r.outcome], [true, 'already-listed']);
    eq('re-publish: zero writes', f.writes().length, 0);
    eq('re-publish: document byte-identical', JSON.stringify(f.store.get(docId)), before);
  }

  // An open Studio draft also blocks creation.
  {
    const f = fakeSanity({ [`drafts.${docId}`]: { _id: `drafts.${docId}`, _type: 'vendorNursery', name: 'Draft in Studio' } });
    const r = await run(f.sanity, fx);
    eq('draft present: already-listed', [r.ok, r.outcome], [true, 'already-listed']);
    eq('draft present: zero writes', f.writes().length, 0);
  }

  // Idempotent: second publish is a no-op.
  {
    const f = fakeSanity();
    await run(f.sanity, fx);
    const before = JSON.stringify(f.store.get(docId));
    const r = await run(f.sanity, { ...fx, bio: 'Changed in Firestore afterwards' });
    eq('second publish: already-listed', r.outcome, 'already-listed');
    eq('second publish: document unchanged', JSON.stringify(f.store.get(docId)), before);
    eq('only one write in total', f.writes().length, 1);
  }
}
finish();
