// G8 (national-show-ia-alignment, M1) — compile-time proof that `GatedProse` cannot be
// handed to a portable-text renderer without going through
// components/nos/ShowPageProse.tsx. This file is not executed; `tsc --noEmit` merely has
// to accept the `@ts-expect-error` directive below, which it only does if the assignment
// on the next line is a genuine type error. If GatedProse ever becomes structurally
// compatible with PortableTextBlock[] (e.g. someone "simplifies" it into a plain array),
// this file starts failing loudly: the `@ts-expect-error` becomes an unused-directive
// error, which `tsc --noEmit` also reports.
import type { PortableTextBlock } from '@portabletext/react';

import type { GatedProse } from '@/lib/data/show-pages';

declare const gated: GatedProse;

// @ts-expect-error — GatedProse must never be assignable to PortableTextBlock[]. Crossing
// the module boundary without going through ShowPageProse is meant to be a compile error.
const blocks: PortableTextBlock[] = gated;

// Referenced so the unused-variable rule (if any) doesn't obscure the real check above.
export const __gatedProseTypeGuardFixture = blocks;
