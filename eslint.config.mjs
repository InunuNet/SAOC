// ESLint flat config for Next.js 16.
// eslint-config-next 16.x ships native flat-config exports (`eslint-config-next/core-web-vitals`,
// `eslint-config-next/typescript`) — FlatCompat is no longer needed to consume it (that shim
// was only required for Next 15.5's legacy shareable-config format; using it against the 16.x
// native flat config produced a circular-structure crash).
// `eslint-config-prettier` is applied last to disable stylistic rules that would otherwise
// conflict with Prettier formatting.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const config = [
  {
    ignores: ['.next/**', '**/.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts', 'design/**', '.claude/**', '.claude/worktrees/**', '.firebase/**', 'Old SAOC Website Backup/**', '.agent/**', '.golden/**', 'functions/lib/**', 'functions/node_modules/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettierConfig,
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    rules: {},
  },
  // F3 (national-show-ia-alignment, M1) — enforces the showPage provenance gate's
  // unwrap boundary. QA's cross-model review found that the previous unwrap function,
  // exported plainly from lib/data/show-pages.ts, could be imported and called from any
  // new file with no error of any kind — the TypeScript brand on GatedProse does not by
  // itself stop that, since nothing about importing a function is a type violation.
  // components/nos/gated-prose-internal.ts is the wrap/unwrap boundary now; only
  // components/nos/ShowPageProse.tsx (the render side) and lib/data/show-pages.ts (the
  // wrap side, used internally, never re-exported) may import it. Every other file gets
  // a real lint error. Verified against a probe file that imports it from a third
  // location — see .agent/memory/scratch/dev-result-national-show-ia-alignment.md.
  //
  // `files` covers .js/.jsx too, not just .ts/.tsx — this project has none today, but
  // Next.js accepts either, and a restriction that only fires on one file-extension
  // family is not a restriction (Codex's cross-model review, second pass).
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['components/nos/ShowPageProse.tsx', 'lib/data/show-pages.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/gated-prose-internal', '**/gated-prose-internal.ts', '@/components/nos/gated-prose-internal'],
              message:
                'gated-prose-internal.ts is the showPage provenance gate\'s wrap/unwrap boundary. ' +
                'Only components/nos/ShowPageProse.tsx renders a GatedProse value; only ' +
                'lib/data/show-pages.ts constructs one. Import loadShowPage/loadAllShowPages and ' +
                'render sections through <ShowPageProse> instead — see page-contract.golden.md.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
