// A3: the diff against origin/main (tracked plus untracked) touches only the files goldens/spec.md "Files the dev may touch" allows.
import { execFileSync } from 'node:child_process';

const ALLOWED = [
  /^lib\/sanity-fixture\.ts$/,
  /^sanity\/lib\/client\.ts$/,
  /^components\/nos\/(NosHero|hero-photos|NosSection|NosSubNav|nos-subnav-groups|nos-route-heroes|nos-nav)\.(tsx|ts)$/,
  /^components\/nos-chrome\/nos-nav\.(ts|tsx)$/,
  /^components\/nos-chrome\/(NosHeader\.tsx|nos-chrome\.css)$/, // ND-1: the descriptor span and its .nh-desc styles go
  /^components\/nos\/Button\.tsx$/, // RB-1 (goldens/spec.md, NOS Design HR-1/RB-1): the R17 10px comment, no R2 2px citation
  /^components\/show\/nos\/HoldingState\.tsx$/, // NL-2 / HM-G1 label (dev e41ea785)
  /^scripts\/generate-image-variants\.mjs$/, // DS-1 crops (dev a82919d2; goldens/crops/NOS-DESIGN-SIGNOFF.txt)
  /^components\/nos\/FrauncesLedeScope\.tsx$/, // Rev 46c: the one preloaded italic Fraunces face; imported only by the /symposium and /about segment layouts (check-static FONT-1); NosThemeScope.tsx must stay unchanged
  /^app\/\(nos\)\/national-show\/(symposium|about)\/layout\.tsx$/,
  /^components\/show\/(FaqIndex|ShowFaqList|ShowJumpChips)\.tsx$/,
  /^app\/\(nos\)\/.*\/(page|loading)\.tsx$/,
  /^app\/\(nos\)\/page\.tsx$/,
  /^app\/\(shared\)\/(privacy|terms|refunds)\/.*\.tsx$/,
  /^app\/\(nos\)\/national-show\/nos-(theme|structure)\.css$/,
  /^public\/images\/nos-hero-[A-Za-z0-9-]+\.jpg$/,
  /^lib\/hero-source-widths\.json$/,
  /^components\/tickets\/keepsake\/parts\.tsx$/,
  /^components\/nos\/(PresenterSection|PresenterGrid)\.tsx$/,
  /^app\/\(nos\)\/national-show\/(symposium|international-guests|workshops|wosa-conference|conferences|about)\/[^/]+\.tsx$/,
  /^lib\/view-models\/load-presenters\.ts$/,
  /^content\/show-pages\/06-saoc-symposium\.json$/,
  /^content\/show-pages\/07-wosa-conference\.json$/,
  /^content\/show-pages\/02-about-the-national-show\.json$/,
  /^components\/nos\/ShowFacts\.tsx$/,
  /^lib\/data\/show-facts\.ts$/,
  /^components\/contact\/(ContactForm|NosContactAside)\.tsx$/,
  /^components\/nos\/ShowContactDetails\.tsx$/,
  /^lib\/view-models\/presenter-order\.ts$/,
  /^sanity\/schemas\/documents\/conferencePresenter\.ts$/,
  /^sanity\/schemas\/documents\/workshopSession\.ts$/,
  /^lib\/data\/ticket-presentation\.ts$/,
  /^lib\/data\/faq-sections\.ts$/,
  /^content\/show-pages\/17-faq\.json$/,
  /^scripts\/(cut-hero-crops\.[a-z]+|seed-show-faq\.ts)$/,
  /^docs\/nos-content-standard\.md$/,
  /^e2e\/[^/]+$/,
  /^\.agent\/memory\/project\/specs\/nos-content-standard\//,
  // architect-owned QA inputs the architect edits in this worktree (not the dev's)
  /^\.agent\/memory\/project\/specs\/launch-weekend\/goldens\/(f17\/nav-labels|f18\/longform-copy)\.json$/,
  /^contracts\/checks\/launch-weekend\/(f18\/check-a-longform\.mjs|f11\/nos-menu-baseline\.json)$/,
  /^\.agent\/memory\/(scratch|project\/(learned|backlog))/,
  /^comms\.md$/,
  /^test-results\//,
];
const run = (args) => { try { return execFileSync('git', args, { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean); } catch { return null; } };
// The dev branch carries commits that are not the dev's: origin/main, #76 and SAOC's shared API. A file counts as the dev's only when it differs from
// origin/main AND from the #76 tip AND from the pinned SAOC commit (override with NOS_STD_REF76 / NOS_STD_REFSAOC). A file merge-resolved
// between #76 and SAOC would also show; that is rare and the allowed set covers the NOS files either way.
// Diff against the merge-base with origin/main, not origin/main's tip: files that came in through a merge of main are not the dev's. A file whose content
// equals origin/main's tip is dropped as well, whichever side moved.
const MB = (run(['merge-base', 'HEAD', 'origin/main']) ?? [])[0] ?? 'origin/main';
const REFS = [MB, process.env.NOS_STD_REF76 ?? 'feat/nos-pagehero', process.env.NOS_STD_REFSAOC ?? '823308f5'];
const sets = REFS.map((r) => run(['diff', '--name-only', r]));
const missing = REFS.filter((_, i) => sets[i] === null);
if (missing.length) { console.error(`nos-content-standard diff scope FAILED: cannot resolve ref(s) ${missing.join(', ')} (git fetch origin; fetch #76)`); process.exit(1); }
const tracked = sets[0].filter((f) => sets.every((st) => st.includes(f)));
const files = [...new Set([...tracked, ...run(['ls-files', '-o', '--exclude-standard'])])];
const sameAsMain = (f) => { try { execFileSync('git', ['diff', '--quiet', 'origin/main', '--', f]); return true; } catch { return false; } };
// Rev 45: a file is the dev's only when the dev authored it: it is untracked or dirty in the worktree, or a non-merge commit in merge-base..HEAD touches it that is NOT reachable from
// SAOC's pinned commit, SAOC's branch tip (override NOS_STD_SAOC_BRANCH), the #76 ref or origin/main. A file that only arrived through a merge, or through a merge of SAOC plus #76/main
// (components/home/Hero.tsx: SAOC b2cff780 plus #95's sizes; MediaKitPageBody.tsx: SAOC 4ab33fc2), has no such commit and is not the dev's. A conflict resolution inside a merge commit is the one edit this cannot see.
const NOT = [REFS[2], process.env.NOS_STD_SAOC_BRANCH ?? 'origin/feat/saoc-content-standard-2026-10-25', REFS[1], 'origin/main'].filter((r) => run(['rev-parse', '--verify', '-q', r]));
const untracked = new Set(run(['ls-files', '-o', '--exclude-standard']));
const dirty = (f) => { try { execFileSync('git', ['diff', '--quiet', 'HEAD', '--', f]); return false; } catch { return true; } };
const devAuthored = (f) => untracked.has(f) || dirty(f) || (run(['log', '--no-merges', '--format=%H', `${MB}..HEAD`, '--not', ...NOT, '--', f]) ?? []).length > 0;
const outside = files.filter((f) => !ALLOWED.some((re) => re.test(f)) && !sameAsMain(f) && devAuthored(f));
if (outside.length) { console.error(`nos-content-standard diff scope FAILED: ${outside.length} file(s) outside the allowed set:\n- ${outside.join('\n- ')}`); process.exit(1); }
console.log(`diff scope pass (${files.length} files, all allowed)`);
