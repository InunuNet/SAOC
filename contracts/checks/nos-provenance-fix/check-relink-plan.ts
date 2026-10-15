/**
 * nos-provenance-fix F3 — the sourcePath relink planner in scripts/seed-show-pages.ts.
 *
 * Usage: pnpm --dir <worktree> exec tsx contracts/checks/nos-provenance-fix/check-relink-plan.ts
 *
 * Pure tests only — no Sanity client, no network. Pins SOURCE_RELINKS to the three approved
 * relinks, drives planSourceRelink() through every refuse branch, proves the write payload is
 * exactly ONE `sections[_key=="…"].sourcePath` path, and proves the normal seed run still never
 * writes a council section (decideSectionAction Rule 1 unchanged). Then checks, with the real
 * resolveNotice(), that each seed body links to its new recovered file.
 * Exit 0 = pass, 1 = fail, 2 = could not run.
 */
import { RECOVERED } from './recovered-entries.mjs';

type Section = { _key: string; sectionKey: string; provenance?: string | null; sourcePath?: string | null; body?: unknown };
type Doc = { _id: string; _rev: string; sections?: Section[] } | null;
type Decision =
  | { action: 'relink'; docId: string; sectionKey: string; rev: string; setPath: string; from: string; to: string }
  | { action: 'already-linked'; docId: string; sectionKey: string }
  | { action: 'refuse'; docId: string; sectionKey: string; reason: string };
type Relink = { docId: string; sectionKey: string; from: string; to: string };
type SeedModule = {
  SOURCE_RELINKS?: readonly Relink[];
  planSourceRelink?: (r: Relink, d: Doc, isLinked: (p: string, b: unknown) => boolean) => Decision;
  relinkSetPayload?: (d: Extract<Decision, { action: 'relink' }>) => Record<string, string>;
  decideSectionAction: (seed: unknown, existing: unknown) => string;
};

async function main(): Promise<void> {
  const seed = (await import('@/scripts/seed-show-pages.ts')) as unknown as SeedModule;
  const { resolveNotice } = await import('@/lib/data/show-pages.ts');
  const { readFileSync } = await import('node:fs');
  const failures: string[] = [];
  const t = (ok: boolean, label: string) => { if (!ok) failures.push(label); };

  if (!seed.SOURCE_RELINKS || !seed.planSourceRelink || !seed.relinkSetPayload) {
    console.log('FAIL scripts/seed-show-pages.ts must export SOURCE_RELINKS, planSourceRelink and relinkSetPayload');
    process.exit(1);
  }
  const plan = seed.planSourceRelink;

  // 1. SOURCE_RELINKS is exactly the three approved relinks, in this order.
  const want = RECOVERED.map((e) => ({ docId: `showPage-${e.pageKey}`, sectionKey: e.sectionKey, from: e.from, to: `${e.dir}/content.md` }));
  t(JSON.stringify(seed.SOURCE_RELINKS) === JSON.stringify(want), 'SOURCE_RELINKS != the three pinned relinks (docId, sectionKey, from, to — in that key order)');

  // 2. Planner branches, with a stub linkage oracle.
  const r = want[2];
  const LINKED = { marker: 'linked' };
  const isLinked = (p: string, b: unknown) => p === r.to && b === LINKED;
  const sec = (over: Partial<Section> = {}): Section => ({ _key: '04-south-african-exhibitors--overview', sectionKey: 'overview', provenance: 'council-supplied', sourcePath: r.from, body: LINKED, ...over });
  const doc = (sections: Section[], id = r.docId): Doc => ({ _id: id, _rev: 'rev-1', sections });

  const ok = plan(r, doc([sec()]), isLinked);
  t(ok.action === 'relink', 'happy path must be relink');
  if (ok.action === 'relink') {
    t(ok.setPath === 'sections[_key=="04-south-african-exhibitors--overview"].sourcePath', 'setPath must select the EXISTING _key and end in .sourcePath');
    t(ok.rev === 'rev-1' && ok.from === r.from && ok.to === r.to && ok.docId === r.docId && ok.sectionKey === 'overview', 'relink decision carries rev, from, to, docId, sectionKey');
    const payload = seed.relinkSetPayload(ok);
    t(JSON.stringify(payload) === JSON.stringify({ [ok.setPath]: r.to }), 'relinkSetPayload must be exactly { setPath: to } — one field, nothing else');
  }
  const already = plan(r, doc([sec({ sourcePath: r.to })]), isLinked);
  t(already.action === 'already-linked', 'section already on the target path (and linked) must be already-linked');

  const refusals: Array<[string, Decision]> = [
    ['document missing', plan(r, null, isLinked)],
    ['wrong document id', plan(r, doc([sec()], 'showPage.04-south-african-exhibitors'), isLinked)],
    ['section missing', plan(r, doc([sec({ sectionKey: 'other' })]), isLinked)],
    ['duplicate sectionKey', plan(r, doc([sec(), sec({ _key: 'dup' })]), isLinked)],
    ['provenance placeholder-ai', plan(r, doc([sec({ provenance: 'placeholder-ai' })]), isLinked)],
    ['provenance council-draft', plan(r, doc([sec({ provenance: 'council-draft' })]), isLinked)],
    ['unexpected current sourcePath', plan(r, doc([sec({ sourcePath: 'content/drive-recovered/17-faq/faq/content.md' })]), isLinked)],
    ['no current sourcePath', plan(r, doc([sec({ sourcePath: null })]), isLinked)],
    ['live body does not link', plan(r, doc([sec({ body: { marker: 'edited in Studio' } })]), isLinked)],
    ['on target path but not linked', plan(r, doc([sec({ sourcePath: r.to, body: { marker: 'edited' } })]), isLinked)],
  ];
  for (const [label, d] of refusals) t(d.action === 'refuse', `must refuse: ${label} (got ${d.action})`);

  // 3. Normal seed mode still never writes a council section (Rule 1).
  const rule1 = seed.decideSectionAction(
    { sectionKey: 'overview', provenance: 'council-supplied', sourcePath: r.to, body: [] },
    { body: [], provenance: 'council-supplied', sourcePath: r.from, seedHash: 'x' },
  );
  t(rule1 === 'skip-council', `decideSectionAction must still return skip-council for a council section (got ${rule1})`);

  // 4. Real linkage: each seed body resolves clean against its new recovered file.
  for (const e of RECOVERED) {
    const page = JSON.parse(readFileSync(`content/show-pages/${e.pageKey}.json`, 'utf8')) as { sections: Section[] };
    const s = page.sections.find((x) => x.sectionKey === e.sectionKey);
    t(!!s && resolveNotice({ provenance: 'council-supplied', sourcePath: `${e.dir}/content.md`, body: s.body }) === null, `${e.pageKey}: seed body does not resolve clean against ${e.dir}/content.md`);
  }

  if (failures.length) { failures.forEach((f) => console.log(`FAIL ${f}`)); process.exit(1); }
  console.log('PASS: SOURCE_RELINKS pinned; planner relinks/already/10 refusals correct; payload is one sourcePath field; Rule 1 intact; 3 bodies link to their recovered files');
}

main().catch((err: unknown) => {
  console.error('check-relink-plan failed to run:', err instanceof Error ? err.message : err);
  process.exit(2);
});
