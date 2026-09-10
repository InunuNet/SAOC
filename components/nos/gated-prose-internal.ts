// components/nos/gated-prose-internal.ts
//
// INTERNAL. Do not import this module from anywhere except
// components/nos/ShowPageProse.tsx (and lib/data/show-pages.ts, for the wrap side
// only — see below). This is enforced two ways, neither trusting the other:
//   1. eslint.config.mjs's `no-restricted-imports` block — a real lint FAIL, not just
//      a comment, verified against a probe file that imports this module from outside
//      the allowed set.
//   2. scripts/checks/assert-gated-prose-single-consumer.sh — a grep-based CI guard.
//
// WHY THIS FILE EXISTS AT ALL: QA's cross-model review found that
// `__unsafeUnwrapGatedProse` used to be an ordinary function exported from
// `lib/data/show-pages.ts`'s public surface. TypeScript's brand on `GatedProse` stops
// typed code from reading `.blocks`/`.notice` directly, but nothing stopped a second
// file from importing that specific escape hatch and rendering section copy with no
// notice — a probe file did exactly that and typechecked clean. Moving the unwrap
// function out of the public module and restricting who may import ITS module is what
// actually closes that hole; the type brand alone never did.
//
// BE PRECISE ABOUT WHAT THIS BUYS (per team-lead's instruction, and the architect's
// correction to provenance-gate.golden.md's "what this does NOT prevent" list):
// after this fix, ACCIDENTAL misuse won't compile (a new file importing this module
// gets no help from TypeScript's module resolution — nothing stops someone from typing
// the import anyway) and DELIBERATE misuse fails CI (the lint rule and the grep guard
// both fire on that import). That is NOT "impossible" — a developer who edits
// eslint.config.mjs in the same change, or who copies this file's logic inline instead
// of importing it, defeats both layers. It raises the cost of the bypass from "free and
// invisible" to "requires editing the enforcement mechanism itself, which is a
// reviewable diff." See provenance-gate.golden.md's limitations list for the same
// honesty applied to the GROQ-bypass risk (assertion A16).
import type { PortableTextBlock } from '@portabletext/react';

import type { GatedProse, ShowPageNotice } from '@/lib/data/show-pages';

export type GatedProseInternal = {
  blocks: PortableTextBlock[];
  notice: ShowPageNotice | null;
};

/** Called only by lib/data/show-pages.ts, to build the value it hands out publicly. */
export function wrapGatedProse(blocks: PortableTextBlock[], notice: ShowPageNotice | null): GatedProse {
  const internal: GatedProseInternal = { blocks, notice };
  return internal as unknown as GatedProse;
}

/** Called only by components/nos/ShowPageProse.tsx, to actually render the value. */
export function unwrapGatedProse(value: GatedProse): GatedProseInternal {
  return value as unknown as GatedProseInternal;
}
