// F2 / A5 — guard: no new route files under app/(marketing)/national-show, and no
// /national-show/tickets/buy. Brad 2026-10-15: "no new NOS routes" and "leave the uncommitted
// /national-show/tickets/buy relocation alone". Compares route-convention files on disk with
// the tree at the rebase base (BASE_SHA, 5ae1f3cf). This is a regression GUARD: it passes on base by design.
import { execFileSync } from 'node:child_process';
import { BASE_SHA, NOS_ROUTE_DIR, fail, pass, walk, worktreeRoot } from './f2-_lib.mjs';

const ID = 'f2-no-new-nos-routes';
const ROUTE_FILE = /^(page|route|layout|template|default|loading|error|not-found|opengraph-image|twitter-image)\.(tsx|ts|jsx|js|mdx)$/;

const baseFiles = new Set(
  execFileSync('git', ['-C', worktreeRoot, 'ls-tree', '-r', '--name-only', BASE_SHA, '--', NOS_ROUTE_DIR], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean),
);
if (baseFiles.size === 0) fail(ID, [`git ls-tree found nothing under ${NOS_ROUTE_DIR} at ${BASE_SHA}`]);

const problems = [];
for (const rel of walk(NOS_ROUTE_DIR, ROUTE_FILE)) {
  if (!baseFiles.has(rel)) problems.push(`new route file: ${rel}`);
}
if (walk(`${NOS_ROUTE_DIR}/tickets/buy`, /./).length) problems.push(`${NOS_ROUTE_DIR}/tickets/buy exists`);
if (problems.length) fail(ID, problems);
pass(ID, `${baseFiles.size} base files, no additions`);
