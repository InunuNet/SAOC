// events-redesign footprint guard: the branch may differ from BASE (origin/main a20a0023) only in goldens/footprint.json, docs/events-redesign.md
// and this spec directory; HEAD descends from BASE.
import { BASE, SPEC_PREFIX, changedPaths, finish, git, goldenJson } from './_lib.mjs';

const failures = [];
const allowed = new Set(goldenJson('footprint.json'));
const changed = changedPaths();
for (const p of changed) if (!allowed.has(p) && !p.startsWith(SPEC_PREFIX)) failures.push(`path not on the allow-list (goldens/footprint.json, the spec dir): ${p}`);
try { git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim()); } catch { failures.push(`HEAD does not descend from ${BASE}`); }
finish('footprint.mjs', failures, `${changed.size} changed path(s), all inside the allow-list.`);
