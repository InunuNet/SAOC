#!/usr/bin/env bash
# assert-fallback-builder-shape.sh — A5 (national-show-ia-alignment, M4, F24).
#
# Static second layer over NF9/NF12, neither trusting the other. Extracts
# buildAbsentShowPage() and loadShowPageOrFallback() from lib/data/show-pages.ts by
# balanced-brace scanning (a plain grep can't isolate one function's body) and asserts:
#   1. buildAbsentShowPage assigns NO `pageProvenance` from a string literal — the
#      rollup must be derived by the existing resolvePageProvenance(), so the gate
#      decides and the builder never gets to declare itself clean.
#   2. buildAbsentShowPage's section provenance IS 'placeholder-ai'.
#   3. loadShowPageOrFallback contains no `try` and no `catch` (NF9) — a transport
#      failure must surface as an error, never be swallowed into a fallback that reads
#      as "content not yet published".
set -euo pipefail

node -e '
const fs = require("fs");
const src = fs.readFileSync("lib/data/show-pages.ts", "utf8");

function extractFunction(name) {
  const marker = "function " + name + "(";
  const start = src.indexOf(marker);
  if (start === -1) {
    console.error("A5 FAIL: function " + name + " not found in lib/data/show-pages.ts");
    process.exit(1);
  }
  const braceStart = src.indexOf("{", start);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return src.slice(start, i);
}

const failures = [];

const builder = extractFunction("buildAbsentShowPage");
if (/pageProvenance\s*:\s*[\x27\x22]/.test(builder)) {
  failures.push("buildAbsentShowPage assigns pageProvenance from a string literal — it must be derived by resolvePageProvenance()");
}
if (!/provenance\s*:\s*[\x27\x22]placeholder-ai[\x27\x22]/.test(builder)) {
  failures.push("buildAbsentShowPage does not set its section provenance to the literal '\''placeholder-ai'\''");
}

const loader = extractFunction("loadShowPageOrFallback");
if (/\btry\b/.test(loader)) failures.push("loadShowPageOrFallback contains a try block");
if (/\bcatch\b/.test(loader)) failures.push("loadShowPageOrFallback contains a catch block");

if (failures.length > 0) {
  console.error("A5 FAIL:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
console.log("A5 PASS");
'
