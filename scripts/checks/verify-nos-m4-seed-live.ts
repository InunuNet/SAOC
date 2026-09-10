/**
 * verify-nos-m4-seed-live.ts — the M4 LIVE seed-state verifier (national-show-ia-alignment).
 *
 * Everything in verify-show-page-m4.ts is deliberately OFFLINE — computable from the
 * committed tree with no token and no network. That is correct for source-shape checks,
 * but it means nothing in that suite can prove what is actually readable in the
 * production dataset RIGHT NOW. This script is the live counterpart: it hits
 * api.sanity.io directly, once anonymously and once with the write-enabled token from
 * .env.local (a read-only diagnostic use of that token — it never goes near
 * sanity/lib/client.ts, which stays anonymous with useCdn: true, per the lead's
 * standing veto on token-gated public reads).
 *
 * Two properties, not one:
 *
 *   LIVE1 — count(*[_type=="showPage"]) read ANONYMOUSLY equals N, where N is the
 *   number of real seed files on disk (the identical `readdirSync(...).filter(...)`
 *   expression scripts/seed-show-pages.ts's loadSeedPages() uses, at line ~222 there).
 *   N is DERIVED, never hardcoded — a truncated seed run or a change in how many pages
 *   exist must change what this check expects, not silently pass against a stale
 *   literal. This is the real acceptance test for the dotted/dotless fix: the six M4
 *   routes were 404ing because their showPage documents were invisible to an
 *   unauthenticated reader, and this is that exact read path.
 *
 *   LIVE2 — the TOKEN-AUTHENTICATED count of showPage documents whose _id contains a
 *   dot. Run anonymously this query is trivially 0 (the dotted documents are, by
 *   definition, invisible to an anonymous reader) — that reading proves nothing and
 *   this script reports it separately, labelled degenerate, precisely so it is never
 *   mistaken for evidence. The token-authenticated reading is the one that matters: it
 *   is the only way to see whether pre-fix dotted documents still exist. As of this
 *   mission's decision (NEEDS BRAD — the 13 pre-existing dotted `showPage` documents
 *   are an explicit no-touch item pending Brad's approval to delete/migrate), this
 *   number is EXPECTED TO STAY AT 13, not fall to 0 — the fix never deletes anything.
 *   A future run that finds this count changed without a recorded decision authorizing
 *   it should be treated as a real finding, not silently accepted.
 *
 * Exit 0: LIVE1 passed (dotless docs anonymously readable, count matches N). Exit 1:
 * LIVE1 failed. Exit 2: the script itself could not run (missing env, network error).
 * LIVE2 never affects the exit code — it is a diagnostic, not a pass/fail gate, because
 * whether the dotted count is 13 or 0 is a decision for a human (Brad), not a property
 * this script is entitled to declare correct or incorrect on its own.
 *
 * Lives in scripts/checks/, never execution/ (HARNESS-owned, wiped by the next
 * `make update-template`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SHOW_PAGES_DIR = path.resolve(PROJECT_ROOT, 'content/show-pages');
const API_VERSION = 'v2024-01-01';

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(PROJECT_ROOT, '.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// Identical to scripts/seed-show-pages.ts's loadSeedPages() filter — deliberately not
// imported, per the lead's instruction to reuse the expression rather than the function,
// so this script stays runnable with zero dependency on the seed module's I/O half.
function countRealSeedFiles(): number {
  return readdirSync(SHOW_PAGES_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).length;
}

async function sanityQuery(projectId: string, dataset: string, query: string, token?: string): Promise<number> {
  const url = new URL(`https://${projectId}.api.sanity.io/${API_VERSION}/data/query/${dataset}`);
  url.searchParams.set('query', query);
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Sanity query failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { result: number };
  return body.result;
}

async function main(): Promise<void> {
  const env = readEnvLocal();
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
  const token = env.SANITY_API_TOKEN;
  if (!projectId || !dataset) {
    console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET in .env.local');
    process.exit(2);
  }

  const n = countRealSeedFiles();

  const anonShowPageCount = await sanityQuery(projectId, dataset, 'count(*[_type=="showPage"])');
  const live1ok = anonShowPageCount === n;
  console.log(
    `${live1ok ? 'PASS' : 'FAIL'} LIVE1 — anonymous count(*[_type=="showPage"]) == N — expected ${n} (derived from ${n} real files in content/show-pages/), found ${anonShowPageCount}`,
  );

  const anonDottedCount = await sanityQuery(
    projectId,
    dataset,
    'count(*[length(string::split(_id,".")) > 1])',
  );
  console.log(
    `DEGENERATE LIVE2-anon — anonymous count of any dotted _id — found ${anonDottedCount} (expected 0; this reading proves nothing, since dotted docs are invisible to an anonymous reader by construction — see LIVE2-token for the real number)`,
  );

  if (!token) {
    console.log('SKIP LIVE2-token — no SANITY_API_TOKEN in .env.local, cannot run the authenticated reading');
  } else {
    const tokenDottedShowPageCount = await sanityQuery(
      projectId,
      dataset,
      'count(*[_type=="showPage" && length(string::split(_id,".")) > 1])',
      token,
    );
    console.log(
      `DIAGNOSTIC LIVE2-token — token-authenticated count of dotted showPage _ids — found ${tokenDottedShowPageCount} (expected 13 pre-fix; EXPECTED TO STAY 13 post-fix too, not fall to 0 — the seed never deletes the old dotted documents, and doing so is a NEEDS BRAD item this script does not gate on)`,
    );
  }

  process.exit(live1ok ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('verify-nos-m4-seed-live failed:', err);
  process.exit(2);
});
