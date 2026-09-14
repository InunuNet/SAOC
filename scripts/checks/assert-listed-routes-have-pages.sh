#!/usr/bin/env bash
# assert-listed-routes-have-pages.sh — A35 (national-show-ia-alignment, M4, F24).
#
# Second, independent layer over NF14 — a pure shell/git check that needs neither the
# content-state driver nor a dev server, so the router-level property (every listed:true
# manifest row has a page.tsx) is still provable if the verifier itself is broken.
#
# F24 replaces a notFound() INSIDE a page component that ran. A listed:true route with
# NO page.tsx at all 404s at the Next router, before any F24 code is in the call stack —
# no fallback design fixes that. So this checks BOTH trees, because their disagreement
# is the trap: NF14a-equivalent on the WORKING TREE (what `next build` compiles) and
# NF14b-equivalent via `git ls-files` (what actually deploys) — a route file that exists
# locally but was never `git add`ed renders fine on localhost and 404s on the host.
set -euo pipefail

node -e '
const fs = require("fs");
const { execSync } = require("child_process");

const manifest = JSON.parse(fs.readFileSync("content/national-show-routes.json", "utf8"));
const listed = manifest.routes.filter((r) => r.listed === true);

let trackedFiles;
try {
  trackedFiles = new Set(execSync("git ls-files", { encoding: "utf8" }).split("\n"));
} catch (err) {
  console.error("A35 FAIL: could not run git ls-files:", err.message);
  process.exit(1);
}

const failures = [];
for (const route of listed) {
  const pagePath = "app/(marketing)" + route.slug + "/page.tsx";
  const onDisk = fs.existsSync(pagePath);
  const inIndex = trackedFiles.has(pagePath);
  if (!onDisk) failures.push(route.slug + " — no page.tsx on the working tree at " + pagePath);
  else if (!inIndex) failures.push(route.slug + " — " + pagePath + " exists on disk but is not tracked by git (git ls-files)");
}

if (failures.length > 0) {
  console.error("A35 FAIL:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
console.log("A35 PASS — all " + listed.length + " listed:true routes have a page.tsx on disk and in the git index");
'
